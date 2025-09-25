package redis

import (
	"context"
	"encoding/json"
	"fmt"
	"mage-kick-webhook-proxy/pkg/logger"
	"mage-kick-webhook-proxy/pkg/model"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

// Define a reasonable TTL for webhooks to prevent infinite accumulation
const webhookTTL = 10 * time.Minute

// webhookOperation represents an async operation to be performed on Redis
type webhookOperation struct {
	opType   string // "store" or "expire"
	user     string
	webhook  model.Webhook   // single webhook for store operations
	webhooks []model.Webhook // multiple webhooks for bulk expire operations
}

// RedisWebhookStore provides persistent storage for webhooks to ensure at-least-once delivery
type RedisWebhookStore struct {
	client    *redis.Client
	opChannel chan webhookOperation
	ctx       context.Context
	cancel    context.CancelFunc
	wg        sync.WaitGroup
}

// NewRedisWebhookStore creates a new Redis webhook store
func NewRedisWebhookStore(redisURL string) (*RedisWebhookStore, error) {
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse Redis URL: %w", err)
	}

	client := redis.NewClient(opt)

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to Redis: %w", err)
	}

	// Create store with background worker
	ctx, cancel = context.WithCancel(context.Background())
	store := &RedisWebhookStore{
		client:    client,
		opChannel: make(chan webhookOperation, 1000), // Buffer for 1000 operations
		ctx:       ctx,
		cancel:    cancel,
	}

	// Start background worker
	store.wg.Add(1)
	go store.backgroundWorker()

	return store, nil
}

// backgroundWorker processes Redis operations asynchronously
func (r *RedisWebhookStore) backgroundWorker() {
	defer r.wg.Done()

	for {
		select {
		case <-r.ctx.Done():
			return
		case op := <-r.opChannel:
			switch op.opType {
			case "store":
				r.storeWebhookSync(op.user, op.webhook)
			case "expire":
				if len(op.webhooks) > 0 {
					r.expireWebhooksSync(op.user, op.webhooks)
				}
			}
		}
	}
}

// storeWebhookSync performs synchronous webhook storage (used by background worker)
func (r *RedisWebhookStore) storeWebhookSync(user string, webhook model.Webhook) {
	ctx, cancel := context.WithTimeout(r.ctx, 10*time.Second)
	defer cancel()

	webhookData, err := json.Marshal(webhook)
	if err != nil {
		logger.FromContext(r.ctx).WithError(err).WithFields(map[string]interface{}{
			"user":             user,
			"event_message_id": webhook.EventMessageID,
		}).Error("Redis: Failed to marshal webhook")
		return
	}

	// Use webhook message ID as unique identifier to prevent duplicates
	key := fmt.Sprintf("webhook:%s:%s", user, webhook.EventMessageID)

	// Store with a reasonable TTL to prevent infinite accumulation (24 hours)
	if err := r.client.Set(ctx, key, webhookData, webhookTTL).Err(); err != nil {
		logger.FromContext(r.ctx).WithError(err).WithFields(map[string]interface{}{
			"user":             user,
			"event_message_id": webhook.EventMessageID,
		}).Error("Redis: Failed to store webhook")
		return
	}

	logger.FromContext(r.ctx).WithFields(map[string]interface{}{
		"user":             user,
		"event_message_id": webhook.EventMessageID,
	}).Debug("Redis: Stored webhook")
}

// StoreWebhook stores a webhook in Redis for persistent delivery guarantee (non-blocking)
func (r *RedisWebhookStore) StoreWebhook(ctx context.Context, user string, webhook model.Webhook) error {
	// Try to send to channel without blocking
	select {
	case r.opChannel <- webhookOperation{
		opType:  "store",
		user:    user,
		webhook: webhook,
	}:
		return nil
	default:
		// Channel is full, webhook storage will be lost but we don't block
		return fmt.Errorf("webhook storage queue is full")
	}
}

// expireWebhooksSync performs synchronous bulk webhook expiration (used by background worker)
func (r *RedisWebhookStore) expireWebhooksSync(user string, webhooks []model.Webhook) {
	if len(webhooks) == 0 {
		return
	}

	ctx, cancel := context.WithTimeout(r.ctx, 10*time.Second)
	defer cancel()

	// Build all keys to delete
	keys := make([]string, len(webhooks))
	for i, webhook := range webhooks {
		keys[i] = fmt.Sprintf("webhook:%s:%s", user, webhook.EventMessageID)
	}

	// Delete all keys in a single Redis command
	if err := r.client.Del(ctx, keys...).Err(); err != nil {
		logger.FromContext(r.ctx).WithError(err).WithFields(map[string]interface{}{
			"user":          user,
			"webhook_count": len(webhooks),
		}).Error("Redis: Failed to expire webhooks")
		return
	}

	logger.FromContext(r.ctx).WithFields(map[string]interface{}{
		"user":          user,
		"webhook_count": len(webhooks),
		"webhook_ids":   keys,
	}).Debug("Redis: Expired webhooks")
}

// ExpireWebhook removes one or more webhooks from Redis after successful delivery (non-blocking)
func (r *RedisWebhookStore) ExpireWebhook(ctx context.Context, user string, webhooks ...model.Webhook) error {
	if len(webhooks) == 0 {
		return nil
	}

	// Check context cancellation first
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}

	// Try to send to channel without blocking
	select {
	case r.opChannel <- webhookOperation{
		opType:   "expire",
		user:     user,
		webhooks: webhooks,
	}:
		return nil
	default:
		// Channel is full, webhook expiration will be lost but we don't block
		return fmt.Errorf("webhook expiration queue is full")
	}
}

// LoadWebhooksForUser retrieves all stored webhooks for a user from Redis
func (r *RedisWebhookStore) LoadWebhooksForUser(ctx context.Context, user string) ([]model.Webhook, error) {
	pattern := fmt.Sprintf("webhook:%s:*", user)

	keys, err := r.client.Keys(ctx, pattern).Result()
	if err != nil {
		return nil, fmt.Errorf("failed to get webhook keys from Redis: %w", err)
	}

	if len(keys) == 0 {
		return []model.Webhook{}, nil
	}

	// Get all webhook data in a single pipeline for efficiency
	pipe := r.client.Pipeline()
	cmds := make([]*redis.StringCmd, len(keys))
	for i, key := range keys {
		cmds[i] = pipe.Get(ctx, key)
	}

	if _, err := pipe.Exec(ctx); err != nil {
		return nil, fmt.Errorf("failed to execute Redis pipeline: %w", err)
	}

	var webhooks []model.Webhook
	for _, cmd := range cmds {
		webhookData, err := cmd.Result()
		if err != nil {
			if err == redis.Nil {
				// Key expired between Keys() and Get(), skip it
				continue
			}
			return nil, fmt.Errorf("failed to get webhook data from Redis: %w", err)
		}

		var webhook model.Webhook
		if err := json.Unmarshal([]byte(webhookData), &webhook); err != nil {
			return nil, fmt.Errorf("failed to unmarshal webhook data: %w", err)
		}

		webhooks = append(webhooks, webhook)
	}

	return webhooks, nil
}

// LoadAllWebhooks retrieves all stored webhooks from Redis for startup pre-population
func (r *RedisWebhookStore) LoadAllWebhooks(ctx context.Context) (map[string][]model.Webhook, error) {
	pattern := "webhook:*"

	keys, err := r.client.Keys(ctx, pattern).Result()
	if err != nil {
		return nil, fmt.Errorf("failed to get all webhook keys from Redis: %w", err)
	}

	if len(keys) == 0 {
		return make(map[string][]model.Webhook), nil
	}

	// Get all webhook data in a single pipeline for efficiency
	pipe := r.client.Pipeline()
	cmds := make([]*redis.StringCmd, len(keys))
	for i, key := range keys {
		cmds[i] = pipe.Get(ctx, key)
	}

	if _, err := pipe.Exec(ctx); err != nil {
		return nil, fmt.Errorf("failed to execute Redis pipeline: %w", err)
	}

	result := make(map[string][]model.Webhook)
	for i, cmd := range cmds {
		webhookData, err := cmd.Result()
		if err != nil {
			if err == redis.Nil {
				// Key expired between Keys() and Get(), skip it
				continue
			}
			return nil, fmt.Errorf("failed to get webhook data from Redis: %w", err)
		}

		var webhook model.Webhook
		if err := json.Unmarshal([]byte(webhookData), &webhook); err != nil {
			return nil, fmt.Errorf("failed to unmarshal webhook data: %w", err)
		}

		// Extract user from key format: webhook:user:messageId
		key := keys[i]
		if len(key) < 8 || key[:8] != "webhook:" {
			continue // Skip malformed keys
		}

		// Find the second colon to extract user
		parts := key[8:] // Remove "webhook:" prefix
		colonIndex := -1
		for j, char := range parts {
			if char == ':' {
				colonIndex = j
				break
			}
		}

		if colonIndex == -1 {
			continue // Skip malformed keys
		}

		user := parts[:colonIndex]
		if _, exists := result[user]; !exists {
			result[user] = []model.Webhook{}
		}
		result[user] = append(result[user], webhook)
	}

	return result, nil
}

// Close closes the Redis connection and shuts down the background worker
func (r *RedisWebhookStore) Close() error {
	// Cancel the background worker context
	r.cancel()

	// Wait for background worker to finish
	r.wg.Wait()

	// Close the operation channel
	close(r.opChannel)

	// Close Redis connection
	return r.client.Close()
}

package state

import (
	"context"
	"encoding/json"
	"fmt"
	"mage-kick-webhook-proxy/pkg/config"
	"mage-kick-webhook-proxy/pkg/logger"
	"strconv"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

// PersistenceOperation represents a Redis operation to be performed
type PersistenceOperation struct {
	Type      string               `json:"type"`
	User      string               `json:"user"`
	Webhook   *WebhookWithSequence `json:"webhook,omitempty"`
	SinceID   int64                `json:"since_id,omitempty"`
	NextSeqID int64                `json:"next_seq_id,omitempty"`
}

const (
	OpTypeAppend      = "append"
	OpTypeAcknowledge = "acknowledge"
)

// RedisPersister handles all Redis operations in the background
type RedisPersister struct {
	client  *redis.Client
	config  config.RedisConfig
	opQueue chan PersistenceOperation
	ctx     context.Context
	cancel  context.CancelFunc
	wg      sync.WaitGroup
	logger  *logger.Logger
}

// NewRedisPersister creates a new Redis persister
func NewRedisPersister(ctx context.Context, cfg config.RedisConfig) (*RedisPersister, error) {
	baseLogger := logger.FromContext(ctx)
	log := baseLogger.WithField("component", "redis-persister")

	if cfg.URL == "" {
		return nil, fmt.Errorf("redis URL is empty")
	}

	// Parse Redis URL and create client
	opt, err := redis.ParseURL(cfg.URL)
	if err != nil {
		return nil, fmt.Errorf("invalid redis URL: %w", err)
	}

	// Apply timeouts from config
	opt.DialTimeout = cfg.DialTimeout
	opt.ReadTimeout = cfg.ReadTimeout
	opt.WriteTimeout = cfg.WriteTimeout
	opt.MaxRetries = cfg.MaxRetries

	client := redis.NewClient(opt)

	// Test connection
	pingCtx, cancel := context.WithTimeout(ctx, cfg.ConnectTimeout)
	defer cancel()

	if err := client.Ping(pingCtx).Err(); err != nil {
		client.Close()
		return nil, fmt.Errorf("failed to ping redis in %v: %w", cfg.ConnectTimeout, err)
	}

	persisterCtx, persisterCancel := context.WithCancel(ctx)

	rp := &RedisPersister{
		client:  client,
		config:  cfg,
		opQueue: make(chan PersistenceOperation, cfg.BatchSize*2), // Buffer for smooth operation
		ctx:     persisterCtx,
		cancel:  persisterCancel,
		logger:  baseLogger,
	}

	// Start background workers
	rp.wg.Add(1)
	go rp.processOperations()

	log.Info("Redis persister initialized successfully")
	return rp, nil
}

// Close shuts down the Redis persister
func (rp *RedisPersister) Close() error {
	rp.logger.WithField("component", "redis-persister").Info("Shutting down Redis persister")

	// Stop accepting new operations
	rp.cancel()
	close(rp.opQueue)

	// Wait for workers to finish
	rp.wg.Wait()

	// Close Redis client
	return rp.client.Close()
}

// QueueAppendWebhook queues a webhook append operation
func (rp *RedisPersister) QueueAppendWebhook(user string, webhook WebhookWithSequence) {
	select {
	case rp.opQueue <- PersistenceOperation{
		Type:    OpTypeAppend,
		User:    user,
		Webhook: &webhook,
	}:
	case <-rp.ctx.Done():
		rp.logger.WithField("component", "redis-persister").Warn("Failed to queue append webhook operation - persister is shutting down")
	default:
		rp.logger.WithField("component", "redis-persister").Warn("Redis operation queue is full - dropping append webhook operation")
	}
}

// QueueAcknowledgeWebhooks queues a webhook acknowledgment operation
func (rp *RedisPersister) QueueAcknowledgeWebhooks(user string, sinceID int64) {
	select {
	case rp.opQueue <- PersistenceOperation{
		Type:    OpTypeAcknowledge,
		User:    user,
		SinceID: sinceID,
	}:
	case <-rp.ctx.Done():
		rp.logger.WithField("component", "redis-persister").Warn("Failed to queue acknowledge webhooks operation - persister is shutting down")
	default:
		rp.logger.WithField("component", "redis-persister").Warn("Redis operation queue is full - dropping acknowledge webhooks operation")
	}
}

// processOperations processes queued operations in batches
func (rp *RedisPersister) processOperations() {
	defer rp.wg.Done()

	ticker := time.NewTicker(rp.config.SyncInterval)
	defer ticker.Stop()

	var batch []PersistenceOperation

	for {
		select {
		case <-rp.ctx.Done():
			// Process remaining batch before shutdown
			if len(batch) > 0 {
				rp.processBatch(batch)
			}
			return

		case op, ok := <-rp.opQueue:
			if !ok {
				// Channel closed, process remaining batch
				if len(batch) > 0 {
					rp.processBatch(batch)
				}
				return
			}

			batch = append(batch, op)

			// Process batch if it reaches the configured size
			if len(batch) >= rp.config.BatchSize {
				rp.processBatch(batch)
				batch = batch[:0] // Clear batch
			}

		case <-ticker.C:
			// Process batch on timer if we have any operations
			if len(batch) > 0 {
				rp.processBatch(batch)
				batch = batch[:0] // Clear batch
			}
		}
	}
}

// processBatch processes a batch of operations
func (rp *RedisPersister) processBatch(batch []PersistenceOperation) {
	if len(batch) == 0 {
		return
	}

	log := rp.logger.WithField("batch_size", len(batch))

	for attempt := 0; attempt < rp.config.RetryAttempts; attempt++ {
		if attempt > 0 {
			// Exponential backoff
			backoff := time.Duration(attempt) * time.Second
			log.WithField("attempt", attempt).WithField("backoff", backoff).Warn("Retrying Redis batch operation")

			select {
			case <-time.After(backoff):
			case <-rp.ctx.Done():
				return
			}
		}

		if err := rp.executeBatch(batch); err != nil {
			log.WithError(err).WithField("attempt", attempt).Error("Failed to execute Redis batch")
			continue
		}

		// Success
		log.Trace("Successfully processed Redis batch")
		return
	}

	log.Error("Failed to process Redis batch after all retry attempts")
}

// executeBatch executes a batch of operations using Redis transactions
func (rp *RedisPersister) executeBatch(batch []PersistenceOperation) error {
	pipe := rp.client.TxPipeline()
	usersToCheck := make(map[string]bool) // Track users that may need cleanup

	for _, op := range batch {
		switch op.Type {
		case OpTypeAppend:
			if err := rp.addAppendToPipeline(pipe, op); err != nil {
				return fmt.Errorf("failed to add append operation to pipeline: %w", err)
			}

		case OpTypeAcknowledge:
			if err := rp.addAcknowledgeToPipeline(pipe, op); err != nil {
				return fmt.Errorf("failed to add acknowledge operation to pipeline: %w", err)
			}
			// Mark this user for cleanup checking
			usersToCheck[op.User] = true

		default:
			rp.logger.WithField("component", "redis-persister").WithField("op_type", op.Type).Warn("Unknown operation type")
		}
	}

	// Execute the pipeline first
	_, err := pipe.Exec(rp.ctx)
	if err != nil {
		return err
	}

	// After successful pipeline execution, check for users that may need cleanup
	for user := range usersToCheck {
		if err := rp.cleanupUserIfEmpty(user); err != nil {
			// Log error but don't fail the entire batch
			rp.logger.WithField("component", "redis-persister").WithError(err).WithField("user", user).Warn("Failed to cleanup empty user")
		}
	}

	return nil
}

// addAppendToPipeline adds a webhook append operation to the pipeline
func (rp *RedisPersister) addAppendToPipeline(pipe redis.Pipeliner, op PersistenceOperation) error {
	webhookJSON, err := json.Marshal(op.Webhook)
	if err != nil {
		return fmt.Errorf("failed to marshal webhook: %w", err)
	}

	webhookKey := fmt.Sprintf("user:%s:webhooks", op.User)

	// Add webhook to sorted set with sequence ID as score
	pipe.ZAdd(rp.ctx, webhookKey, redis.Z{
		Score:  float64(op.Webhook.SequenceID),
		Member: string(webhookJSON),
	})

	// Set TTL on the sorted set (refresh TTL on each operation)
	pipe.Expire(rp.ctx, webhookKey, 2*ttl)

	// Add user to the set of users with webhooks
	pipe.SAdd(rp.ctx, "webhook_users", op.User)

	return nil
}

// addAcknowledgeToPipeline adds a webhook acknowledgment operation to the pipeline
func (rp *RedisPersister) addAcknowledgeToPipeline(pipe redis.Pipeliner, op PersistenceOperation) error {
	webhookKey := fmt.Sprintf("user:%s:webhooks", op.User)

	// Remove all webhooks with sequence ID <= sinceID
	pipe.ZRemRangeByScore(rp.ctx, webhookKey, "-inf", strconv.FormatInt(op.SinceID, 10))

	// Note: We'll check for user cleanup after the pipeline executes
	// since we can't do conditional operations within a pipeline
	return nil
}

// LoadAllWebhooks loads all webhooks from Redis for startup recovery
func (rp *RedisPersister) LoadAllWebhooks(ctx context.Context) (map[string][]WebhookWithSequence, error) {
	log := rp.logger.WithField("component", "redis-persister").WithField("operation", "load_all_webhooks")
	log.Info("Loading all webhooks from Redis")

	webhookLogs := make(map[string][]WebhookWithSequence)

	// Get all users
	users, err := rp.client.SMembers(rp.ctx, "webhook_users").Result()
	if err != nil {
		if err == redis.Nil {
			log.Info("No users found in Redis")
			return webhookLogs, nil
		}
		return nil, fmt.Errorf("failed to get users from Redis: %w", err)
	}

	log.WithField("user_count", len(users)).Info("Loading webhooks for users")

	for _, user := range users {
		// Load webhooks for this user
		webhooks, err := rp.loadWebhooksForUser(ctx, user)
		if err != nil {
			log.WithError(err).WithField("user", user).Error("Failed to load webhooks for user")
			continue
		}

		if len(webhooks) > 0 {
			webhookLogs[user] = webhooks
			log.WithField("user", user).WithField("webhook_count", len(webhooks)).Info("Loaded webhooks for user")
		}
	}

	log.WithField("total_users", len(users)).WithField("users_with_webhooks", len(webhookLogs)).Info("Completed loading all webhooks from Redis")
	return webhookLogs, nil
}

// loadWebhooksForUser loads all webhooks for a specific user
func (rp *RedisPersister) loadWebhooksForUser(ctx context.Context, user string) ([]WebhookWithSequence, error) {
	webhookKey := fmt.Sprintf("user:%s:webhooks", user)

	// Get all webhooks sorted by sequence ID
	webhookStrs, err := rp.client.ZRange(rp.ctx, webhookKey, 0, -1).Result()
	if err != nil {
		if err == redis.Nil {
			return []WebhookWithSequence{}, nil
		}
		return nil, fmt.Errorf("failed to get webhooks for user %s: %w", user, err)
	}

	var webhooks []WebhookWithSequence
	for _, webhookStr := range webhookStrs {
		var webhook WebhookWithSequence
		if err := json.Unmarshal([]byte(webhookStr), &webhook); err != nil {
			rp.logger.WithField("component", "redis-persister").WithError(err).WithField("user", user).Error("Failed to unmarshal webhook, skipping")
			continue
		}
		webhooks = append(webhooks, webhook)
	}

	return webhooks, nil
}

// cleanupUserIfEmpty removes a user from webhook_users if they have no remaining webhooks
func (rp *RedisPersister) cleanupUserIfEmpty(user string) error {
	webhookKey := fmt.Sprintf("user:%s:webhooks", user)

	// Check if the user has any remaining webhooks
	count, err := rp.client.ZCard(rp.ctx, webhookKey).Result()
	if err != nil {
		if err == redis.Nil {
			// Key doesn't exist, so no webhooks - remove user
			count = 0
		} else {
			return fmt.Errorf("failed to check webhook count for user %s: %w", user, err)
		}
	}

	// If user has no webhooks, remove them from webhook_users set
	if count == 0 {
		removed, err := rp.client.SRem(rp.ctx, "webhook_users", user).Result()
		if err != nil {
			return fmt.Errorf("failed to remove user %s from webhook_users: %w", user, err)
		}

		if removed > 0 {
			rp.logger.WithField("component", "redis-persister").WithField("user", user).Debug("Removed user from webhook_users (no remaining webhooks)")
		}
	}

	return nil
}

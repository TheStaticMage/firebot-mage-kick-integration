package state

import (
	"context"
	"fmt"
	"mage-kick-webhook-proxy/pkg/config"
	"mage-kick-webhook-proxy/pkg/logger"
	"mage-kick-webhook-proxy/pkg/model"
	"time"
)

// RedisState combines in-memory storage with Redis persistence
type RedisState struct {
	*MemoryState
	persister *RedisPersister
}

// NewWithRedis creates a new state with Redis persistence
func NewWithRedis(ctx context.Context, cfg config.RedisConfig) (State, error) {
	log := logger.FromContext(ctx).WithField("component", "redis-state")

	// Create Redis persister
	persister, err := NewRedisPersister(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("creating new Redis persister: %w", err)
	}

	// Create memory state
	memoryState := newMemoryOnly(ctx)

	// Create Redis state
	redisState := &RedisState{
		MemoryState: memoryState,
		persister:   persister,
	}

	// Load existing webhooks from Redis
	if err := redisState.loadFromRedis(ctx); err != nil {
		log.WithError(err).Warn("Failed to load webhooks from Redis, starting fresh")
	}

	log.Info("Redis-backed state initialized successfully")
	return redisState, nil
}

// loadFromRedis loads all webhooks from Redis into memory
func (rs *RedisState) loadFromRedis(ctx context.Context) error {
	log := logger.FromContext(ctx).WithField("component", "redis-state").WithField("operation", "load_from_redis")

	webhookLogs, err := rs.persister.LoadAllWebhooks(ctx)
	if err != nil {
		return err
	}

	// Load webhooks into memory
	rs.MemoryState.hooksMuMu.Lock()
	for user, webhooks := range webhookLogs {
		rs.MemoryState.webhookLogs[user] = webhooks
		log.WithField("user", user).WithField("webhook_count", len(webhooks)).Debug("Loaded webhooks for user from Redis")
	}
	rs.MemoryState.hooksMuMu.Unlock()

	log.WithField("total_users", len(webhookLogs)).Info("Successfully loaded state from Redis")
	return nil
}

// AppendWebhook appends a webhook and queues Redis persistence
func (rs *RedisState) AppendWebhook(ctx context.Context, user string, webhook model.Webhook) (int64, error) {
	// First, append to memory (this is fast and blocking)
	seqID, err := rs.MemoryState.AppendWebhook(ctx, user, webhook)
	if err != nil {
		return 0, err
	}

	// Then queue Redis persistence (this is non-blocking)
	webhookWithSeq := WebhookWithSequence{
		SequenceID: seqID,
		Webhook:    webhook,
		Timestamp:  time.Now(),
	}

	rs.persister.QueueAppendWebhook(user, webhookWithSeq)

	return seqID, nil
}

// GetWebhooksSince gets webhooks from memory and queues Redis cleanup
func (rs *RedisState) GetWebhooksSince(ctx context.Context, user string, sinceID int64) ([]WebhookWithSequence, error) {
	// Get webhooks from memory (this is fast)
	webhooks, err := rs.MemoryState.GetWebhooksSince(ctx, user, sinceID)
	if err != nil {
		return nil, err
	}

	// Queue Redis cleanup of acknowledged webhooks (non-blocking)
	if sinceID > 0 {
		rs.persister.QueueAcknowledgeWebhooks(user, sinceID)
	}

	return webhooks, nil
}

// Close shuts down the Redis state
func (rs *RedisState) Close(ctx context.Context) error {
	log := logger.FromContext(ctx).WithField("component", "redis-state")
	log.Info("Shutting down Redis state")

	// Close Redis persister
	if err := rs.persister.Close(); err != nil {
		log.WithError(err).Error("Failed to close Redis persister")
		return err
	}

	log.Info("Redis state shut down successfully")
	return nil
}

package memory

import (
	"context"
	"mage-kick-webhook-proxy/pkg/logger"
	"mage-kick-webhook-proxy/pkg/model"
	"mage-kick-webhook-proxy/pkg/state"
	"mage-kick-webhook-proxy/pkg/state/redis"
	"sync"
)

// PersistentMemoryState wraps the memory state with Redis persistence for at-least-once delivery
type PersistentMemoryState struct {
	*MemoryState
	redisStore redis.WebhookStore
	ctx        context.Context
}

// NewPersistentMemoryState creates a new memory state with Redis persistence backing
func NewPersistentMemoryState(ctx context.Context, redisURL string) (state.State, error) {
	memoryState := &MemoryState{
		Hooks:   make(map[string][]model.Webhook),
		hooksMu: make(map[string]*sync.RWMutex),
	}

	// Initialize Redis store
	redisStore, err := redis.NewRedisWebhookStore(redisURL)
	if err != nil {
		return nil, err
	}

	return NewPersistentMemoryStateWithStore(ctx, memoryState, redisStore)
}

// NewPersistentMemoryStateWithStore creates a new memory state with a provided webhook store (useful for testing)
func NewPersistentMemoryStateWithStore(ctx context.Context, memoryState *MemoryState, store redis.WebhookStore) (state.State, error) {
	persistentState := &PersistentMemoryState{
		MemoryState: memoryState,
		redisStore:  store,
		ctx:         ctx,
	}

	// Pre-populate memory with webhooks from Redis
	if err := persistentState.prePopulateFromRedis(); err != nil {
		logger.FromContext(ctx).WithError(err).Warn("Failed to pre-populate from Redis, continuing with empty state")
	}

	return persistentState, nil
}

// prePopulateFromRedis loads all webhooks from Redis into memory on startup
func (p *PersistentMemoryState) prePopulateFromRedis() error {
	webhookMap, err := p.redisStore.LoadAllWebhooks(p.ctx)
	if err != nil {
		return err
	}

	logger.FromContext(p.ctx).WithField("user_count", len(webhookMap)).Info("Pre-populating memory state from Redis")

	totalWebhooks := 0
	for user, webhooks := range webhookMap {
		mu := p.getHookMutex(user)
		mu.Lock()
		p.Hooks[user] = webhooks
		totalWebhooks += len(webhooks)
		mu.Unlock()
		logger.FromContext(p.ctx).WithField("user", user).WithField("webhook_count", len(webhooks)).Debug("Loaded webhooks for user from Redis")
	}

	logger.FromContext(p.ctx).WithField("webhook_count", totalWebhooks).Info("Successfully pre-populated memory state from Redis")
	return nil
}

// Put stores a webhook in both memory and Redis
func (p *PersistentMemoryState) Put(user string, webhook model.Webhook) {
	// Store in memory first (fast path)
	p.MemoryState.Put(user, webhook)

	// Store in Redis for persistence (non-blocking)
	if err := p.redisStore.StoreWebhook(p.ctx, user, webhook); err != nil {
		logger.FromContext(p.ctx).WithError(err).WithFields(map[string]any{
			"user":             user,
			"event_message_id": webhook.EventMessageID,
			"event_type":       webhook.EventType,
		}).Error("Failed to queue webhook for Redis storage")
	}
}

// GetAndClear retrieves and clears webhooks from memory, and expires them from Redis
func (p *PersistentMemoryState) GetAndClear(user string) []model.Webhook {
	// Get and clear from memory
	webhooks := p.MemoryState.GetAndClear(user)

	// Expire all webhooks from Redis in a single operation (non-blocking)
	if len(webhooks) > 0 {
		if err := p.redisStore.ExpireWebhook(p.ctx, user, webhooks...); err != nil {
			logger.FromContext(p.ctx).WithError(err).WithFields(map[string]any{
				"user":          user,
				"webhook_count": len(webhooks),
			}).Error("Failed to queue webhooks for Redis expiration")
		}
	}

	return webhooks
}

// Close closes the Redis connection
func (p *PersistentMemoryState) Close() error {
	if p.redisStore != nil {
		return p.redisStore.Close()
	}
	return nil
}

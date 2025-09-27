package state

import (
	"context"
	"mage-kick-webhook-proxy/pkg/logger"
	"mage-kick-webhook-proxy/pkg/model"
	"sync"
	"time"
)

const ttl = 5 * time.Minute

type MemoryState struct {
	webhookLogs map[string][]WebhookWithSequence
	mu          map[string]*sync.RWMutex
	hooksMuMu   sync.RWMutex
}

func New(ctx context.Context) State {
	return newMemoryOnly(ctx)
}

// newMemoryOnly creates a memory-only state without Redis persistence
func newMemoryOnly(ctx context.Context) *MemoryState {
	m := &MemoryState{
		webhookLogs: make(map[string][]WebhookWithSequence),
		mu:          make(map[string]*sync.RWMutex),
	}

	// Start background cleanup goroutine
	go m.backgroundCleanup(ctx)

	return m
}

func (m *MemoryState) AppendWebhook(ctx context.Context, user string, webhook model.Webhook) (int64, error) {
	log := logger.FromContext(ctx).WithField("user", user).WithField("op", "AppendWebhook").WithField("webhook_id", webhook.EventMessageID)

	mu := m.getHookMutex(user)
	mu.Lock()
	defer mu.Unlock()

	// Initialize if needed
	if _, exists := m.webhookLogs[user]; !exists {
		m.webhookLogs[user] = []WebhookWithSequence{}
		log.Trace("Initialized webhook log")
	}

	// Create webhook with sequence ID
	webhookWithSeq := WebhookWithSequence{
		SequenceID: time.Now().UnixMicro(),
		Webhook:    webhook,
		Timestamp:  time.Now(),
	}

	// Append to log
	m.webhookLogs[user] = append(m.webhookLogs[user], webhookWithSeq)
	log.WithField("sequence_id", webhookWithSeq.SequenceID).WithField("length", len(m.webhookLogs[user])).Trace("Appended webhook to log")

	return webhookWithSeq.SequenceID, nil
}

func (m *MemoryState) GetWebhooksSince(ctx context.Context, user string, sinceID int64) ([]WebhookWithSequence, error) {
	log := logger.FromContext(ctx).WithField("user", user).WithField("since_id", sinceID).WithField("op", "GetWebhooksSince")

	mu := m.getHookMutex(user)
	mu.Lock()
	defer mu.Unlock()

	webhookLog, exists := m.webhookLogs[user]
	if !exists {
		log.Trace("No webhooks for user")
		return []WebhookWithSequence{}, nil
	}

	// Find webhooks since the given ID and build new log without old webhooks
	var result []WebhookWithSequence
	var newLog []WebhookWithSequence

	for _, webhookWithSeq := range webhookLog {
		if webhookWithSeq.SequenceID > sinceID {
			if time.Since(webhookWithSeq.Timestamp) <= ttl {
				result = append(result, webhookWithSeq)
				newLog = append(newLog, webhookWithSeq)
				log.WithField("sequence_id", webhookWithSeq.SequenceID).WithField("webhook_id", webhookWithSeq.Webhook.EventMessageID).Trace("Including webhook")
			} else {
				log.WithField("sequence_id", webhookWithSeq.SequenceID).WithField("webhook_id", webhookWithSeq.Webhook.EventMessageID).Trace("Excluding expired webhook")
			}
		} else {
			log.WithField("sequence_id", webhookWithSeq.SequenceID).WithField("webhook_id", webhookWithSeq.Webhook.EventMessageID).Trace("Excluding webhook before sinceID")
		}
	}

	// Update the stored log to exclude webhooks at or before sinceID
	if len(newLog) == len(webhookLog) {
		log.Trace("No webhooks to remove from log")
	} else {
		log.WithField("old_log_length", len(webhookLog)).WithField("new_log_length", len(newLog)).Debug("Updating webhook log")
		m.webhookLogs[user] = newLog
	}

	return result, nil
}

func (m *MemoryState) getHookMutex(hook string) *sync.RWMutex {
	if mutex, exists := m.mu[hook]; exists {
		return mutex
	}

	m.hooksMuMu.Lock()
	defer m.hooksMuMu.Unlock()

	if mutex, exists := m.mu[hook]; exists {
		return mutex
	}
	m.mu[hook] = &sync.RWMutex{}
	return m.mu[hook]
}

// backgroundCleanup runs every 30 seconds to purge webhooks older than 60 seconds
func (m *MemoryState) backgroundCleanup(ctx context.Context) {
	log := logger.FromContext(ctx).WithField("component", "memory-cleanup")
	log.Info("Background webhook cleanup started")

	for {
		select {
		case <-ctx.Done():
			log.Info("Background webhook cleanup stopped")
			return
		case <-time.After(30 * time.Second):
			m.performCleanup(ctx)
		}
	}
}

// performCleanup removes webhooks older than 60 seconds
func (m *MemoryState) performCleanup(ctx context.Context) {
	log := logger.FromContext(ctx).WithField("component", "memory-cleanup")

	m.hooksMuMu.RLock()
	users := make([]string, 0, len(m.webhookLogs))
	for user := range m.webhookLogs {
		users = append(users, user)
	}
	m.hooksMuMu.RUnlock()

	cleanupThreshold := time.Now().Add(-ttl)
	totalCleaned := 0

	for _, user := range users {
		mu := m.getHookMutex(user)
		mu.Lock()

		webhookLog, exists := m.webhookLogs[user]
		if !exists {
			mu.Unlock()
			continue
		}

		var newLog []WebhookWithSequence
		cleanedCount := 0

		for _, webhookWithSeq := range webhookLog {
			if webhookWithSeq.Timestamp.After(cleanupThreshold) {
				newLog = append(newLog, webhookWithSeq)
			} else {
				cleanedCount++
				log.WithField("user", user).
					WithField("sequence_id", webhookWithSeq.SequenceID).
					WithField("webhook_id", webhookWithSeq.Webhook.EventMessageID).
					WithField("age", time.Since(webhookWithSeq.Timestamp)).
					Trace("Cleaning up expired webhook")
			}
		}

		if cleanedCount > 0 {
			m.webhookLogs[user] = newLog
			totalCleaned += cleanedCount
			log.WithField("user", user).
				WithField("cleaned_count", cleanedCount).
				WithField("remaining_count", len(newLog)).
				Debug("Cleaned up expired webhooks for user")
		}

		mu.Unlock()
	}

	if totalCleaned > 0 {
		log.WithField("total_cleaned", totalCleaned).Info("Background cleanup completed")
	} else {
		log.Trace("Background cleanup completed - no webhooks to clean")
	}
}

// SetWebhookTimestamp sets the timestamp of a specific webhook (for testing)
func (m *MemoryState) SetWebhookTimestamp(user string, sequenceID int64, timestamp time.Time) {
	mu := m.getHookMutex(user)
	mu.Lock()
	defer mu.Unlock()

	webhookLog, exists := m.webhookLogs[user]
	if !exists {
		return
	}

	for i, webhook := range webhookLog {
		if webhook.SequenceID == sequenceID {
			m.webhookLogs[user][i].Timestamp = timestamp
			return
		}
	}
}

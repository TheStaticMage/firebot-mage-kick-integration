package memory

import (
	"context"
	"mage-kick-webhook-proxy/pkg/logger"
	"mage-kick-webhook-proxy/pkg/model"
	"mage-kick-webhook-proxy/pkg/state/redis"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// MockWebhookStore is a mock implementation of redis.WebhookStore for testing
type MockWebhookStore struct {
	mock.Mock
	webhooks map[string][]model.Webhook
	mu       sync.RWMutex

	// Channels for synchronization in tests
	storeNotifications  chan struct{}
	expireNotifications chan struct{}
}

// Compile-time check to ensure MockWebhookStore implements redis.WebhookStore
var _ redis.WebhookStore = (*MockWebhookStore)(nil)

// NewMockWebhookStore creates a new mock webhook store
func NewMockWebhookStore() *MockWebhookStore {
	return &MockWebhookStore{
		webhooks:            make(map[string][]model.Webhook),
		storeNotifications:  make(chan struct{}, 100), // Buffered channel
		expireNotifications: make(chan struct{}, 100), // Buffered channel
	}
}

// StoreWebhook mocks storing a webhook
func (m *MockWebhookStore) StoreWebhook(ctx context.Context, user string, webhook model.Webhook) error {
	args := m.Called(ctx, user, webhook)

	// Actually store the webhook for test verification
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, exists := m.webhooks[user]; !exists {
		m.webhooks[user] = []model.Webhook{}
	}

	// Check if webhook already exists (prevent duplicates)
	for i, existing := range m.webhooks[user] {
		if existing.EventMessageID == webhook.EventMessageID {
			m.webhooks[user][i] = webhook // Update existing
			// Notify that store operation completed
			select {
			case m.storeNotifications <- struct{}{}:
			default:
			}
			return args.Error(0)
		}
	}

	m.webhooks[user] = append(m.webhooks[user], webhook)

	// Notify that store operation completed
	select {
	case m.storeNotifications <- struct{}{}:
	default:
	}

	return args.Error(0)
}

// ExpireWebhook mocks expiring one or more webhooks
func (m *MockWebhookStore) ExpireWebhook(ctx context.Context, user string, webhooks ...model.Webhook) error {
	args := m.Called(ctx, user, webhooks)

	// Actually remove the webhooks for test verification
	m.mu.Lock()
	defer m.mu.Unlock()
	if existingWebhooks, exists := m.webhooks[user]; exists {
		for _, webhook := range webhooks {
			for i, existing := range existingWebhooks {
				if existing.EventMessageID == webhook.EventMessageID {
					m.webhooks[user] = append(existingWebhooks[:i], existingWebhooks[i+1:]...)
					existingWebhooks = m.webhooks[user] // Update reference after modification
					break
				}
			}
		}
	}

	// Notify that expire operation completed
	select {
	case m.expireNotifications <- struct{}{}:
	default:
	}

	return args.Error(0)
}

// LoadWebhooksForUser mocks loading webhooks for a user
func (m *MockWebhookStore) LoadWebhooksForUser(ctx context.Context, user string) ([]model.Webhook, error) {
	args := m.Called(ctx, user)

	m.mu.RLock()
	defer m.mu.RUnlock()

	if webhooks, exists := m.webhooks[user]; exists {
		// Return a copy to avoid race conditions
		result := make([]model.Webhook, len(webhooks))
		copy(result, webhooks)
		return result, args.Error(1)
	}

	return []model.Webhook{}, args.Error(1)
}

// LoadAllWebhooks mocks loading all webhooks
func (m *MockWebhookStore) LoadAllWebhooks(ctx context.Context) (map[string][]model.Webhook, error) {
	args := m.Called(ctx)

	m.mu.RLock()
	defer m.mu.RUnlock()

	// Return a deep copy to avoid race conditions
	result := make(map[string][]model.Webhook)
	for user, webhooks := range m.webhooks {
		result[user] = make([]model.Webhook, len(webhooks))
		copy(result[user], webhooks)
	}

	return result, args.Error(1)
}

// Close mocks closing the store
func (m *MockWebhookStore) Close() error {
	args := m.Called()
	return args.Error(0)
}

// SetInitialData allows setting up initial data in the mock store (for pre-population testing)
func (m *MockWebhookStore) SetInitialData(data map[string][]model.Webhook) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.webhooks = make(map[string][]model.Webhook)
	for user, webhooks := range data {
		m.webhooks[user] = make([]model.Webhook, len(webhooks))
		copy(m.webhooks[user], webhooks)
	}
}

// GetStoredWebhooks returns the currently stored webhooks (for test verification)
func (m *MockWebhookStore) GetStoredWebhooks() map[string][]model.Webhook {
	m.mu.RLock()
	defer m.mu.RUnlock()

	result := make(map[string][]model.Webhook)
	for user, webhooks := range m.webhooks {
		result[user] = make([]model.Webhook, len(webhooks))
		copy(result[user], webhooks)
	}
	return result
}

// WaitForStoreOperations waits for the specified number of store operations to complete
func (m *MockWebhookStore) WaitForStoreOperations(count int, timeout time.Duration) bool {
	timer := time.NewTimer(timeout)
	defer timer.Stop()

	for i := 0; i < count; i++ {
		select {
		case <-m.storeNotifications:
			// Operation completed
		case <-timer.C:
			return false // Timeout
		}
	}
	return true
}

// WaitForExpireOperations waits for the specified number of expire operations to complete
func (m *MockWebhookStore) WaitForExpireOperations(count int, timeout time.Duration) bool {
	timer := time.NewTimer(timeout)
	defer timer.Stop()

	for i := 0; i < count; i++ {
		select {
		case <-m.expireNotifications:
			// Operation completed
		case <-timer.C:
			return false // Timeout
		}
	}
	return true
}

func TestPersistentMemoryState_EndToEnd(t *testing.T) {
	// Create a context with logger for testing
	ctx := logger.WithLogger(context.Background(), logger.New())

	t.Run("PrePopulationFromRedis", func(t *testing.T) {
		// Setup initial data in mock store
		initialData := map[string][]model.Webhook{
			"user1": {
				{
					WebhookHeaders: model.WebhookHeaders{
						EventMessageID: "existing-msg-1",
						EventType:      "channel.follow",
						EventVersion:   "1.0",
					},
					RawData: []byte(`{"event": "follow", "user": "user1"}`),
				},
				{
					WebhookHeaders: model.WebhookHeaders{
						EventMessageID: "existing-msg-2",
						EventType:      "channel.subscribe",
						EventVersion:   "1.0",
					},
					RawData: []byte(`{"event": "subscribe", "user": "user1"}`),
				},
			},
			"user2": {
				{
					WebhookHeaders: model.WebhookHeaders{
						EventMessageID: "existing-msg-3",
						EventType:      "channel.follow",
						EventVersion:   "1.0",
					},
					RawData: []byte(`{"event": "follow", "user": "user2"}`),
				},
			},
		}

		mockStore := NewMockWebhookStore()
		mockStore.SetInitialData(initialData)
		mockStore.On("LoadAllWebhooks", mock.Anything).Return(initialData, nil)
		mockStore.On("Close").Return(nil).Maybe()

		memoryState := &MemoryState{
			Hooks:   make(map[string][]model.Webhook),
			hooksMu: make(map[string]*sync.RWMutex),
		}

		// Create persistent state - this should trigger pre-population
		persistentState, err := NewPersistentMemoryStateWithStore(ctx, memoryState, mockStore)
		require.NoError(t, err)
		defer func() {
			if closer, ok := persistentState.(*PersistentMemoryState); ok {
				closer.Close()
			}
		}()

		// Verify pre-population worked
		mockStore.AssertExpectations(t)

		// Check that memory was populated with Redis data
		user1Webhooks := persistentState.(*PersistentMemoryState).MemoryState.GetAndClear("user1")
		user2Webhooks := persistentState.(*PersistentMemoryState).MemoryState.GetAndClear("user2")

		assert.Len(t, user1Webhooks, 2)
		assert.Len(t, user2Webhooks, 1)

		// Verify specific webhook content
		assert.Equal(t, "existing-msg-1", user1Webhooks[0].EventMessageID)
		assert.Equal(t, "existing-msg-2", user1Webhooks[1].EventMessageID)
		assert.Equal(t, "existing-msg-3", user2Webhooks[0].EventMessageID)
	})

	t.Run("StoreNewWebhookData", func(t *testing.T) {
		mockStore := NewMockWebhookStore()
		mockStore.On("LoadAllWebhooks", mock.Anything).Return(map[string][]model.Webhook{}, nil)
		mockStore.On("Close").Return(nil).Maybe()

		memoryState := &MemoryState{
			Hooks:   make(map[string][]model.Webhook),
			hooksMu: make(map[string]*sync.RWMutex),
		}

		persistentState, err := NewPersistentMemoryStateWithStore(ctx, memoryState, mockStore)
		require.NoError(t, err)
		defer func() {
			if closer, ok := persistentState.(*PersistentMemoryState); ok {
				closer.Close()
			}
		}()

		newWebhook := model.Webhook{
			WebhookHeaders: model.WebhookHeaders{
				EventMessageID: "new-webhook-123",
				EventType:      "channel.follow",
				EventVersion:   "1.0",
			},
			RawData: []byte(`{"event": "new_follow", "user": "newuser"}`),
		}

		// Set up mock expectation for storing webhook
		mockStore.On("StoreWebhook", mock.Anything, "newuser", newWebhook).Return(nil)

		// Store new webhook
		persistentState.Put("newuser", newWebhook)

		// Verify webhook was stored in memory
		webhooks := persistentState.(*PersistentMemoryState).MemoryState.Hooks["newuser"]
		require.Len(t, webhooks, 1)
		assert.Equal(t, "new-webhook-123", webhooks[0].EventMessageID)

		// Wait for async Redis operation to complete
		require.True(t, mockStore.WaitForStoreOperations(1, 5*time.Second), "Store operation should complete within timeout")

		// Verify mock was called
		mockStore.AssertExpectations(t)

		// Verify webhook was actually stored in mock
		storedWebhooks := mockStore.GetStoredWebhooks()
		assert.Len(t, storedWebhooks["newuser"], 1)
		assert.Equal(t, "new-webhook-123", storedWebhooks["newuser"][0].EventMessageID)
	})

	t.Run("PollingAndExpiration", func(t *testing.T) {
		// Setup initial data
		initialData := map[string][]model.Webhook{
			"polluser": {
				{
					WebhookHeaders: model.WebhookHeaders{
						EventMessageID: "poll-msg-1",
						EventType:      "channel.follow",
						EventVersion:   "1.0",
					},
					RawData: []byte(`{"event": "follow", "user": "polluser"}`),
				},
				{
					WebhookHeaders: model.WebhookHeaders{
						EventMessageID: "poll-msg-2",
						EventType:      "channel.subscribe",
						EventVersion:   "1.0",
					},
					RawData: []byte(`{"event": "subscribe", "user": "polluser"}`),
				},
			},
		}

		mockStore := NewMockWebhookStore()
		mockStore.SetInitialData(initialData)
		mockStore.On("LoadAllWebhooks", mock.Anything).Return(initialData, nil)
		mockStore.On("Close").Return(nil).Maybe()

		memoryState := &MemoryState{
			Hooks:   make(map[string][]model.Webhook),
			hooksMu: make(map[string]*sync.RWMutex),
		}

		persistentState, err := NewPersistentMemoryStateWithStore(ctx, memoryState, mockStore)
		require.NoError(t, err)
		defer func() {
			if closer, ok := persistentState.(*PersistentMemoryState); ok {
				closer.Close()
			}
		}()

		// Set up mock expectations for expiring webhooks (should be called once with both webhooks)
		mockStore.On("ExpireWebhook", mock.Anything, "polluser", mock.MatchedBy(func(webhooks []model.Webhook) bool {
			if len(webhooks) != 2 {
				return false
			}
			// Check that both expected webhooks are present
			hasMsg1, hasMsg2 := false, false
			for _, w := range webhooks {
				switch w.EventMessageID {
				case "poll-msg-1":
					hasMsg1 = true
				case "poll-msg-2":
					hasMsg2 = true
				}
			}
			return hasMsg1 && hasMsg2
		})).Return(nil)

		// Simulate polling - this should clear webhooks from memory and expire them in Redis
		polledWebhooks := persistentState.GetAndClear("polluser")

		// Verify polling returned the correct webhooks
		require.Len(t, polledWebhooks, 2)
		messageIDs := []string{polledWebhooks[0].EventMessageID, polledWebhooks[1].EventMessageID}
		assert.Contains(t, messageIDs, "poll-msg-1")
		assert.Contains(t, messageIDs, "poll-msg-2")

		// Verify memory is now empty for this user
		remainingWebhooks := persistentState.(*PersistentMemoryState).MemoryState.Hooks["polluser"]
		assert.Len(t, remainingWebhooks, 0)

		// Wait for async Redis expiration operations to complete
		require.True(t, mockStore.WaitForExpireOperations(1, 5*time.Second), "Expire operations should complete within timeout")

		// Verify expiration calls were made
		mockStore.AssertExpectations(t)

		// Verify webhooks were expired from mock store
		storedWebhooks := mockStore.GetStoredWebhooks()
		assert.Len(t, storedWebhooks["polluser"], 0)
	})

	t.Run("CompleteWorkflow", func(t *testing.T) {
		// Test the complete workflow: pre-population -> new webhooks -> polling -> expiration

		// Initial state with some existing webhooks
		initialData := map[string][]model.Webhook{
			"workflowuser": {
				{
					WebhookHeaders: model.WebhookHeaders{
						EventMessageID: "workflow-existing-1",
						EventType:      "channel.follow",
						EventVersion:   "1.0",
					},
					RawData: []byte(`{"event": "existing_follow"}`),
				},
			},
		}

		mockStore := NewMockWebhookStore()
		mockStore.SetInitialData(initialData)
		mockStore.On("LoadAllWebhooks", mock.Anything).Return(initialData, nil)
		mockStore.On("Close").Return(nil).Maybe()

		memoryState := &MemoryState{
			Hooks:   make(map[string][]model.Webhook),
			hooksMu: make(map[string]*sync.RWMutex),
		}

		// Step 1: Create persistent state (triggers pre-population)
		persistentState, err := NewPersistentMemoryStateWithStore(ctx, memoryState, mockStore)
		require.NoError(t, err)
		defer func() {
			if closer, ok := persistentState.(*PersistentMemoryState); ok {
				closer.Close()
			}
		}()

		// Step 2: Add new webhook
		newWebhook := model.Webhook{
			WebhookHeaders: model.WebhookHeaders{
				EventMessageID: "workflow-new-1",
				EventType:      "channel.subscribe",
				EventVersion:   "1.0",
			},
			RawData: []byte(`{"event": "new_subscribe"}`),
		}

		mockStore.On("StoreWebhook", mock.Anything, "workflowuser", newWebhook).Return(nil)
		persistentState.Put("workflowuser", newWebhook)

		// Verify both webhooks are in memory
		memoryWebhooks := persistentState.(*PersistentMemoryState).MemoryState.Hooks["workflowuser"]
		assert.Len(t, memoryWebhooks, 2)

		// Step 3: Set up expiration expectations and poll
		mockStore.On("ExpireWebhook", mock.Anything, "workflowuser", mock.MatchedBy(func(webhooks []model.Webhook) bool {
			if len(webhooks) != 2 {
				return false
			}
			// Check that both expected webhooks are present
			hasExisting, hasNew := false, false
			for _, w := range webhooks {
				if w.EventMessageID == "workflow-existing-1" {
					hasExisting = true
				} else if w.EventMessageID == "workflow-new-1" {
					hasNew = true
				}
			}
			return hasExisting && hasNew
		})).Return(nil)

		polledWebhooks := persistentState.GetAndClear("workflowuser")

		// Step 4: Verify complete workflow
		require.Len(t, polledWebhooks, 2)
		messageIDs := []string{polledWebhooks[0].EventMessageID, polledWebhooks[1].EventMessageID}
		assert.Contains(t, messageIDs, "workflow-existing-1")
		assert.Contains(t, messageIDs, "workflow-new-1")

		// Memory should be empty
		remainingWebhooks := persistentState.(*PersistentMemoryState).MemoryState.Hooks["workflowuser"]
		assert.Len(t, remainingWebhooks, 0)

		// Wait for async operations (1 store + 1 expire operation with multiple webhooks)
		require.True(t, mockStore.WaitForStoreOperations(1, 5*time.Second), "Store operation should complete within timeout")
		require.True(t, mockStore.WaitForExpireOperations(1, 5*time.Second), "Expire operations should complete within timeout")

		// All mock expectations should be satisfied
		mockStore.AssertExpectations(t)

		// Redis should have no webhooks for this user
		storedWebhooks := mockStore.GetStoredWebhooks()
		assert.Len(t, storedWebhooks["workflowuser"], 0)
	})

	t.Run("ErrorHandling", func(t *testing.T) {
		mockStore := NewMockWebhookStore()
		mockStore.On("LoadAllWebhooks", mock.Anything).Return(map[string][]model.Webhook{}, nil)
		mockStore.On("Close").Return(nil).Maybe()

		memoryState := &MemoryState{
			Hooks:   make(map[string][]model.Webhook),
			hooksMu: make(map[string]*sync.RWMutex),
		}

		persistentState, err := NewPersistentMemoryStateWithStore(ctx, memoryState, mockStore)
		require.NoError(t, err)
		defer func() {
			if closer, ok := persistentState.(*PersistentMemoryState); ok {
				closer.Close()
			}
		}()

		webhook := model.Webhook{
			WebhookHeaders: model.WebhookHeaders{
				EventMessageID: "error-test-webhook",
				EventType:      "channel.follow",
				EventVersion:   "1.0",
			},
			RawData: []byte(`{"event": "error_test"}`),
		}

		// Mock Redis store operation to return an error
		mockStore.On("StoreWebhook", mock.Anything, "erroruser", webhook).Return(assert.AnError)

		// Store webhook - should still work in memory despite Redis error
		persistentState.Put("erroruser", webhook)

		// Verify webhook was stored in memory even with Redis error
		memoryWebhooks := persistentState.(*PersistentMemoryState).MemoryState.Hooks["erroruser"]
		require.Len(t, memoryWebhooks, 1)
		assert.Equal(t, "error-test-webhook", memoryWebhooks[0].EventMessageID)

		// Wait for async operation (even though it errors, it should still notify)
		require.True(t, mockStore.WaitForStoreOperations(1, 5*time.Second), "Store operation should complete within timeout even with error")

		mockStore.AssertExpectations(t)
	})
}

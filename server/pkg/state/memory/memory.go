package memory

import (
	"mage-kick-webhook-proxy/pkg/model"
	"mage-kick-webhook-proxy/pkg/state"
	"sync"
)

type MemoryState struct {
	Hooks     map[string][]model.Webhook
	hooksMu   map[string]*sync.RWMutex // For each individual hook's slice
	hooksMuMu sync.RWMutex             // Mutex for managing the hooksMu map
}

func New() state.State {
	return &MemoryState{
		Hooks:   make(map[string][]model.Webhook),
		hooksMu: make(map[string]*sync.RWMutex),
	}
}

func (m *MemoryState) GetAndClear(user string) []model.Webhook {
	mu := m.getHookMutex(user)
	mu.Lock()
	defer mu.Unlock()

	if slice, exists := m.Hooks[user]; exists {
		m.Hooks[user] = []model.Webhook{}
		return slice
	}
	return []model.Webhook{}
}

func (m *MemoryState) Put(user string, webhook model.Webhook) {
	mu := m.getHookMutex(user)
	mu.Lock()
	defer mu.Unlock()

	if _, exists := m.Hooks[user]; !exists {
		m.Hooks[user] = []model.Webhook{}
	}
	m.Hooks[user] = append(m.Hooks[user], webhook)
}

func (m *MemoryState) getHookMutex(hook string) *sync.RWMutex {
	if mutex, exists := m.hooksMu[hook]; exists {
		return mutex
	}

	m.hooksMuMu.Lock()
	defer m.hooksMuMu.Unlock()

	if mutex, exists := m.hooksMu[hook]; exists {
		return mutex
	}
	m.hooksMu[hook] = &sync.RWMutex{}
	return m.hooksMu[hook]
}

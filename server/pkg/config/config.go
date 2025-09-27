package config

import (
	"context"
	"sync"

	"github.com/caarlos0/env/v10"
)

type Config struct {
	AdminToken   string `env:"ADMIN_TOKEN" envDefault:""`
	ClientID     string `env:"CLIENT_ID" required:"true"`
	ClientSecret string `env:"CLIENT_SECRET" required:"true"`
	HTTPPort     string `env:"HTTP_PORT" envDefault:"10000"`
	UsersFile    string `env:"USERS_FILE" envDefault:"/etc/secrets/users.txt"`

	Redis RedisConfig

	kickNameToID   map[string]string // Populated by Init
	kickNameToIDMu sync.RWMutex
	idToKickName   map[string]string // Populated by loadUsers
	idToKickNameMu sync.RWMutex
}

func New() *Config {
	return &Config{
		kickNameToID: make(map[string]string),
		idToKickName: make(map[string]string),
	}
}

func Init() (*Config, error) {
	cfg := New()
	if err := env.Parse(cfg); err != nil {
		return nil, err
	}

	// Parse Redis configuration
	if err := env.Parse(&cfg.Redis); err != nil {
		return nil, err
	}

	// Load the users from the specified users file
	if err := cfg.loadUsers(); err != nil {
		return nil, err
	}

	return cfg, nil
}

func WithConfig(ctx context.Context, cfg *Config) context.Context {
	return context.WithValue(ctx, configKey{}, cfg)
}

func FromContext(ctx context.Context) *Config {
	if cfg, ok := ctx.Value(configKey{}).(*Config); ok {
		return cfg
	}
	return nil
}

type configKey struct{}

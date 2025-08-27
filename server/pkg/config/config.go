package config

import (
	"bufio"
	"context"
	"os"
	"strings"

	"github.com/caarlos0/env/v10"
)

type Config struct {
	AdminToken   string            `env:"ADMIN_TOKEN" envDefault:""`
	ClientID     string            `env:"CLIENT_ID" required:"true"`
	ClientSecret string            `env:"CLIENT_SECRET" required:"true"`
	HTTPPort     string            `env:"HTTP_PORT" envDefault:"10000"`
	KickNameToID map[string]string // Populated by Init
	IDToKickName map[string]string // Populated by loadUsers
	UsersFile    string            `env:"USERS_FILE" envDefault:"/etc/secrets/users.txt"`
}

func Init() (*Config, error) {
	cfg := &Config{}
	if err := env.Parse(cfg); err != nil {
		return nil, err
	}

	// Load the users from the specified users file
	if err := cfg.loadUsers(); err != nil {
		return nil, err
	}

	// Reverse populate set of kick IDs so we reject any web hooks for unregistered users
	cfg.KickNameToID = make(map[string]string)
	for id, kickName := range cfg.IDToKickName {
		cfg.KickNameToID[strings.ToLower(kickName)] = id
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

func (cfg *Config) loadUsers() error {
	file, err := os.Open(cfg.UsersFile)
	if err != nil {
		return err
	}
	defer file.Close()

	users := make(map[string]string)
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := scanner.Text()
		parts := strings.SplitN(line, ":", 2)
		if len(parts) != 2 {
			continue
		}
		user := strings.TrimSpace(parts[0])
		kickName := strings.TrimSpace(parts[1])
		if strings.HasPrefix(user, "#") {
			continue
		}
		if user != "" && kickName != "" {
			users[user] = strings.ToLower(kickName)
		}
	}
	if err := scanner.Err(); err != nil {
		return err
	}

	cfg.IDToKickName = users
	return nil
}

type configKey struct{}

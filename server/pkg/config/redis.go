package config

import (
	"time"
)

type RedisConfig struct {
	URL            string        `env:"REDIS_URL" envDefault:""`
	SyncInterval   time.Duration `env:"REDIS_SYNC_INTERVAL" envDefault:"1s"`
	BatchSize      int           `env:"REDIS_BATCH_SIZE" envDefault:"100"`
	RetryAttempts  int           `env:"REDIS_RETRY_ATTEMPTS" envDefault:"3"`
	ConnectTimeout time.Duration `env:"REDIS_CONNECT_TIMEOUT" envDefault:"5s"`
	MaxRetries     int           `env:"REDIS_MAX_RETRIES" envDefault:"3"`
	DialTimeout    time.Duration `env:"REDIS_DIAL_TIMEOUT" envDefault:"5s"`
	ReadTimeout    time.Duration `env:"REDIS_READ_TIMEOUT" envDefault:"3s"`
	WriteTimeout   time.Duration `env:"REDIS_WRITE_TIMEOUT" envDefault:"3s"`
}

package main

import (
	"context"
	"mage-kick-webhook-proxy/pkg/config"
	"mage-kick-webhook-proxy/pkg/logger"
	"mage-kick-webhook-proxy/pkg/server"
	"mage-kick-webhook-proxy/pkg/state"
	"os"
	"os/signal"
	"sync"
)

func main() {
	ctx := context.Background()

	stop := make(chan struct{})
	ctx, cancel := context.WithCancel(ctx)

	go func() {
		sigChan := make(chan os.Signal, 2)
		signal.Notify(sigChan, os.Interrupt)
		for i := 0; ; i++ {
			<-sigChan
			if i == 0 {
				cancel()
				close(stop)
			} else {
				panic("Second CTRL+C received, force exiting")
			}
		}
	}()

	l := logger.New()
	ctx = logger.WithLogger(ctx, l)

	cfg, err := config.Init()
	if err != nil {
		l.WithError(err).Error("Failed to load configuration from environment variables")
		return
	}
	ctx = config.WithConfig(ctx, cfg)

	var wg sync.WaitGroup

	// Initialize state with Redis persistence if available, fallback to memory-only
	st := initializeState(ctx, cfg)
	defer func() {
		if closer, ok := st.(interface{ Close() error }); ok {
			if err := closer.Close(); err != nil {
				l.WithError(err).Error("Failed to close state store")
			}
		}
	}()

	svr := server.New(st)
	svr.Start(ctx, &wg)
	wg.Wait()
}

// initializeState creates the appropriate state implementation based on configuration
func initializeState(ctx context.Context, cfg *config.Config) state.State {
	l := logger.FromContext(ctx)

	// Try Redis persistence if URL is provided
	if cfg.Redis.URL != "" {
		l.Info("Initializing state with Redis persistence")

		redisState, err := state.NewWithRedis(ctx, cfg.Redis)
		if err != nil {
			l.WithError(err).Error("Failed to initialize Redis state, falling back to memory-only")
		} else {
			l.Info("Successfully initialized Redis-backed state")
			return redisState
		}
	}

	// Fallback to memory-only state
	l.Info("Using memory-only state (no persistence)")
	return state.New(ctx)
}

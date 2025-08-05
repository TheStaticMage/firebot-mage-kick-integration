package main

import (
	"context"
	"mage-kick-webhook-proxy/pkg/config"
	"mage-kick-webhook-proxy/pkg/logger"
	"mage-kick-webhook-proxy/pkg/server"
	"mage-kick-webhook-proxy/pkg/state/memory"
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

	st := memory.New()
	svr := server.New(st)
	svr.Start(ctx, &wg)
	wg.Wait()
}

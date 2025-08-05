package logger

import (
	"context"
	"os"

	"github.com/sirupsen/logrus"
)

type Logger struct {
	*logrus.Entry
}

type ctxKey struct{}

func New() *Logger {
	logger := logrus.New()
	levelStr := getenv("LOG_LEVEL", "info")
	level, err := logrus.ParseLevel(levelStr)
	if err != nil {
		level = logrus.InfoLevel
	}
	logger.SetLevel(level)
	return &Logger{logrus.NewEntry(logger)}
}

// getenv returns the value of the environment variable or the fallback if not set.
func getenv(key, fallback string) string {
	v := ""
	if val, ok := lookupEnv(key); ok {
		v = val
	}
	if v == "" {
		v = fallback
	}
	return v
}

// lookupEnv wraps os.LookupEnv for testability.
var lookupEnv = func(key string) (string, bool) {
	return getOsEnv(key)
}

// getOsEnv is separated for easier testing/mocking.
func getOsEnv(key string) (string, bool) {
	return os.LookupEnv(key)
}

func WithLogger(ctx context.Context, logger *Logger) context.Context {
	return context.WithValue(ctx, ctxKey{}, logger)
}

func FromContext(ctx context.Context) *Logger {
	if logger, ok := ctx.Value(ctxKey{}).(*Logger); ok {
		return logger
	}
	return New()
}

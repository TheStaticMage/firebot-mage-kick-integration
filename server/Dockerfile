# Build stage
FROM golang:1.25-alpine AS builder

# Install git and ca-certificates (needed for fetching dependencies)
RUN apk add --no-cache git ca-certificates

# Set the working directory
WORKDIR /app

# Copy go mod and sum files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy the source code
COPY . .

# Build the application with the specified flags
RUN go build -tags netgo -ldflags '-s -w' -o app

# Final stage
FROM alpine:latest

# Create a non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

# Set the working directory
WORKDIR /app

# Copy the binary from the builder stage
COPY --from=builder /app/app .

# Change ownership of the app to the non-root user
RUN chown appuser:appgroup app

# Switch to the non-root user
USER appuser

# Expose the port (adjust if your app uses a different port)
EXPOSE 10000

# Run the application
CMD ["./app"]

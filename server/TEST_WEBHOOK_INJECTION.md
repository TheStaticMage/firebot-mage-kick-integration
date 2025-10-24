# Test Webhook Injection

## Overview

The webhook proxy server now supports admin users injecting test webhook events directly through the main webhook endpoint. This allows for end-to-end testing of webhook functionality without requiring actual events from Kick's servers.

## Authentication

Test webhook injection requires **dual authentication**:

1. **Bearer Token**: Valid admin token in Authorization header
2. **Test Signature**: Special `Kick-Event-Signature: valid` header

Both are required - this prevents accidental test injections and provides security.

## Usage

### Basic Test Injection

```bash
curl -X POST http://localhost:8080/webhook \
  -H "Authorization: Bearer your-admin-token-here" \
  -H "Kick-Event-Type: kicks.gifted" \
  -H "Kick-Event-Signature: valid" \
  -H "Content-Type: application/json" \
  -d @test-payloads/webhook-kicks-gifted.json
```

### Headers Required for Test Injection

- `Authorization: Bearer <admin-token>` - Admin bearer token
- `Kick-Event-Signature: valid` - Special test signature (literal "valid")
- `Kick-Event-Type: <event-type>` - The webhook event type (e.g., "kicks.gifted")
- `Kick-Event-Version: <version>` (optional) - Defaults to "1" if not provided
- `Content-Type: application/json`

### Payload Format

The JSON payload should match the webhook event structure. For kicks.gifted:

```json
{
  "broadcaster": {
    "id": 2408714,
    "username": "thestaticmage",
    "slug": "thestaticmage"
  },
  "sender": {
    "id": 123456,
    "username": "testuser",
    "slug": "testuser"
  },
  "gift": {
    "amount": 10,
    "name": "HYPE",
    "type": "BASIC",
    "tier": "BASIC",
    "message": "Test gift message!"
  },
  "created_at": "2025-10-23T15:30:42Z"
}
```

## Test Event Markers

Test events are automatically marked with:
- `is_test_event: true`
- Generated test IDs for message and subscription
- Current timestamp

## Security Features

1. **Admin Only**: Only valid admin tokens can inject test webhooks
2. **Dual Auth**: Requires both bearer token AND special signature
3. **User Validation**: Broadcaster must be a registered user
4. **Test Marking**: Test events are clearly marked with `is_test_event: true`
5. **Separate Endpoint Logic**: Uses same endpoint but different processing path

## Error Responses

- `401 Unauthorized`: Invalid or missing admin token
- `400 Bad Request`: Missing headers, invalid payload, or unregistered user
- `500 Internal Server Error`: Server-side processing error

## Differences from Regular Injection

This method uses the main webhook endpoint (`/webhook`) with special headers, while the existing injection uses dedicated endpoints (`/inject/<key>`). Benefits:

1. **Full E2E Testing**: Tests complete webhook flow including authentication
2. **Real Webhook Processing**: Uses same parsing and validation as production
3. **Consistent Interface**: Same endpoint as production webhooks
4. **Security**: Dual authentication prevents misuse

## Example Test Scenarios

### Test kicks.gifted Webhook
```bash
# Test a 10-kick HYPE gift
curl -X POST http://localhost:8080/webhook \
  -H "Authorization: Bearer admin-token" \
  -H "Kick-Event-Type: kicks.gifted" \
  -H "Kick-Event-Signature: valid" \
  -H "Content-Type: application/json" \
  -d '{
    "broadcaster": {"id": 2408714, "username": "thestaticmage", "slug": "thestaticmage"},
    "sender": {"id": 123456, "username": "testuser", "slug": "testuser"},
    "gift": {"amount": 10, "name": "HYPE", "type": "BASIC", "tier": "BASIC", "message": "Test!"},
    "created_at": "2025-10-23T15:30:42Z"
  }'
```

### Success Response
```json
{
  "success": true,
  "test_injection": true
}
```

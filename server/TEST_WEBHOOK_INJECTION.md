# Test Webhook Injection

## Overview

Test webhook events can be injected directly into the integration for end-to-end testing. This is accomplished by sending a specially crafted webhook to the Crowbar Tools webhook relay URL.

## Authentication

Test webhook injection requires a cryptographic signature to verify the authenticity of the request. This prevents unauthorized test injections and ensures security.

The signature is generated using a private Ed25519 key and verified by the integration using the corresponding public key.

## Key Generation

First, you need to generate a private/public key pair. You can do this using `openssl`:

```bash
# Generate the private key
openssl genpkey -algorithm Ed25519 -out private_key.pem

# Extract the public key
openssl pkey -in private_key.pem -pubout -out public_key.pem
```

The `private_key.pem` file should be kept secret. The contents of `public_key.pem` need to be placed into the `src/constants.ts` file, replacing the placeholder key in the `IntegrationConstants.TEST_WEBHOOK_PUBLIC_KEY` constant.

## Usage

A Node.js script is provided to simplify sending test webhooks.

### Sending a Test Webhook

```bash
./scripts/send-test-webhook.mjs <webhook-url> <payload-file>
```

**Arguments:**

* `<webhook-url>`: The URL of the webhook as configured in the Crowbar Tools webhook relay.
* `<payload-file>`: The path to a JSON file containing the webhook payload.

**Example:**

```bash
./scripts/send-test-webhook.mjs https://api.crowbar.tools/... ./test-payloads/webhook-kicks-gifted.json
```

Before running the script, you may need to make it executable:

```bash
chmod +x ./scripts/send-test-webhook.mjs
```

### Webhook URL

The Crowbar Tools webhook URL for this integration can be found in Firebot at:
**Settings > Advanced > Proxied Webhooks > Edit Webhooks > kick-events**

## Security Features

1. **Cryptographic Signature**: Ensures that only authorized users can inject test webhooks.
2. **Configurable**: Test webhook injection can be enabled or disabled in the integration settings.
3. **Test Marking**: Test events are clearly marked with `is_test_event: true` in the integration's internal processing.

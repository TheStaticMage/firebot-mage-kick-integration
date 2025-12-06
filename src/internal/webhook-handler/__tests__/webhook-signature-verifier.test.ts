/* eslint-disable camelcase */
import { readFileSync } from 'fs';
import { join } from 'path';
import { createPrivateKey, sign, createSign } from 'crypto';
import { verifyWebhookSignature, WebhookSignatureVerificationError } from '../webhook-signature-verifier';

describe('verifyWebhookSignature', () => {
    const fixturesDir = join(__dirname, '..', '__fixtures__');
    const testPrivateKey = readFileSync(join(fixturesDir, 'test-webhook-ed25519-private.pem'), 'utf-8');
    const testPublicKey = readFileSync(join(fixturesDir, 'test-webhook-ed25519-public.pem'), 'utf-8');
    const prodPrivateKey = readFileSync(join(fixturesDir, 'production-webhook-rsa-private.pem'), 'utf-8');
    const prodPublicKey = readFileSync(join(fixturesDir, 'production-webhook-rsa-public.pem'), 'utf-8');

    function signTestWebhook(payload: any): string {
        const key = createPrivateKey(testPrivateKey);
        const payloadString = JSON.stringify(payload);
        return sign(null, Buffer.from(payloadString), key).toString('hex');
    }

    function signProductionWebhook(payload: any, messageId: string, timestamp: string): string {
        const signatureInput = `${messageId}.${timestamp}.${JSON.stringify(payload)}`;
        const signer = createSign('SHA256');
        signer.update(signatureInput);
        return signer.sign(prodPrivateKey, 'base64');
    }

    describe('Production webhooks (test mode false)', () => {
        const basePayload = { content: 'Hello world' };
        const messageId = 'msg_12345';
        const timestamp = '2025-12-05T12:00:00Z';

        it('rejects webhook with no signature', () => {
            expect(() => {
                verifyWebhookSignature({
                    payload: basePayload,
                    headers: {
                        'kick-event-message-id': messageId,
                        'kick-event-message-timestamp': timestamp
                    },
                    allowTestWebhooks: false,
                    testWebhookPublicKey: testPublicKey,
                    productionWebhookPublicKey: prodPublicKey
                });
            }).toThrow(WebhookSignatureVerificationError);
            expect(() => {
                verifyWebhookSignature({
                    payload: basePayload,
                    headers: {
                        'kick-event-message-id': messageId,
                        'kick-event-message-timestamp': timestamp
                    },
                    allowTestWebhooks: false,
                    testWebhookPublicKey: testPublicKey,
                    productionWebhookPublicKey: prodPublicKey
                });
            }).toThrow('Missing kick-event-signature header');
        });

        it('rejects webhook with invalid signature', () => {
            expect(() => {
                verifyWebhookSignature({
                    payload: basePayload,
                    headers: {
                        'kick-event-signature': 'invalid-signature',
                        'kick-event-message-id': messageId,
                        'kick-event-message-timestamp': timestamp
                    },
                    allowTestWebhooks: false,
                    testWebhookPublicKey: testPublicKey,
                    productionWebhookPublicKey: prodPublicKey
                });
            }).toThrow(WebhookSignatureVerificationError);
            expect(() => {
                verifyWebhookSignature({
                    payload: basePayload,
                    headers: {
                        'kick-event-signature': 'invalid-signature',
                        'kick-event-message-id': messageId,
                        'kick-event-message-timestamp': timestamp
                    },
                    allowTestWebhooks: false,
                    testWebhookPublicKey: testPublicKey,
                    productionWebhookPublicKey: prodPublicKey
                });
            }).toThrow('Invalid production webhook signature');
        });

        it('accepts webhook with valid Kick signature', () => {
            const validSignature = signProductionWebhook(basePayload, messageId, timestamp);

            expect(() => {
                verifyWebhookSignature({
                    payload: basePayload,
                    headers: {
                        'kick-event-signature': validSignature,
                        'kick-event-message-id': messageId,
                        'kick-event-message-timestamp': timestamp
                    },
                    allowTestWebhooks: false,
                    testWebhookPublicKey: testPublicKey,
                    productionWebhookPublicKey: prodPublicKey
                });
            }).not.toThrow();
        });

        it('rejects webhook with missing message ID or timestamp', () => {
            const validSignature = signProductionWebhook(basePayload, messageId, timestamp);

            expect(() => {
                verifyWebhookSignature({
                    payload: basePayload,
                    headers: {
                        'kick-event-signature': validSignature,
                        'kick-event-message-timestamp': timestamp
                    },
                    allowTestWebhooks: false,
                    testWebhookPublicKey: testPublicKey,
                    productionWebhookPublicKey: prodPublicKey
                });
            }).toThrow('Missing message ID or timestamp');
        });
    });

    describe('Test webhooks (test mode true)', () => {
        const testPayload = { content: 'Test event', is_test_event: true };

        it('rejects test webhook with no signature', () => {
            expect(() => {
                verifyWebhookSignature({
                    payload: testPayload,
                    headers: {},
                    allowTestWebhooks: true,
                    testWebhookPublicKey: testPublicKey,
                    productionWebhookPublicKey: prodPublicKey
                });
            }).toThrow('Missing kick-event-signature header');
        });

        it('rejects test webhook with invalid signature', () => {
            expect(() => {
                verifyWebhookSignature({
                    payload: testPayload,
                    headers: {
                        'kick-event-signature': 'deadbeef'
                    },
                    allowTestWebhooks: true,
                    testWebhookPublicKey: testPublicKey,
                    productionWebhookPublicKey: prodPublicKey
                });
            }).toThrow('Invalid test webhook signature');
        });

        it('accepts test webhook with valid signature', () => {
            const validSignature = signTestWebhook(testPayload);

            expect(() => {
                verifyWebhookSignature({
                    payload: testPayload,
                    headers: {
                        'kick-event-signature': validSignature
                    },
                    allowTestWebhooks: true,
                    testWebhookPublicKey: testPublicKey,
                    productionWebhookPublicKey: prodPublicKey
                });
            }).not.toThrow();
        });

        it('rejects test webhook when test mode is disabled', () => {
            const validSignature = signTestWebhook(testPayload);

            expect(() => {
                verifyWebhookSignature({
                    payload: testPayload,
                    headers: {
                        'kick-event-signature': validSignature
                    },
                    allowTestWebhooks: false,
                    testWebhookPublicKey: testPublicKey,
                    productionWebhookPublicKey: prodPublicKey
                });
            }).toThrow('Test webhooks are disabled');
        });
    });

    describe('Edge cases', () => {
        it('rejects production webhook signed with wrong key', () => {
            const payload = { content: 'Test' };
            const messageId = 'msg_123';
            const timestamp = '2025-12-05T12:00:00Z';

            const wrongSignature = signTestWebhook(payload);

            expect(() => {
                verifyWebhookSignature({
                    payload,
                    headers: {
                        'kick-event-signature': wrongSignature,
                        'kick-event-message-id': messageId,
                        'kick-event-message-timestamp': timestamp
                    },
                    allowTestWebhooks: false,
                    testWebhookPublicKey: testPublicKey,
                    productionWebhookPublicKey: prodPublicKey
                });
            }).toThrow(WebhookSignatureVerificationError);
        });

        it('rejects webhook when payload is tampered', () => {
            const originalPayload = { content: 'Original' };
            const tamperedPayload = { content: 'Tampered' };
            const messageId = 'msg_123';
            const timestamp = '2025-12-05T12:00:00Z';

            const signature = signProductionWebhook(originalPayload, messageId, timestamp);

            expect(() => {
                verifyWebhookSignature({
                    payload: tamperedPayload,
                    headers: {
                        'kick-event-signature': signature,
                        'kick-event-message-id': messageId,
                        'kick-event-message-timestamp': timestamp
                    },
                    allowTestWebhooks: false,
                    testWebhookPublicKey: testPublicKey,
                    productionWebhookPublicKey: prodPublicKey
                });
            }).toThrow('Invalid production webhook signature');
        });
    });
});

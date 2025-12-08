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

    function signTestWebhook(rawPayload: string): string {
        const key = createPrivateKey(testPrivateKey);
        return sign(null, Buffer.from(rawPayload), key).toString('hex');
    }

    function signProductionWebhook(rawPayload: string, messageId: string, timestamp: string): string {
        const signatureInput = `${messageId}.${timestamp}.${rawPayload}`;
        const signer = createSign('SHA256');
        signer.update(signatureInput);
        return signer.sign(prodPrivateKey, 'base64');
    }

    describe('Production webhooks (test mode false)', () => {
        const basePayload = { content: 'Hello world' };
        const rawPayload = JSON.stringify(basePayload);
        const messageId = 'msg_12345';
        const timestamp = '2025-12-05T12:00:00Z';

        it('rejects webhook with no signature', () => {
            expect(() => {
                verifyWebhookSignature({
                    payload: basePayload,
                    rawPayload,
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
                    rawPayload,
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
                    rawPayload,
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
                    rawPayload,
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
            const validSignature = signProductionWebhook(rawPayload, messageId, timestamp);

            expect(() => {
                verifyWebhookSignature({
                    payload: basePayload,
                    rawPayload,
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
            const validSignature = signProductionWebhook(rawPayload, messageId, timestamp);

            expect(() => {
                verifyWebhookSignature({
                    payload: basePayload,
                    rawPayload,
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
        const rawTestPayload = JSON.stringify(testPayload);

        it('rejects test webhook with no signature', () => {
            expect(() => {
                verifyWebhookSignature({
                    payload: testPayload,
                    rawPayload: rawTestPayload,
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
                    rawPayload: rawTestPayload,
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
            const validSignature = signTestWebhook(rawTestPayload);

            expect(() => {
                verifyWebhookSignature({
                    payload: testPayload,
                    rawPayload: rawTestPayload,
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
            const validSignature = signTestWebhook(rawTestPayload);

            expect(() => {
                verifyWebhookSignature({
                    payload: testPayload,
                    rawPayload: rawTestPayload,
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
            const rawPayload = JSON.stringify(payload);
            const messageId = 'msg_123';
            const timestamp = '2025-12-05T12:00:00Z';

            const wrongSignature = signTestWebhook(rawPayload);

            expect(() => {
                verifyWebhookSignature({
                    payload,
                    rawPayload,
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
            const originalRawPayload = JSON.stringify(originalPayload);
            const tamperedPayload = { content: 'Tampered' };
            const tamperedRawPayload = JSON.stringify(tamperedPayload);
            const messageId = 'msg_123';
            const timestamp = '2025-12-05T12:00:00Z';

            const signature = signProductionWebhook(originalRawPayload, messageId, timestamp);

            expect(() => {
                verifyWebhookSignature({
                    payload: tamperedPayload,
                    rawPayload: tamperedRawPayload,
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

    describe('Unicode escape sequences', () => {
        describe('Production webhooks with \\u0026 vs &', () => {
            const messageId = 'msg_unicode_test';
            const timestamp = '2025-12-05T12:00:00Z';

            it('accepts webhook when rawPayload has \\u0026 and signature matches \\u0026', () => {
                const payload = { content: 'Hello & World' };
                const rawPayloadWithUnicode = '{"content":"Hello \\u0026 World"}';
                const signature = signProductionWebhook(rawPayloadWithUnicode, messageId, timestamp);

                expect(() => {
                    verifyWebhookSignature({
                        payload,
                        rawPayload: rawPayloadWithUnicode,
                        headers: {
                            'kick-event-signature': signature,
                            'kick-event-message-id': messageId,
                            'kick-event-message-timestamp': timestamp
                        },
                        allowTestWebhooks: false,
                        testWebhookPublicKey: testPublicKey,
                        productionWebhookPublicKey: prodPublicKey
                    });
                }).not.toThrow();
            });

            it('rejects webhook when rawPayload has & but signature was created with \\u0026', () => {
                const payload = { content: 'Hello & World' };
                const rawPayloadWithUnicode = '{"content":"Hello \\u0026 World"}';
                const rawPayloadWithAmpersand = '{"content":"Hello & World"}';
                const signature = signProductionWebhook(rawPayloadWithUnicode, messageId, timestamp);

                expect(() => {
                    verifyWebhookSignature({
                        payload,
                        rawPayload: rawPayloadWithAmpersand,
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

            it('accepts webhook when rawPayload has & and signature matches &', () => {
                const payload = { content: 'Hello & World' };
                const rawPayloadWithAmpersand = '{"content":"Hello & World"}';
                const signature = signProductionWebhook(rawPayloadWithAmpersand, messageId, timestamp);

                expect(() => {
                    verifyWebhookSignature({
                        payload,
                        rawPayload: rawPayloadWithAmpersand,
                        headers: {
                            'kick-event-signature': signature,
                            'kick-event-message-id': messageId,
                            'kick-event-message-timestamp': timestamp
                        },
                        allowTestWebhooks: false,
                        testWebhookPublicKey: testPublicKey,
                        productionWebhookPublicKey: prodPublicKey
                    });
                }).not.toThrow();
            });

            it('rejects webhook when rawPayload has \\u0026 but signature was created with &', () => {
                const payload = { content: 'Hello & World' };
                const rawPayloadWithAmpersand = '{"content":"Hello & World"}';
                const rawPayloadWithUnicode = '{"content":"Hello \\u0026 World"}';
                const signature = signProductionWebhook(rawPayloadWithAmpersand, messageId, timestamp);

                expect(() => {
                    verifyWebhookSignature({
                        payload,
                        rawPayload: rawPayloadWithUnicode,
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

        describe('Test webhooks with \\u0026 vs &', () => {
            it('accepts test webhook when rawPayload has \\u0026 and signature matches \\u0026', () => {
                const payload = { content: 'Hello & World', is_test_event: true };
                const rawPayloadWithUnicode = '{"content":"Hello \\u0026 World","is_test_event":true}';
                const signature = signTestWebhook(rawPayloadWithUnicode);

                expect(() => {
                    verifyWebhookSignature({
                        payload,
                        rawPayload: rawPayloadWithUnicode,
                        headers: {
                            'kick-event-signature': signature
                        },
                        allowTestWebhooks: true,
                        testWebhookPublicKey: testPublicKey,
                        productionWebhookPublicKey: prodPublicKey
                    });
                }).not.toThrow();
            });

            it('rejects test webhook when rawPayload has & but signature was created with \\u0026', () => {
                const payload = { content: 'Hello & World', is_test_event: true };
                const rawPayloadWithUnicode = '{"content":"Hello \\u0026 World","is_test_event":true}';
                const rawPayloadWithAmpersand = '{"content":"Hello & World","is_test_event":true}';
                const signature = signTestWebhook(rawPayloadWithUnicode);

                expect(() => {
                    verifyWebhookSignature({
                        payload,
                        rawPayload: rawPayloadWithAmpersand,
                        headers: {
                            'kick-event-signature': signature
                        },
                        allowTestWebhooks: true,
                        testWebhookPublicKey: testPublicKey,
                        productionWebhookPublicKey: prodPublicKey
                    });
                }).toThrow('Invalid test webhook signature');
            });

            it('accepts test webhook when rawPayload has & and signature matches &', () => {
                const payload = { content: 'Hello & World', is_test_event: true };
                const rawPayloadWithAmpersand = '{"content":"Hello & World","is_test_event":true}';
                const signature = signTestWebhook(rawPayloadWithAmpersand);

                expect(() => {
                    verifyWebhookSignature({
                        payload,
                        rawPayload: rawPayloadWithAmpersand,
                        headers: {
                            'kick-event-signature': signature
                        },
                        allowTestWebhooks: true,
                        testWebhookPublicKey: testPublicKey,
                        productionWebhookPublicKey: prodPublicKey
                    });
                }).not.toThrow();
            });

            it('rejects test webhook when rawPayload has \\u0026 but signature was created with &', () => {
                const payload = { content: 'Hello & World', is_test_event: true };
                const rawPayloadWithAmpersand = '{"content":"Hello & World","is_test_event":true}';
                const rawPayloadWithUnicode = '{"content":"Hello \\u0026 World","is_test_event":true}';
                const signature = signTestWebhook(rawPayloadWithAmpersand);

                expect(() => {
                    verifyWebhookSignature({
                        payload,
                        rawPayload: rawPayloadWithUnicode,
                        headers: {
                            'kick-event-signature': signature
                        },
                        allowTestWebhooks: true,
                        testWebhookPublicKey: testPublicKey,
                        productionWebhookPublicKey: prodPublicKey
                    });
                }).toThrow('Invalid test webhook signature');
            });
        });
    });
});

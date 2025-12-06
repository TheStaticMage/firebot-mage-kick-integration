import { createPublicKey, createVerify, verify } from 'crypto';

export interface WebhookVerificationInput {
    payload: any;
    headers: {
        'kick-event-signature'?: string;
        'kick-event-message-id'?: string;
        'kick-event-message-timestamp'?: string;
    };
    allowTestWebhooks: boolean;
    testWebhookPublicKey: string;
    productionWebhookPublicKey: string;
}

export class WebhookSignatureVerificationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'WebhookSignatureVerificationError';
    }
}

export function verifyWebhookSignature(input: WebhookVerificationInput): void {
    const { payload, headers, allowTestWebhooks, testWebhookPublicKey, productionWebhookPublicKey } = input;
    const signature = headers['kick-event-signature'];
    const messageId = headers['kick-event-message-id'];
    const timestamp = headers['kick-event-message-timestamp'];

    if (!signature) {
        throw new WebhookSignatureVerificationError('Missing kick-event-signature header');
    }

    const isTestEvent = payload.is_test_event === true;

    if (isTestEvent && !allowTestWebhooks) {
        throw new WebhookSignatureVerificationError('Test webhooks are disabled');
    }

    try {
        if (isTestEvent) {
            verifyTestWebhookSignature({ payload, signature, testWebhookPublicKey });
        } else {
            verifyProductionWebhookSignature({
                payload,
                signature,
                messageId,
                timestamp,
                productionWebhookPublicKey
            });
        }
    } catch (error) {
        if (error instanceof WebhookSignatureVerificationError) {
            throw error;
        }
        throw new WebhookSignatureVerificationError(`Signature verification failed: ${error}`);
    }
}

function verifyTestWebhookSignature(params: {
    payload: any;
    signature: string;
    testWebhookPublicKey: string;
}): void {
    const { payload, signature, testWebhookPublicKey } = params;
    const publicKey = createPublicKey({
        key: testWebhookPublicKey,
        format: 'pem'
    });
    const payloadString = JSON.stringify(payload);
    const isValid = verify(null, Buffer.from(payloadString), publicKey, Buffer.from(signature, 'hex'));

    if (!isValid) {
        throw new WebhookSignatureVerificationError('Invalid test webhook signature');
    }
}

function verifyProductionWebhookSignature(params: {
    payload: any;
    signature: string;
    messageId?: string;
    timestamp?: string;
    productionWebhookPublicKey: string;
}): void {
    const { payload, signature, messageId, timestamp, productionWebhookPublicKey } = params;

    if (!messageId || !timestamp) {
        throw new WebhookSignatureVerificationError('Missing message ID or timestamp for production webhook');
    }

    const signatureInput = `${messageId}.${timestamp}.${JSON.stringify(payload)}`;
    const verifier = createVerify('SHA256');
    verifier.update(signatureInput);
    const isValid = verifier.verify(productionWebhookPublicKey, Buffer.from(signature, 'base64'));

    if (!isValid) {
        throw new WebhookSignatureVerificationError('Invalid production webhook signature');
    }
}

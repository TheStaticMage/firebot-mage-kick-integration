#!/usr/bin/env node

import { createPrivateKey, sign } from 'crypto';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';
import { exit } from 'process';

const gitRoot = execSync('git rev-parse --show-toplevel').toString().trim();
const privateKeyPath = join(gitRoot, 'private_key.pem');

async function main() {
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.error('Usage: ./send-test-webhook.mjs <webhook-url> <payload-file>');
        exit(1);
    }

    const webhookUrl = args[0];
    const payloadFile = args[1];

    let privateKey;
    try {
        privateKey = readFileSync(privateKeyPath, 'utf-8');
    } catch (e) {
        console.error(`Could not read private key file: ${privateKeyPath}`);
        exit(1);
    }

    let payload;
    let payloadJson;
    let eventType;
    try {
        const rawPayload = readFileSync(payloadFile, 'utf-8');
        payloadJson = JSON.parse(rawPayload);

        // Support both kick_event_type (webhook format) and eventType (test payload format)
        eventType = payloadJson.kick_event_type || payloadJson.eventType;
        if (!eventType) {
            console.error('Payload file must contain a "kick_event_type" or "eventType" field.');
            exit(1);
        }

        // Normalize to kick_event_type if using eventType
        if (payloadJson.eventType && !payloadJson.kick_event_type) {
            payloadJson.kick_event_type = payloadJson.eventType;
            delete payloadJson.eventType;
        }

        // Mark as test event if not already marked
        if (!payloadJson.is_test_event) {
            payloadJson.is_test_event = true;
        }

        // Canonical JSON representation for signing (no whitespace)
        payload = JSON.stringify(payloadJson);
    } catch (e) {
        console.error(`Could not read or parse payload file: ${payloadFile}`);
        console.error(e);
        exit(1);
    }

    const key = createPrivateKey(privateKey);
    const signature = sign(null, Buffer.from(payload), key).toString('hex');

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer test', // This can be any non-empty string
        'Kick-Event-Type': eventType,
        'Kick-Event-Signature': signature,
        'Kick-Event-Version': '1',
        'Kick-Event-Message-ID': `msg_${Date.now()}`,
        'Kick-Event-Subscription-ID': `sub_${Date.now()}`,
        'Kick-Event-Message-Timestamp': new Date().toISOString(),
    };

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers,
            body: payload,
        });

        if (response.ok) {
            console.log('Webhook sent successfully!');
        } else {
            console.error(`Failed to send webhook: ${response.status} ${response.statusText}`);
            const body = await response.text();
            console.error(body);
        }
    } catch (e) {
        console.error(`Failed to send webhook: ${e}`);
    }
}

main();

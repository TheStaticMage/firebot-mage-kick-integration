/* eslint-disable camelcase */
import {
    parseChannelSubscriptionGiftsEvent,
    parseChannelSubscriptionNewEvent,
    parseChannelSubscriptionRenewalEvent
} from '../webhook-parsers';

describe('parseChannelSubscriptionNewEvent', () => {
    beforeAll(() => {
        jest.useFakeTimers().setSystemTime(new Date('2025-08-26T00:00:00Z'));
    });
    afterAll(() => {
        jest.useRealTimers();
    });
    it('parses a new subscription event', () => {
        const createdAt = '2025-08-26T10:00:00Z';
        const expiresAt = '2025-09-10T10:00:00Z'; // 15 days later
        const event = {
            broadcaster: { user_id: 1, username: 'broad', is_verified: true },
            subscriber: { user_id: 2, username: 'sub', is_verified: false },
            duration: 3,
            created_at: createdAt,
            expires_at: expiresAt
        };
        const encoded = Buffer.from(JSON.stringify(event), 'utf-8').toString('base64');
        const result = parseChannelSubscriptionNewEvent(encoded);
        expect(result.broadcaster.username).toBe('broad');
        expect(result.subscriber.username).toBe('sub');
        expect(result.duration).toBe(3);
        expect(result.isResub).toBe(false);
        expect(result.createdAt).toEqual(new Date(createdAt));
        expect(result.expiresAt).toEqual(new Date(expiresAt));
    });

    it('uses default dates if created_at and expires_at are invalid', () => {
        const event = {
            broadcaster: { user_id: 1, username: 'broad', is_verified: true },
            subscriber: { user_id: 2, username: 'sub', is_verified: false },
            duration: 3,
            created_at: 'not-a-date',
            expires_at: 'not-a-date'
        };
        const encoded = Buffer.from(JSON.stringify(event), 'utf-8').toString('base64');
        const result = parseChannelSubscriptionNewEvent(encoded);
        expect(result.createdAt).toEqual(new Date('2025-08-26T00:00:00Z'));
        expect(result.expiresAt).toEqual(new Date('2025-09-25T00:00:00Z'));
    });
});

describe('parseChannelSubscriptionRenewalEvent', () => {
    beforeAll(() => {
        jest.useFakeTimers().setSystemTime(new Date('2025-08-26T00:00:00Z'));
    });
    afterAll(() => {
        jest.useRealTimers();
    });
    it('parses a renewal event', () => {
        const createdAt = '2025-08-26T11:00:00Z';
        const expiresAt = '2025-09-10T11:00:00Z'; // 15 days later
        const event = {
            broadcaster: { user_id: 1, username: 'broad', is_verified: true },
            subscriber: { user_id: 2, username: 'sub', is_verified: false },
            duration: 5,
            created_at: createdAt,
            expires_at: expiresAt
        };
        const encoded = Buffer.from(JSON.stringify(event), 'utf-8').toString('base64');
        const result = parseChannelSubscriptionRenewalEvent(encoded);
        expect(result.broadcaster.username).toBe('broad');
        expect(result.subscriber.username).toBe('sub');
        expect(result.duration).toBe(5);
        expect(result.isResub).toBe(true);
        expect(result.createdAt).toEqual(new Date(createdAt));
        expect(result.expiresAt).toEqual(new Date(expiresAt));
    });

    it('uses default dates if created_at and expires_at are invalid', () => {
        const event = {
            broadcaster: { user_id: 1, username: 'broad', is_verified: true },
            subscriber: { user_id: 2, username: 'sub', is_verified: false },
            duration: 5,
            created_at: 'not-a-date',
            expires_at: 'not-a-date'
        };
        const encoded = Buffer.from(JSON.stringify(event), 'utf-8').toString('base64');
        const result = parseChannelSubscriptionRenewalEvent(encoded);
        expect(result.createdAt).toEqual(new Date('2025-08-26T00:00:00Z'));
        expect(result.expiresAt).toEqual(new Date('2025-09-25T00:00:00Z'));
    });
});

describe('parseChannelSubscriptionGiftsEvent', () => {
    beforeAll(() => {
        jest.useFakeTimers().setSystemTime(new Date('2025-08-26T00:00:00Z'));
    });
    afterAll(() => {
        jest.useRealTimers();
    });
    it('parses a gift event', () => {
        const createdAt = '2025-08-26T12:00:00Z';
        const expiresAt = '2025-09-10T12:00:00Z'; // 15 days later
        const event = {
            broadcaster: { user_id: 1, username: 'broad', is_verified: true },
            gifter: { user_id: 3, username: 'gifter', is_verified: false },
            giftees: [
                { user_id: 4, username: 'gift1', is_verified: false },
                { user_id: 5, username: 'gift2', is_verified: false }
            ],
            created_at: createdAt,
            expires_at: expiresAt
        };
        const encoded = Buffer.from(JSON.stringify(event), 'utf-8').toString('base64');
        const result = parseChannelSubscriptionGiftsEvent(encoded);
        expect(result.broadcaster.username).toBe('broad');
        expect(result.gifter.username).toBe('gifter');
        expect(result.giftees.map(u => u.username)).toEqual(['gift1', 'gift2']);
        expect(result.createdAt).toEqual(new Date(createdAt));
        expect(result.expiresAt).toEqual(new Date(expiresAt));
    });

    it('uses default dates if created_at and expires_at are invalid', () => {
        const event = {
            broadcaster: { user_id: 1, username: 'broad', is_verified: true },
            gifter: { user_id: 3, username: 'gifter', is_verified: false },
            giftees: [
                { user_id: 4, username: 'gift1', is_verified: false },
                { user_id: 5, username: 'gift2', is_verified: false }
            ],
            created_at: 'not-a-date',
            expires_at: 'not-a-date'
        };
        const encoded = Buffer.from(JSON.stringify(event), 'utf-8').toString('base64');
        const result = parseChannelSubscriptionGiftsEvent(encoded);
        expect(result.createdAt).toEqual(new Date('2025-08-26T00:00:00Z'));
        expect(result.expiresAt).toEqual(new Date('2025-09-25T00:00:00Z'));
    });
});

import Datastore from '@seald-io/nedb';
import { KickUserManager } from '../user-manager';
import { createMockKick } from '../mock-kick';

jest.mock('../../main', () => ({
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

describe('KickUserManager recordGifter and getGifter', () => {
    const fixedNow = new Date('2025-09-05T00:00:00Z');

    beforeAll(() => {
        jest.useFakeTimers();
        jest.setSystemTime(fixedNow);
    });

    afterAll(() => {
        jest.useRealTimers();
    });
    let mgr: KickUserManager;
    let inMemoryGiftDb: Datastore;
    const gifterId = 'gifter-1';
    const gifteeId1 = 'giftee-1';
    const gifteeId2 = 'giftee-2';
    const createdAt1 = new Date('2025-08-27T00:00:00Z');
    const expiresAt1 = new Date('2025-09-01T00:00:00Z');
    const createdAt2 = new Date('2025-09-02T00:00:00Z');
    const expiresAt2 = new Date('2025-09-10T00:00:00Z');

    beforeEach(async () => {
        mgr = new KickUserManager(createMockKick());
        inMemoryGiftDb = new Datastore();
        // @ts-expect-error: access protected for test
        mgr._giftDb = inMemoryGiftDb;
        await inMemoryGiftDb.loadDatabaseAsync();
    });

    it('records a single gift and does not retrieve it if expired', async () => {
        // expiresAt1 is 2025-09-01, fixedNow is 2025-09-05, so it should NOT be returned
        await mgr.recordGift(gifterId, gifteeId1, createdAt1, expiresAt1);
        const gifter = await mgr.getGifter(gifterId);
        expect(gifter.gifts).toHaveLength(0);
        expect(gifter.totalSubs).toBe(1);
    });

    it('returns gifts that have not expired', async () => {
        // expiresAt2 is 2025-09-10, fixedNow is 2025-09-05, so it should be returned
        await mgr.recordGift(gifterId, gifteeId2, createdAt2, expiresAt2);
        const gifter = await mgr.getGifter(gifterId);
        expect(gifter.gifts).toHaveLength(1);
        expect(gifter.gifts[0].userId).toBe(gifteeId2);
        expect(new Date(gifter.gifts[0].sub.createdAt).toISOString()).toBe(createdAt2.toISOString());
        expect(new Date(gifter.gifts[0].sub.expiresAt).toISOString()).toBe(expiresAt2.toISOString());
        expect(gifter.totalSubs).toBe(1);
    });

    it('records multiple gifts and only returns those that have not expired', async () => {
        // Add both gifts again for a clean test
        await mgr.recordGift(gifterId, gifteeId1, createdAt1, expiresAt1); // expired
        await mgr.recordGift(gifterId, gifteeId2, createdAt2, expiresAt2); // not expired
        const gifter = await mgr.getGifter(gifterId);
        // Only gifteeId2's gift should be present
        expect(gifter.gifts).toHaveLength(1);
        expect(gifter.gifts[0].userId).toBe(gifteeId2);
        expect(gifter.totalSubs).toBe(2);
    });

    it('returns an empty array if gifter has no gifts', async () => {
        const gifter = await mgr.getGifter('nonexistent-gifter');
        expect(gifter.gifts).toEqual([]);
        expect(gifter.totalSubs).toBe(0);
    });
});

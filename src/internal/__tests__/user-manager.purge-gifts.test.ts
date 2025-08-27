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

describe('KickUserManager purgeExpiredGiftSubs', () => {
    const gifterId2 = 'gifter-2';
    const gifteeId3 = 'giftee-3';
    const gifteeId4 = 'giftee-4';
    const createdAt3 = new Date('2025-08-20T00:00:00Z');
    const expiresAt3 = new Date('2025-08-25T00:00:00Z'); // expired
    const createdAt4 = new Date('2025-09-03T00:00:00Z');
    const expiresAt4 = new Date('2025-09-20T00:00:00Z'); // not expired
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
    const expiresAt1 = new Date('2025-09-01T00:00:00Z'); // expired
    const createdAt2 = new Date('2025-09-02T00:00:00Z');
    const expiresAt2 = new Date('2025-09-10T00:00:00Z'); // not expired

    beforeEach(async () => {
        mgr = new KickUserManager(createMockKick());
        inMemoryGiftDb = new Datastore();
        // @ts-expect-error: access protected for test
        mgr._giftDb = inMemoryGiftDb;
        await inMemoryGiftDb.loadDatabaseAsync();
    });

    it('removes only expired gifts from a gifter', async () => {
        // Insert a gifter with one expired and one non-expired gift
        await inMemoryGiftDb.insertAsync({
            _id: gifterId,
            gifts: [
                { _id: gifteeId1, sub: { createdAt: createdAt1, expiresAt: expiresAt1 } },
                { _id: gifteeId2, sub: { createdAt: createdAt2, expiresAt: expiresAt2 } }
            ],
            totalSubs: 2
        });
        await mgr['purgeExpiredGiftSubs']();
        const gifter = await inMemoryGiftDb.findOneAsync({ _id: gifterId });
        expect(gifter.gifts).toHaveLength(1);
        expect(gifter.gifts[0]._id).toBe(gifteeId2);
    });

    it('does not delete gifter record if all gifts are expired', async () => {
        await inMemoryGiftDb.insertAsync({
            _id: gifterId,
            gifts: [
                { _id: gifteeId1, sub: { createdAt: createdAt1, expiresAt: expiresAt1 } }
            ],
            totalSubs: 1
        });
        await mgr['purgeExpiredGiftSubs']();
        const gifter = await inMemoryGiftDb.findOneAsync({ _id: gifterId });
        expect(gifter).toBeTruthy();
        expect(gifter.gifts).toHaveLength(0);
    });

    it('deletes gifter record if gifts is empty and totalSubs is 0', async () => {
        await inMemoryGiftDb.insertAsync({
            _id: gifterId,
            gifts: [],
            totalSubs: 0
        });
        await mgr['purgeExpiredGiftSubs']();
        const gifter = await inMemoryGiftDb.findOneAsync({ _id: gifterId });
        expect(gifter).toBeNull();
    });

    it('does nothing if there are no gifters', async () => {
        await mgr['purgeExpiredGiftSubs']();
        const allGifters = await inMemoryGiftDb.findAsync({});
        expect(allGifters).toEqual([]);
    });

    it('removes expired gifts for multiple gifters and leaves all records', async () => {
        // gifter-1: one expired, one not expired
        // gifter-2: one expired, one not expired
        await inMemoryGiftDb.insertAsync({
            _id: gifterId,
            gifts: [
                { _id: gifteeId1, sub: { createdAt: createdAt1, expiresAt: expiresAt1 } },
                { _id: gifteeId2, sub: { createdAt: createdAt2, expiresAt: expiresAt2 } }
            ],
            totalSubs: 2
        });
        await inMemoryGiftDb.insertAsync({
            _id: gifterId2,
            gifts: [
                { _id: gifteeId3, sub: { createdAt: createdAt3, expiresAt: expiresAt3 } },
                { _id: gifteeId4, sub: { createdAt: createdAt4, expiresAt: expiresAt4 } }
            ],
            totalSubs: 2
        });
        await mgr['purgeExpiredGiftSubs']();
        const gifter1 = await inMemoryGiftDb.findOneAsync({ _id: gifterId });
        const gifter2 = await inMemoryGiftDb.findOneAsync({ _id: gifterId2 });
        expect(gifter1.gifts).toHaveLength(1);
        expect(gifter1.gifts[0]._id).toBe(gifteeId2);
        expect(gifter2.gifts).toHaveLength(1);
        expect(gifter2.gifts[0]._id).toBe(gifteeId4);
    });
});

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


class KickUserManagerTest extends KickUserManager {
    get db(): Datastore | null {
        return this._db;
    }

    get giftDb(): Datastore | null {
        return this._giftDb;
    }

    get subDb(): Datastore | null {
        return this._subDb;
    }
}

describe('KickUserManager recordSubscriber and getSubscriber', () => {
    const fixedNow = new Date('2025-08-27T00:00:00Z');

    beforeAll(() => {
        jest.useFakeTimers();
        jest.setSystemTime(fixedNow);
    });

    afterAll(() => {
        jest.useRealTimers();
    });

    let mgr: KickUserManagerTest;
    let inMemoryDb: Datastore;
    const userId = '12345678';
    const now = new Date('2025-08-27T00:00:00Z');
    const expires = new Date('2025-09-01T00:00:00Z');

    beforeEach(async () => {
        const mockKick = createMockKick();
        mgr = new KickUserManagerTest(mockKick);
        inMemoryDb = new Datastore();
        // @ts-expect-error: access protected for test
        mgr._subDb = inMemoryDb;
        await inMemoryDb.loadDatabaseAsync();
    });

    it('records and retrieves a non-expired subscriber', async () => {
        await mgr.recordSubscription(userId, now, expires);
        const rec = await mgr.getSubscriber(userId);
        expect(rec).toBeTruthy();
        expect(rec?.createdAt).toBeDefined();
        expect(rec?.expiresAt).toBeDefined();
        if (rec?.createdAt) {
            expect(rec.createdAt.toISOString()).toBe(now.toISOString());
        }
        if (rec?.expiresAt) {
            expect(rec.expiresAt.toISOString()).toBe(expires.toISOString());
        }
    });

    it('returns null for expired subscriber', async () => {
        const expired = new Date('2025-08-01T00:00:00Z');
        await mgr.recordSubscription(userId, now, expired);
        const rec = await mgr.getSubscriber(userId);
        expect(rec).toBeNull();
    });

    it('updates subscriber expiration if new expiresAt is later', async () => {
        await mgr.recordSubscription(userId, now, expires);
        const later = new Date('2025-09-10T00:00:00Z');
        await mgr.recordSubscription(userId, now, later);
        const rec = await mgr.getSubscriber(userId);
        expect(rec).toBeTruthy();
        expect(rec?.expiresAt.toISOString()).toBe(later.toISOString());
    });

    it('does not update subscriber expiration if new expiresAt is earlier', async () => {
        const later = new Date('2025-09-10T00:00:00Z');
        await mgr.recordSubscription(userId, now, later);
        const earlier = new Date('2025-09-01T00:00:00Z');
        await mgr.recordSubscription(userId, now, earlier);
        const rec = await mgr.getSubscriber(userId);
        expect(rec).toBeTruthy();
        expect(rec?.expiresAt.toISOString()).toBe(later.toISOString());
    });
});

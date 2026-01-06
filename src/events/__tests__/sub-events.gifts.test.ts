import { IntegrationConstants } from '../../constants';
import { ChannelGiftSubscription } from '../../shared/types';
import { handleChannelSubscriptionGiftsEvent, giftSubCache } from '../sub-events';

const mockTriggerEvent = jest.fn();
const mockLoggerDebug = jest.fn();
const mockLoggerWarn = jest.fn();
const mockGetOrCreateViewer = jest.fn().mockResolvedValue(undefined);
const mockRecordSubscription = jest.fn();
const mockRecordGift = jest.fn();
const mockUpdateLastSeen = jest.fn();
const mockGetSettings = jest.fn(() => ({ triggerTwitchEvents: { subGift: false } }));

jest.mock('../../integration', () => ({
    integration: {
        kick: {
            userManager: {
                getOrCreateViewer: (...args: any[]) => mockGetOrCreateViewer(...args),
                recordSubscription: (...args: any[]) => mockRecordSubscription(...args),
                recordGift: (...args: any[]) => mockRecordGift(...args),
                updateLastSeen: (...args: any[]) => mockUpdateLastSeen(...args)
            }
        },
        getSettings: () => mockGetSettings()
    }
}));

jest.mock('../../main', () => ({
    firebot: {
        modules: {
            eventManager: {
                triggerEvent: (...args: any[]) => mockTriggerEvent(...args)
            }
        },
        firebot: {
            settings: {
                getSetting: jest.fn()
            }
        }
    },
    logger: {
        debug: (...args: any[]) => mockLoggerDebug(...args),
        warn: (...args: any[]) => mockLoggerWarn(...args)
    }
}));

const { firebot } = require('../../main');

describe('handleChannelSubscriptionGiftsEvent', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGetSettings.mockReturnValue({ triggerTwitchEvents: { subGift: false } });
        giftSubCache.flushAll(); // Clear the deduplication cache between tests
    });

    it('handles anonymous gifter', async () => {
        const payload: ChannelGiftSubscription = {
            broadcaster: { userId: '1', username: 'broadcaster' },
            gifter: { userId: '2', username: 'anon', isAnonymous: true },
            giftees: [{ userId: '3', username: 'giftee' }],
            createdAt: new Date()
        } as any;
        await handleChannelSubscriptionGiftsEvent(payload);
        expect(mockTriggerEvent).toHaveBeenCalledWith(
            IntegrationConstants.INTEGRATION_ID,
            'subs-gifted',
            {
                gifterUsername: 'Anonymous@kick',
                gifterUserId: '',
                gifterUserDisplayName: 'Anonymous',
                isAnonymous: true,
                subPlan: 'kickDefault',
                giftSubMonths: 1,
                giftSubDuration: 1,
                gifteeUsername: 'giftee@kick',
                gifteeUserId: 'k3',
                gifteeUserDisplayName: 'giftee',
                platform: 'kick'
            }
        );
    });

    it('handles single giftee, IgnoreSubsequentSubEventsAfterCommunitySub false', async () => {
        firebot.firebot.settings.getSetting.mockReturnValue(false);
        const payload: ChannelGiftSubscription = {
            broadcaster: { userId: '1', username: 'broadcaster' },
            gifter: { userId: '2', username: 'gifter', isAnonymous: false },
            giftees: [{ userId: '3', username: 'giftee' }],
            createdAt: new Date()
        } as any;
        await handleChannelSubscriptionGiftsEvent(payload);
        expect(mockTriggerEvent).toHaveBeenCalledWith(
            IntegrationConstants.INTEGRATION_ID,
            'subs-gifted',
            {
                gifterUsername: 'gifter@kick',
                gifterUserId: 'k2',
                gifterUserDisplayName: 'gifter',
                isAnonymous: false,
                subPlan: 'kickDefault',
                giftSubMonths: 1,
                giftSubDuration: 1,
                gifteeUsername: 'giftee@kick',
                gifteeUserId: 'k3',
                gifteeUserDisplayName: 'giftee',
                platform: 'kick'
            }
        );
    });

    it('handles multiple giftees, IgnoreSubsequentSubEventsAfterCommunitySub false', async () => {
        firebot.firebot.settings.getSetting.mockReturnValue(false);
        const payload: ChannelGiftSubscription = {
            broadcaster: { userId: '1', username: 'broadcaster' },
            gifter: { userId: '2', username: 'gifter', isAnonymous: false },
            giftees: [
                { userId: '3', username: 'giftee1' },
                { userId: '4', username: 'giftee2' }
            ],
            createdAt: new Date()
        } as any;
        await handleChannelSubscriptionGiftsEvent(payload);
        expect(mockTriggerEvent).toHaveBeenCalledWith(
            IntegrationConstants.INTEGRATION_ID,
            'community-subs-gifted',
            {
                gifterUsername: 'gifter@kick',
                gifterUserId: 'k2',
                gifterUserDisplayName: 'gifter',
                isAnonymous: false,
                subCount: 2,
                subPlan: 'kickDefault',
                giftReceivers: [
                    { gifteeUsername: 'giftee1@kick', gifteeUserId: 'k3', gifteeUserDisplayName: 'giftee1', giftSubMonths: 1 },
                    { gifteeUsername: 'giftee2@kick', gifteeUserId: 'k4', gifteeUserDisplayName: 'giftee2', giftSubMonths: 1 }
                ],
                platform: 'kick'
            }
        );
        expect(mockTriggerEvent).toHaveBeenCalledWith(
            IntegrationConstants.INTEGRATION_ID,
            'subs-gifted',
            {
                gifterUsername: 'gifter@kick',
                gifterUserId: 'k2',
                gifterUserDisplayName: 'gifter',
                isAnonymous: false,
                subPlan: 'kickDefault',
                giftSubMonths: 1,
                giftSubDuration: 1,
                gifteeUsername: 'giftee1@kick',
                gifteeUserId: 'k3',
                gifteeUserDisplayName: 'giftee1',
                platform: 'kick'
            }
        );
        expect(mockTriggerEvent).toHaveBeenCalledWith(
            IntegrationConstants.INTEGRATION_ID,
            'subs-gifted',
            {
                gifterUsername: 'gifter@kick',
                gifterUserId: 'k2',
                gifterUserDisplayName: 'gifter',
                isAnonymous: false,
                subPlan: 'kickDefault',
                giftSubMonths: 1,
                giftSubDuration: 1,
                gifteeUsername: 'giftee2@kick',
                gifteeUserId: 'k4',
                gifteeUserDisplayName: 'giftee2',
                platform: 'kick'
            }
        );
    });

    it('handles multiple giftees, IgnoreSubsequentSubEventsAfterCommunitySub true', async () => {
        firebot.firebot.settings.getSetting.mockReturnValue(true);
        const payload: ChannelGiftSubscription = {
            broadcaster: { userId: '1', username: 'broadcaster' },
            gifter: { userId: '2', username: 'gifter', isAnonymous: false },
            giftees: [
                { userId: '3', username: 'giftee1' },
                { userId: '4', username: 'giftee2' }
            ],
            createdAt: new Date()
        } as any;
        await handleChannelSubscriptionGiftsEvent(payload);
        expect(mockTriggerEvent).toHaveBeenCalledWith(
            IntegrationConstants.INTEGRATION_ID,
            'community-subs-gifted',
            {
                gifterUsername: 'gifter@kick',
                gifterUserId: 'k2',
                gifterUserDisplayName: 'gifter',
                isAnonymous: false,
                subCount: 2,
                subPlan: 'kickDefault',
                giftReceivers: [
                    { gifteeUsername: 'giftee1@kick', gifteeUserId: 'k3', gifteeUserDisplayName: 'giftee1', giftSubMonths: 1 },
                    { gifteeUsername: 'giftee2@kick', gifteeUserId: 'k4', gifteeUserDisplayName: 'giftee2', giftSubMonths: 1 }
                ],
                platform: 'kick'
            }
        );
        // Should NOT trigger individual subs-gifted events
        expect(mockTriggerEvent).not.toHaveBeenCalledWith(
            IntegrationConstants.INTEGRATION_ID,
            'subs-gifted',
            {
                gifterUsername: 'gifter@kick',
                gifterUserId: 'k2',
                gifterUserDisplayName: 'gifter@kick',
                isAnonymous: false,
                subPlan: 'kickDefault',
                giftSubMonths: 1,
                giftSubDuration: 1,
                gifteeUsername: 'giftee1@kick',
                gifteeUserId: 'k3',
                gifteeUserDisplayName: 'giftee1@kick',
                platform: 'kick'
            }
        );
        expect(mockTriggerEvent).not.toHaveBeenCalledWith(
            IntegrationConstants.INTEGRATION_ID,
            'subs-gifted',
            {
                gifterUsername: 'gifter@kick',
                gifterUserId: 'k2',
                gifterUserDisplayName: 'gifter@kick',
                isAnonymous: false,
                subPlan: 'kickDefault',
                giftSubMonths: 1,
                giftSubDuration: 1,
                gifteeUsername: 'giftee2@kick',
                gifteeUserId: 'k4',
                gifteeUserDisplayName: 'giftee2@kick',
                platform: 'kick'
            }
        );
    });

    it('handles gifter with empty userId', async () => {
        const payload: ChannelGiftSubscription = {
            broadcaster: { userId: 'k1', username: 'broadcaster' },
            gifter: { userId: '', username: 'emptyuser', isAnonymous: false },
            giftees: [{ userId: 'k3', username: 'giftee' }],
            createdAt: new Date()
        } as any;

        await handleChannelSubscriptionGiftsEvent(payload);

        // Should skip getOrCreateViewer for gifter due to empty userId
        expect(mockGetOrCreateViewer).toHaveBeenCalledTimes(1); // Only for giftee
    });

    it('handles giftees with empty userIds', async () => {
        const payload: ChannelGiftSubscription = {
            broadcaster: { userId: '1', username: 'broadcaster' },
            gifter: { userId: '2', username: 'gifter', isAnonymous: false },
            giftees: [
                { userId: '', username: 'emptygiftee' },
                { userId: '4', username: 'validgiftee' }
            ],
            createdAt: new Date()
        } as any;

        await handleChannelSubscriptionGiftsEvent(payload);

        // Should only create viewer and record subscription for valid giftee
        expect(mockGetOrCreateViewer).toHaveBeenCalledTimes(2); // gifter + valid giftee
        expect(mockRecordSubscription).toHaveBeenCalledTimes(1); // only valid giftee
        expect(mockRecordGift).toHaveBeenCalledTimes(2); // called for each giftee (including empty userId)
    });

    it('triggers Twitch events when enabled', async () => {
        mockGetSettings.mockReturnValue({ triggerTwitchEvents: { subGift: true } });
        firebot.firebot.settings.getSetting.mockReturnValue(false);

        const payload: ChannelGiftSubscription = {
            broadcaster: { userId: '1', username: 'broadcaster' },
            gifter: { userId: '2', username: 'gifter', isAnonymous: false },
            giftees: [{ userId: '3', username: 'giftee' }],
            createdAt: new Date()
        } as any;

        await handleChannelSubscriptionGiftsEvent(payload);

        // Should trigger both Kick and Twitch events
        expect(mockTriggerEvent).toHaveBeenCalledWith(
            IntegrationConstants.INTEGRATION_ID,
            'subs-gifted',
            expect.any(Object)
        );
        expect(mockTriggerEvent).toHaveBeenCalledWith(
            'twitch',
            'subs-gifted',
            expect.any(Object)
        );
    });

    it('uses expiresAt when provided', async () => {
        const createdAt = new Date('2023-01-01');
        const expiresAt = new Date('2023-02-01');

        const payload: ChannelGiftSubscription = {
            broadcaster: { userId: '1', username: 'broadcaster' },
            gifter: { userId: '2', username: 'gifter', isAnonymous: false },
            giftees: [{ userId: '3', username: 'giftee' }],
            createdAt,
            expiresAt
        } as any;

        await handleChannelSubscriptionGiftsEvent(payload);

        expect(mockRecordSubscription).toHaveBeenCalledWith(
            '3',
            createdAt,
            expiresAt
        );
        expect(mockRecordGift).toHaveBeenCalledWith(
            '2',
            '3',
            createdAt,
            expiresAt
        );
    });

    it('calculates plusThirtyDays when expiresAt not provided', async () => {
        const createdAt = new Date('2023-01-01');
        const expectedExpiresAt = new Date('2023-01-31'); // 30 days later

        const payload: ChannelGiftSubscription = {
            broadcaster: { userId: '1', username: 'broadcaster' },
            gifter: { userId: '2', username: 'gifter', isAnonymous: false },
            giftees: [{ userId: '3', username: 'giftee' }],
            createdAt
        } as any;

        await handleChannelSubscriptionGiftsEvent(payload);

        expect(mockRecordSubscription).toHaveBeenCalledWith(
            '3',
            createdAt,
            expectedExpiresAt
        );
        expect(mockRecordGift).toHaveBeenCalledWith(
            '2',
            '3',
            createdAt,
            expectedExpiresAt
        );
    });

    it('handles mixed anonymous and non-anonymous scenarios', async () => {
        const payload: ChannelGiftSubscription = {
            broadcaster: { userId: '1', username: 'broadcaster' },
            gifter: { userId: '2', username: 'gifter', isAnonymous: true },
            giftees: [
                { userId: '3', username: 'giftee1' },
                { userId: '', username: 'emptygiftee' }
            ],
            createdAt: new Date()
        } as any;

        await handleChannelSubscriptionGiftsEvent(payload);

        // Should skip gifter due to anonymous, skip empty giftee, process valid giftee
        expect(mockGetOrCreateViewer).toHaveBeenCalledTimes(1); // only valid giftee
        expect(mockRecordSubscription).toHaveBeenCalledTimes(1); // only valid giftee
        expect(mockRecordGift).toHaveBeenCalledTimes(0); // no gifts recorded for anonymous gifter
    });

    it('verifies userManager method calls with correct parameters', async () => {
        const createdAt = new Date('2023-01-01');
        const payload: ChannelGiftSubscription = {
            broadcaster: { userId: '1', username: 'broadcaster' },
            gifter: { userId: '2', username: 'gifter', isAnonymous: false },
            giftees: [{ userId: '3', username: 'giftee' }],
            createdAt
        } as any;

        await handleChannelSubscriptionGiftsEvent(payload);

        // Verify all userManager calls
        expect(mockGetOrCreateViewer).toHaveBeenCalledWith(
            payload.gifter,
            [],
            true
        );
        expect(mockGetOrCreateViewer).toHaveBeenCalledWith(
            payload.giftees[0],
            [],
            true
        );
        expect(mockRecordSubscription).toHaveBeenCalledWith(
            '3',
            createdAt,
            expect.any(Date)
        );
        expect(mockRecordGift).toHaveBeenCalledWith(
            '2',
            '3',
            createdAt,
            expect.any(Date)
        );
    });

    it('deduplicates identical gift subscription events', async () => {
        const payload: ChannelGiftSubscription = {
            broadcaster: { userId: '1', username: 'broadcaster' },
            gifter: { userId: '2', username: 'gifter', isAnonymous: false },
            giftees: [{ userId: '3', username: 'giftee' }],
            createdAt: new Date('2023-01-01')
        } as any;

        // Process the same event twice
        await handleChannelSubscriptionGiftsEvent(payload);
        await handleChannelSubscriptionGiftsEvent(payload);

        // Should only trigger events once, not twice
        expect(mockTriggerEvent).toHaveBeenCalledTimes(1);
        expect(mockGetOrCreateViewer).toHaveBeenCalledTimes(2); // gifter + giftee, only once
        expect(mockRecordSubscription).toHaveBeenCalledTimes(1);
        expect(mockRecordGift).toHaveBeenCalledTimes(1);
    });

    it('handles partial deduplication in multi-giftee events', async () => {
        // First event: gifter -> [giftee1, giftee2]
        const firstPayload: ChannelGiftSubscription = {
            broadcaster: { userId: '1', username: 'broadcaster' },
            gifter: { userId: '2', username: 'gifter', isAnonymous: false },
            giftees: [
                { userId: '3', username: 'giftee1' },
                { userId: '4', username: 'giftee2' }
            ],
            createdAt: new Date('2023-01-01')
        } as any;

        // Second event: same gifter -> [giftee1 (duplicate), giftee3 (new)]
        const secondPayload: ChannelGiftSubscription = {
            broadcaster: { userId: '1', username: 'broadcaster' },
            gifter: { userId: '2', username: 'gifter', isAnonymous: false },
            giftees: [
                { userId: '3', username: 'giftee1' }, // duplicate
                { userId: '5', username: 'giftee3' } // new
            ],
            createdAt: new Date('2023-01-01')
        } as any;

        firebot.firebot.settings.getSetting.mockReturnValue(false);

        await handleChannelSubscriptionGiftsEvent(firstPayload);
        jest.clearAllMocks(); // Clear to count only second event
        await handleChannelSubscriptionGiftsEvent(secondPayload);

        // Should only process giftee3, not giftee1 (duplicate)
        expect(mockGetOrCreateViewer).toHaveBeenCalledTimes(2); // gifter + giftee3 only
        expect(mockRecordSubscription).toHaveBeenCalledTimes(1); // only giftee3
        expect(mockRecordGift).toHaveBeenCalledTimes(1); // only giftee3

        // Should trigger event for giftee3 only
        expect(mockTriggerEvent).toHaveBeenCalledWith(
            IntegrationConstants.INTEGRATION_ID,
            'subs-gifted',
            expect.objectContaining({
                gifteeUsername: 'giftee3@kick',
                gifteeUserId: 'k5'
            })
        );
    });

    it('handles anonymous gifter deduplication', async () => {
        const payload: ChannelGiftSubscription = {
            broadcaster: { userId: '1', username: 'broadcaster' },
            gifter: { userId: '2', username: 'anon', isAnonymous: true },
            giftees: [{ userId: '3', username: 'giftee' }],
            createdAt: new Date('2023-01-01')
        } as any;

        // Process the same anonymous gift twice
        await handleChannelSubscriptionGiftsEvent(payload);
        await handleChannelSubscriptionGiftsEvent(payload);

        // Should only trigger events once due to deduplication
        expect(mockTriggerEvent).toHaveBeenCalledTimes(1);
        expect(mockGetOrCreateViewer).toHaveBeenCalledTimes(1); // only giftee (gifter skipped for anonymous)
        expect(mockRecordSubscription).toHaveBeenCalledTimes(1);
        expect(mockRecordGift).toHaveBeenCalledTimes(0); // no gift records for anonymous
    });

    it('skips entire event when all giftees are duplicates', async () => {
        const payload: ChannelGiftSubscription = {
            broadcaster: { userId: '1', username: 'broadcaster' },
            gifter: { userId: '2', username: 'gifter', isAnonymous: false },
            giftees: [
                { userId: '3', username: 'giftee1' },
                { userId: '4', username: 'giftee2' }
            ],
            createdAt: new Date('2023-01-01')
        } as any;

        // Process the exact same event twice
        await handleChannelSubscriptionGiftsEvent(payload);
        jest.clearAllMocks();
        await handleChannelSubscriptionGiftsEvent(payload);

        // Second time should skip entirely
        expect(mockTriggerEvent).not.toHaveBeenCalled();
        expect(mockGetOrCreateViewer).not.toHaveBeenCalled();
        expect(mockRecordSubscription).not.toHaveBeenCalled();
        expect(mockRecordGift).not.toHaveBeenCalled();
    });
});

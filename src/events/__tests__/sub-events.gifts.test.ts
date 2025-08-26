import { handleChannelSubscriptionGiftsEvent } from '../sub-events';
import { IntegrationConstants } from '../../constants';
import { ChannelGiftSubscription } from '../../shared/types';

const mockGetViewerById = jest.fn().mockResolvedValue(undefined);
const mockCreateNewViewer = jest.fn().mockResolvedValue({ displayName: 'DisplayName' });
const mockTriggerEvent = jest.fn();
const mockLoggerDebug = jest.fn();
const mockLoggerWarn = jest.fn();

jest.mock('../../integration', () => ({
    integration: {
        kick: {
            userManager: {
                getViewerById: (...args: any[]) => mockGetViewerById(...args),
                createNewViewer: (...args: any[]) => mockCreateNewViewer(...args)
            }
        },
        getSettings: () => ({ triggerTwitchEvents: { subGift: false } })
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
    });

    it('handles anonymous gifter', async () => {
        const payload: ChannelGiftSubscription = {
            broadcaster: { userId: 'k1', username: 'broadcaster@kick' },
            gifter: { userId: 'k2', username: 'anon@kick', isAnonymous: true },
            giftees: [{ userId: 'k3', username: 'giftee@kick' }],
            createdAt: new Date()
        } as any;
        await handleChannelSubscriptionGiftsEvent(payload);
        expect(mockTriggerEvent).toHaveBeenCalledWith(
            IntegrationConstants.INTEGRATION_ID,
            'subs-gifted',
            {
                gifterUsername: 'Anonymous',
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
            broadcaster: { userId: 'k1', username: 'broadcaster@kick' },
            gifter: { userId: 'k2', username: 'gifter@kick', isAnonymous: false },
            giftees: [{ userId: 'k3', username: 'giftee@kick' }],
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
            broadcaster: { userId: 'k1', username: 'broadcaster@kick' },
            gifter: { userId: 'k2', username: 'gifter@kick', isAnonymous: false },
            giftees: [
                { userId: 'k3', username: 'giftee1@kick' },
                { userId: 'k4', username: 'giftee2@kick' }
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
            broadcaster: { userId: 'k1', username: 'broadcaster@kick' },
            gifter: { userId: 'k2', username: 'gifter@kick', isAnonymous: false },
            giftees: [
                { userId: 'k3', username: 'giftee1@kick' },
                { userId: 'k4', username: 'giftee2@kick' }
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
});

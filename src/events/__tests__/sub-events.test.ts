import { IntegrationConstants } from '../../constants';
import { ChannelSubscription } from '../../shared/types';
import { handleChannelSubscriptionEvent } from '../sub-events';

jest.mock('../../integration', () => ({
    integration: {
        kick: {
            userManager: {
                getOrCreateViewer: jest.fn().mockResolvedValue(undefined),
                recordSubscription: () => jest.fn(),
                recordGift: () => jest.fn(),
                updateLastSeen: jest.fn()
            }
        },
        getSettings: () => ({ triggerTwitchEvents: { sub: false } })
    }
}));

jest.mock('../../main', () => ({
    firebot: {
        modules: {
            eventManager: {
                triggerEvent: jest.fn()
            }
        }
    },
    logger: {
        warn: jest.fn()
    }
}));

const { firebot } = require('../../main');

describe('handleChannelSubscriptionEvent', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('triggers event with isResub=false', async () => {
        const payload: ChannelSubscription = {
            broadcaster: {
                userId: 'k1',
                username: 'broadcaster@kick',
                displayName: '',
                isVerified: false,
                profilePicture: '',
                channelSlug: ''
            },
            subscriber: {
                userId: 'k2',
                username: 'subscriber@kick',
                displayName: '',
                isVerified: false,
                profilePicture: '',
                channelSlug: ''
            },
            duration: 1,
            isResub: false,
            createdAt: new Date()
        };
        await handleChannelSubscriptionEvent(payload as any);
        expect(firebot.modules.eventManager.triggerEvent).toHaveBeenCalledWith(
            IntegrationConstants.INTEGRATION_ID,
            'sub',
            expect.objectContaining({
                isResub: false,
                username: 'subscriber@kick',
                userId: 'k2',
                userDisplayName: 'subscriber',
                subPlan: 'kickDefault',
                totalMonths: 1,
                subMessage: '',
                streak: 1,
                isPrime: false,
                platform: 'kick'
            })
        );
    });

    it('triggers event with isResub=true', async () => {
        const payload: ChannelSubscription = {
            broadcaster: {
                userId: 'k1',
                username: 'broadcaster@kick',
                displayName: '',
                isVerified: false,
                profilePicture: '',
                channelSlug: ''
            },
            subscriber: {
                userId: 'k2',
                username: 'subscriber@kick',
                displayName: '',
                isVerified: false,
                profilePicture: '',
                channelSlug: ''
            },
            duration: 69,
            isResub: true,
            createdAt: new Date()
        };
        await handleChannelSubscriptionEvent(payload as any);
        expect(firebot.modules.eventManager.triggerEvent).toHaveBeenCalledWith(
            IntegrationConstants.INTEGRATION_ID,
            'sub',
            expect.objectContaining({
                isResub: true,
                username: 'subscriber@kick',
                userId: 'k2',
                userDisplayName: 'subscriber',
                subPlan: 'kickDefault',
                totalMonths: 69,
                subMessage: '',
                streak: 69,
                isPrime: false,
                platform: 'kick'
            })
        );
    });
});

import { IntegrationConstants } from '../../constants';
import { handleMessageDeletedEvent } from '../message-deleted';

jest.mock('../../integration', () => ({
    integration: {
        kick: {
            chatManager: {
                getChatMessage: jest.fn(),
                forgetMessage: jest.fn()
            }
        },
        getSettings: jest.fn(() => ({ triggerTwitchEvents: { chatMessage: false } }))
    }
}));

jest.mock('../../main', () => ({
    firebot: {
        modules: {
            eventManager: {
                triggerEvent: jest.fn()
            },
            frontendCommunicator: {
                send: jest.fn()
            }
        }
    },
    logger: {
        debug: jest.fn()
    }
}));

const { integration } = require('../../integration');
const { firebot } = require('../../main');

describe('handleMessageDeletedEvent', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        integration.getSettings.mockReturnValue({ triggerTwitchEvents: { chatMessage: false } });
    });

    it('fires Kick event and cleans up when chat message is cached', async () => {
        const chatMessage = {
            id: 'kick-msg-1',
            username: 'kickuser',
            userId: 'k1',
            userDisplayName: 'KickUser',
            rawText: 'hello'
        } as any;

        integration.kick.chatManager.getChatMessage.mockReturnValue(chatMessage);

        await handleMessageDeletedEvent({
            id: 'evt-1',
            message: { id: 'kick-msg-1' },
            aiModerated: false,
            violatedRules: []
        });

        expect(firebot.modules.eventManager.triggerEvent).toHaveBeenCalledWith(
            IntegrationConstants.INTEGRATION_ID,
            'chat-message-deleted',
            expect.objectContaining({
                username: 'kickuser',
                userId: 'k1',
                userDisplayName: 'KickUser',
                messageText: 'hello',
                messageId: 'kick-msg-1'
            })
        );
        expect(firebot.modules.frontendCommunicator.send).toHaveBeenCalledWith(
            'twitch:chat:message:deleted',
            'kick-msg-1'
        );
        expect(integration.kick.chatManager.forgetMessage).toHaveBeenCalledWith('kick-msg-1');
    });

    it('fires Twitch event when enabled', async () => {
        const chatMessage = {
            id: 'kick-msg-1',
            username: 'kickuser',
            userId: 'k1',
            userDisplayName: 'KickUser',
            rawText: 'hello'
        } as any;

        integration.kick.chatManager.getChatMessage.mockReturnValue(chatMessage);

        integration.getSettings.mockReturnValue({ triggerTwitchEvents: { chatMessage: true } });

        await handleMessageDeletedEvent({
            id: 'evt-2',
            message: { id: 'kick-msg-2' },
            aiModerated: true,
            violatedRules: ['rule1']
        });

        expect(firebot.modules.eventManager.triggerEvent).toHaveBeenNthCalledWith(
            1,
            IntegrationConstants.INTEGRATION_ID,
            'chat-message-deleted',
            {
                username: 'kickuser',
                userId: 'k1',
                userDisplayName: 'KickUser',
                messageText: 'hello',
                messageId: 'kick-msg-2'
            }
        );
        expect(firebot.modules.eventManager.triggerEvent).toHaveBeenNthCalledWith(
            2,
            'twitch',
            'chat-message-deleted',
            {
                username: 'kickuser',
                userId: 'k1',
                userDisplayName: 'KickUser',
                messageText: 'hello',
                messageId: 'kick-msg-2'
            }
        );
    });
});

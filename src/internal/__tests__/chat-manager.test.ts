/* eslint-disable @typescript-eslint/unbound-method */
jest.mock('../../main', () => ({
    firebot: {
        modules: {
            frontendCommunicator: {
                onAsync: jest.fn()
            }
        }
    },
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));
jest.mock('../../variables/platform', () => ({
    platformVariable: {
        evaluator: jest.fn()
    }
}));

jest.mock('../kick', () => ({
    Kick: jest.fn()
}));

jest.mock('../../integration', () => ({
    integration: {
        getSettings: jest.fn()
    }
}));

import { integration } from '../../integration';
import { logger } from '../../main';
import { platformVariable } from '../../variables/platform';
import { ChatManager } from '../chat-manager';

describe('ChatManager', () => {
    let chatManager: ChatManager;
    let mockKick: any;

    beforeEach(() => {
        mockKick = {
            broadcaster: { userId: 'broadcasterId' },
            bot: { userId: 'botId' },
            httpCallWithTimeout: jest.fn().mockResolvedValue(undefined),
            getAuthToken: jest.fn().mockReturnValue('authToken'),
            getBotAuthToken: jest.fn().mockReturnValue('botAuthToken')
        };

        // Mock integration settings
        (integration.getSettings as jest.Mock).mockReturnValue({
            chat: { chatSend: true }
        });

        chatManager = new ChatManager(mockKick);

        // Start the chat manager to enable message handling
        chatManager.start();
    });

    it('registers and checks message platform', async () => {
        expect(await chatManager.registerMessage('msg1', 'kick')).toBe(true);
        expect(await chatManager.registerMessage('msg1', 'kick')).toBe(false);
    });

    it('splits and sends long messages in segments', async () => {
        const longMsg = 'a'.repeat(1200);
        const sendSpy = jest.spyOn<any, any>(chatManager, 'sendChatMessage').mockResolvedValue(undefined);
        await chatManager.sendKickChatMessage(longMsg, 'Streamer');
        expect(sendSpy).toHaveBeenCalledTimes(3);
    });

    it('does not send reply if replyToMessageId is not a kick message', async () => {
        const sendSpy = jest.spyOn<any, any>(chatManager, 'sendChatMessage').mockResolvedValue(undefined);
        // Register the message as a non-kick message
        await chatManager.registerMessage('notKickMsg', 'twitch');
        await chatManager.sendKickChatMessage('msg', 'Streamer', 'notKickMsg');
        expect(sendSpy).toHaveBeenCalledWith('msg', 'Streamer', undefined);
    });

    it('sends chat message as bot if bot is authorized', async () => {
        await chatManager['sendChatMessage']('msg', 'Bot');
        expect(mockKick.httpCallWithTimeout).toHaveBeenCalledWith(
            '/public/v1/chat', 'POST', expect.any(String), null, undefined, 'botAuthToken'
        );
    });

    it('falls back to streamer if bot is not authorized', async () => {
        mockKick.bot = undefined;
        const warnSpy = jest.spyOn(logger, 'warn');
        await chatManager['sendChatMessage']('msg', 'Bot');
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Falling back to streamer'));
        expect(mockKick.httpCallWithTimeout).toHaveBeenCalledWith(
            '/public/v1/chat', 'POST', expect.any(String), null, undefined, 'authToken'
        );
    });

    it('does not send if broadcaster is missing', async () => {
        mockKick.broadcaster = undefined;
        const errorSpy = jest.spyOn(logger, 'error');
        await chatManager['sendChatMessage']('msg', 'Streamer');
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('broadcaster info not available'));
    });

    it('adds and checks viewerArrivedCache', () => {
        expect(chatManager.checkViewerArrived('user1')).toBe(true);
        expect(chatManager.checkViewerArrived('user1')).toBe(false);
    });

    it('getPlatformFromTrigger returns platform or unknown', () => {
        (platformVariable.evaluator as jest.Mock).mockReturnValue('kick');
        expect(ChatManager.getPlatformFromTrigger({} as any)).toBe('kick');
        (platformVariable.evaluator as jest.Mock).mockImplementation(() => {
            throw new Error('fail');
        });
        expect(ChatManager.getPlatformFromTrigger({} as any)).toBe('unknown');
    });

    it('handles /announce slash command correctly', async () => {
        // Clear any previous calls
        jest.clearAllMocks();

        const payload = {
            message: "/announce test message",
            accountType: "Streamer" as const,
            replyToMessageId: undefined
        };

        const result = await chatManager['handleChatMessageTypedInChatFeed'](payload);

        expect(result).toBe(true);
        expect(mockKick.httpCallWithTimeout).toHaveBeenCalledWith(
            '/public/v1/chat',
            'POST',
            expect.stringContaining('[Announcement] test message'),
            null,
            undefined,
            'authToken'
        );

        // Verify the payload structure
        const httpCallArgs = mockKick.httpCallWithTimeout.mock.calls[0];
        const payloadString = httpCallArgs[2];
        const sentPayload = JSON.parse(payloadString);

        expect(sentPayload.content).toBe('[Announcement] test message');
        expect(sentPayload.type).toBe('user');
        expect(sentPayload.broadcaster_user_id).toBe('broadcasterId');
        expect(sentPayload.reply_to_message_id).toBeUndefined();
    });

    it('handles /announce slash command as Bot account', async () => {
        // Clear any previous calls
        jest.clearAllMocks();

        const payload = {
            message: "/announceblue bot announcement",
            accountType: "Bot" as const,
            replyToMessageId: undefined
        };

        const result = await chatManager['handleChatMessageTypedInChatFeed'](payload);

        expect(result).toBe(true);
        expect(mockKick.httpCallWithTimeout).toHaveBeenCalledWith(
            '/public/v1/chat',
            'POST',
            expect.stringContaining('[Announcement] bot announcement'),
            null,
            undefined,
            'botAuthToken'
        );
    });

    it('returns false for unsupported slash commands', async () => {
        // Clear any previous calls
        jest.clearAllMocks();

        const payload = {
            message: "/foo someuser",
            accountType: "Streamer" as const,
            replyToMessageId: undefined
        };

        const result = await chatManager['handleChatMessageTypedInChatFeed'](payload);

        expect(result).toBe(false);
        expect(mockKick.httpCallWithTimeout).not.toHaveBeenCalled();
        expect(logger.warn as jest.Mock).toHaveBeenCalledWith(expect.stringContaining('not implemented for Kick'));
    });

    it('handles slash command errors', async () => {
        // Clear any previous calls
        jest.clearAllMocks();

        const payload = {
            message: "/announce", // Missing message
            accountType: "Streamer" as const,
            replyToMessageId: undefined
        };

        const result = await chatManager['handleChatMessageTypedInChatFeed'](payload);

        expect(result).toBe(false);
        expect(mockKick.httpCallWithTimeout).not.toHaveBeenCalled();
        expect(logger.error as jest.Mock).toHaveBeenCalledWith(expect.stringContaining('Error handling slash command'));
    });
});

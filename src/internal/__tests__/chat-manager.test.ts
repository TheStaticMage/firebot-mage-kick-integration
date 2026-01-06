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
jest.mock('../platform-detection', () => ({
    getPlatformFromTrigger: jest.fn()
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
            getBotAuthToken: jest.fn().mockReturnValue('botAuthToken'),
            userApi: {
                banUserByUsername: jest.fn().mockResolvedValue(true)
            }
        };

        // Mock integration settings
        (integration.getSettings as jest.Mock).mockReturnValue({
            chat: { chatSend: true }
        });

        chatManager = new ChatManager(mockKick);

        // Start the chat manager to enable message handling
        chatManager.start();
    });

    afterEach(async () => {
        await chatManager.stop();
    });

    it('registers and checks message platform', async () => {
        expect(await chatManager.registerMessage('msg1', 'kick')).toBe(true);
        expect(await chatManager.registerMessage('msg1', 'kick')).toBe(false);
    });

    it('stores chat message metadata when provided', async () => {
        const chatMessage = {
            id: 'kick-msg-1',
            username: 'user@kick',
            userId: 'k123',
            userDisplayName: 'User',
            rawText: 'hello'
        } as any;

        await chatManager.registerMessage(chatMessage.id, 'kick', chatMessage);
        expect(chatManager.getChatMessage(chatMessage.id)).toBe(chatMessage);

        chatManager.forgetMessage(chatMessage.id);
        expect(chatManager.getChatMessage(chatMessage.id)).toBeUndefined();
        expect(chatManager['messageCacheOrder']).not.toContain(chatMessage.id);
    });

    it('evicts oldest cached messages beyond limit', async () => {
        for (let i = 0; i < 101; i++) {
            const chatMessage = {
                id: `kick-msg-${i}`,
                username: `user${i}@kick`
            } as any;
            await chatManager.registerMessage(chatMessage.id, 'kick', chatMessage);
        }

        expect(chatManager.getChatMessage('kick-msg-0')).toBeUndefined();
        expect(chatManager['messagePlatform']['kick-msg-0']).toBeUndefined();
        expect(chatManager['messageCacheOrder']).toHaveLength(100);
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
        const { getPlatformFromTrigger } = require('../platform-detection');
        (getPlatformFromTrigger as jest.Mock).mockReturnValue('kick');
        expect(ChatManager.getPlatformFromTrigger({} as any)).toBe('kick');
        (getPlatformFromTrigger as jest.Mock).mockImplementation(() => {
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

    it('handles /timeout command with duration conversion - values below 1 minute', async () => {
        // Clear any previous calls
        jest.clearAllMocks();
        mockKick.userApi.banUserByUsername.mockResolvedValue(true);

        // Test 30 seconds -> should round up to 1 minute
        const payload = {
            message: "/timeout testuser 30 test reason",
            accountType: "Streamer" as const,
            replyToMessageId: undefined
        };

        const result = await chatManager['handleChatMessageTypedInChatFeed'](payload);

        expect(result).toBe(true);
        expect(mockKick.userApi.banUserByUsername).toHaveBeenCalledWith('testuser', 1, true, 'test reason');
    });

    it('handles /timeout command with duration conversion - exact minutes', async () => {
        // Clear any previous calls
        jest.clearAllMocks();
        mockKick.userApi.banUserByUsername.mockResolvedValue(true);

        // Test 120 seconds -> should be exactly 2 minutes
        const payload = {
            message: "/timeout testuser 120",
            accountType: "Streamer" as const,
            replyToMessageId: undefined
        };

        const result = await chatManager['handleChatMessageTypedInChatFeed'](payload);

        expect(result).toBe(true);
        expect(mockKick.userApi.banUserByUsername).toHaveBeenCalledWith('testuser', 2, true, 'No reason given');
    });

    it('handles /timeout command with duration conversion - rounding to nearest minute', async () => {
        // Clear any previous calls
        jest.clearAllMocks();
        mockKick.userApi.banUserByUsername.mockResolvedValue(true);

        // Test 90 seconds -> should round to 2 minutes (90/60 = 1.5 -> rounds to 2)
        const payload = {
            message: "/timeout testuser 90 rounded reason",
            accountType: "Streamer" as const,
            replyToMessageId: undefined
        };

        const result = await chatManager['handleChatMessageTypedInChatFeed'](payload);

        expect(result).toBe(true);
        expect(mockKick.userApi.banUserByUsername).toHaveBeenCalledWith('testuser', 2, true, 'rounded reason');
    });

    it('handles /timeout command with duration conversion - rounding down', async () => {
        // Clear any previous calls
        jest.clearAllMocks();
        mockKick.userApi.banUserByUsername.mockResolvedValue(true);

        // Test 80 seconds -> should round to 1 minute (80/60 = 1.33 -> rounds to 1)
        const payload = {
            message: "/timeout testuser 80",
            accountType: "Streamer" as const,
            replyToMessageId: undefined
        };

        const result = await chatManager['handleChatMessageTypedInChatFeed'](payload);

        expect(result).toBe(true);
        expect(mockKick.userApi.banUserByUsername).toHaveBeenCalledWith('testuser', 1, true, 'No reason given');
    });

    it('throws error for /timeout command with duration exceeding maximum', async () => {
        // Clear any previous calls
        jest.clearAllMocks();

        // Test duration that exceeds 10800 minutes (648030 seconds = 10800.5 minutes -> rounds to 10801)
        const payload = {
            message: "/timeout testuser 648030 too long",
            accountType: "Streamer" as const,
            replyToMessageId: undefined
        };

        const result = await chatManager['handleChatMessageTypedInChatFeed'](payload);

        expect(result).toBe(false);
        expect(mockKick.userApi.banUserByUsername).not.toHaveBeenCalled();
        expect(logger.error as jest.Mock).toHaveBeenCalledWith(expect.stringContaining('Timeout duration cannot exceed 10800 minutes'));
    });

    it('handles /timeout command at maximum duration limit', async () => {
        // Clear any previous calls
        jest.clearAllMocks();
        mockKick.userApi.banUserByUsername.mockResolvedValue(true);

        // Test exactly 10800 minutes (648000 seconds)
        const payload = {
            message: "/timeout testuser 648000 max duration",
            accountType: "Streamer" as const,
            replyToMessageId: undefined
        };

        const result = await chatManager['handleChatMessageTypedInChatFeed'](payload);

        expect(result).toBe(true);
        expect(mockKick.userApi.banUserByUsername).toHaveBeenCalledWith('testuser', 10800, true, 'max duration');
    });

    it('handles /ban command successfully with reason', async () => {
        // Clear any previous calls
        jest.clearAllMocks();
        mockKick.userApi.banUserByUsername.mockResolvedValue(true);

        const payload = {
            message: "/ban baduser spamming chat",
            accountType: "Streamer" as const,
            replyToMessageId: undefined
        };

        const result = await chatManager['handleChatMessageTypedInChatFeed'](payload);

        expect(result).toBe(true);
        expect(mockKick.userApi.banUserByUsername).toHaveBeenCalledWith('baduser', 0, true, 'spamming chat');
    });

    it('handles /ban command successfully without reason', async () => {
        // Clear any previous calls
        jest.clearAllMocks();
        mockKick.userApi.banUserByUsername.mockResolvedValue(true);

        const payload = {
            message: "/ban baduser",
            accountType: "Streamer" as const,
            replyToMessageId: undefined
        };

        const result = await chatManager['handleChatMessageTypedInChatFeed'](payload);

        expect(result).toBe(true);
        expect(mockKick.userApi.banUserByUsername).toHaveBeenCalledWith('baduser', 0, true, 'No reason given');
    });

    it('throws error for /ban command with missing username', async () => {
        // Clear any previous calls
        jest.clearAllMocks();

        const payload = {
            message: "/ban",
            accountType: "Streamer" as const,
            replyToMessageId: undefined
        };

        const result = await chatManager['handleChatMessageTypedInChatFeed'](payload);

        expect(result).toBe(false);
        expect(mockKick.userApi.banUserByUsername).not.toHaveBeenCalled();
        expect(logger.error as jest.Mock).toHaveBeenCalledWith(expect.stringContaining('Usage: /ban <user> [reason]'));
    });

    it('throws error when /ban command API fails', async () => {
        // Clear any previous calls
        jest.clearAllMocks();
        mockKick.userApi.banUserByUsername.mockResolvedValue(false);

        const payload = {
            message: "/ban baduser reason",
            accountType: "Streamer" as const,
            replyToMessageId: undefined
        };

        const result = await chatManager['handleChatMessageTypedInChatFeed'](payload);

        expect(result).toBe(false);
        expect(mockKick.userApi.banUserByUsername).toHaveBeenCalledWith('baduser', 0, true, 'reason');
        expect(logger.error as jest.Mock).toHaveBeenCalledWith(expect.stringContaining('Failed to ban user: baduser'));
    });

    it('handles /unban command successfully', async () => {
        // Clear any previous calls
        jest.clearAllMocks();
        mockKick.userApi.banUserByUsername.mockResolvedValue(true);

        const payload = {
            message: "/unban testuser",
            accountType: "Streamer" as const,
            replyToMessageId: undefined
        };

        const result = await chatManager['handleChatMessageTypedInChatFeed'](payload);

        expect(result).toBe(true);
        expect(mockKick.userApi.banUserByUsername).toHaveBeenCalledWith('testuser', 0, false);
    });

    it('handles /untimeout command successfully', async () => {
        // Clear any previous calls
        jest.clearAllMocks();
        mockKick.userApi.banUserByUsername.mockResolvedValue(true);

        const payload = {
            message: "/untimeout testuser",
            accountType: "Streamer" as const,
            replyToMessageId: undefined
        };

        const result = await chatManager['handleChatMessageTypedInChatFeed'](payload);

        expect(result).toBe(true);
        expect(mockKick.userApi.banUserByUsername).toHaveBeenCalledWith('testuser', 0, false);
    });

    it('throws error for /unban command with missing username', async () => {
        // Clear any previous calls
        jest.clearAllMocks();

        const payload = {
            message: "/unban",
            accountType: "Streamer" as const,
            replyToMessageId: undefined
        };

        const result = await chatManager['handleChatMessageTypedInChatFeed'](payload);

        expect(result).toBe(false);
        expect(mockKick.userApi.banUserByUsername).not.toHaveBeenCalled();
        expect(logger.error as jest.Mock).toHaveBeenCalledWith(expect.stringContaining('Usage: /unban <user>'));
    });

    it('throws error for /untimeout command with missing username', async () => {
        // Clear any previous calls
        jest.clearAllMocks();

        const payload = {
            message: "/untimeout",
            accountType: "Streamer" as const,
            replyToMessageId: undefined
        };

        const result = await chatManager['handleChatMessageTypedInChatFeed'](payload);

        expect(result).toBe(false);
        expect(mockKick.userApi.banUserByUsername).not.toHaveBeenCalled();
        expect(logger.error as jest.Mock).toHaveBeenCalledWith(expect.stringContaining('Usage: /untimeout <user>'));
    });

    it('throws error when /unban command API fails', async () => {
        // Clear any previous calls
        jest.clearAllMocks();
        mockKick.userApi.banUserByUsername.mockResolvedValue(false);

        const payload = {
            message: "/unban testuser",
            accountType: "Streamer" as const,
            replyToMessageId: undefined
        };

        const result = await chatManager['handleChatMessageTypedInChatFeed'](payload);

        expect(result).toBe(false);
        expect(mockKick.userApi.banUserByUsername).toHaveBeenCalledWith('testuser', 0, false);
        expect(logger.error as jest.Mock).toHaveBeenCalledWith(expect.stringContaining('Failed to unban/untimeout user: testuser'));
    });

    it('throws error when /untimeout command API fails', async () => {
        // Clear any previous calls
        jest.clearAllMocks();
        mockKick.userApi.banUserByUsername.mockResolvedValue(false);

        const payload = {
            message: "/untimeout testuser",
            accountType: "Streamer" as const,
            replyToMessageId: undefined
        };

        const result = await chatManager['handleChatMessageTypedInChatFeed'](payload);

        expect(result).toBe(false);
        expect(mockKick.userApi.banUserByUsername).toHaveBeenCalledWith('testuser', 0, false);
        expect(logger.error as jest.Mock).toHaveBeenCalledWith(expect.stringContaining('Failed to unban/untimeout user: testuser'));
    });

    it('handles /announcegreen command correctly', async () => {
        // Clear any previous calls
        jest.clearAllMocks();

        const payload = {
            message: "/announcegreen This is a green announcement",
            accountType: "Streamer" as const,
            replyToMessageId: undefined
        };

        const result = await chatManager['handleChatMessageTypedInChatFeed'](payload);

        expect(result).toBe(true);
        expect(mockKick.httpCallWithTimeout).toHaveBeenCalledWith(
            '/public/v1/chat',
            'POST',
            expect.stringContaining('[Announcement] This is a green announcement'),
            null,
            undefined,
            'authToken'
        );
    });

    it('handles /announceorange command correctly', async () => {
        // Clear any previous calls
        jest.clearAllMocks();

        const payload = {
            message: "/announceorange Orange announcement here",
            accountType: "Bot" as const,
            replyToMessageId: undefined
        };

        const result = await chatManager['handleChatMessageTypedInChatFeed'](payload);

        expect(result).toBe(true);
        expect(mockKick.httpCallWithTimeout).toHaveBeenCalledWith(
            '/public/v1/chat',
            'POST',
            expect.stringContaining('[Announcement] Orange announcement here'),
            null,
            undefined,
            'botAuthToken'
        );
    });

    it('handles /announcepurple command correctly', async () => {
        // Clear any previous calls
        jest.clearAllMocks();

        const payload = {
            message: "/announcepurple Purple message test",
            accountType: "Streamer" as const,
            replyToMessageId: undefined
        };

        const result = await chatManager['handleChatMessageTypedInChatFeed'](payload);

        expect(result).toBe(true);
        expect(mockKick.httpCallWithTimeout).toHaveBeenCalledWith(
            '/public/v1/chat',
            'POST',
            expect.stringContaining('[Announcement] Purple message test'),
            null,
            undefined,
            'authToken'
        );
    });

    it('throws error for announcement commands with missing message', async () => {
        // Clear any previous calls
        jest.clearAllMocks();

        const payload = {
            message: "/announcegreen",
            accountType: "Streamer" as const,
            replyToMessageId: undefined
        };

        const result = await chatManager['handleChatMessageTypedInChatFeed'](payload);

        expect(result).toBe(false);
        expect(mockKick.httpCallWithTimeout).not.toHaveBeenCalled();
        expect(logger.error as jest.Mock).toHaveBeenCalledWith(expect.stringContaining('No message specified for /announcegreen command'));
    });

    it('throws error for /timeout command with invalid duration', async () => {
        // Clear any previous calls
        jest.clearAllMocks();

        const payload = {
            message: "/timeout testuser invalid",
            accountType: "Streamer" as const,
            replyToMessageId: undefined
        };

        const result = await chatManager['handleChatMessageTypedInChatFeed'](payload);

        expect(result).toBe(false);
        expect(mockKick.userApi.banUserByUsername).not.toHaveBeenCalled();
        expect(logger.error as jest.Mock).toHaveBeenCalledWith(expect.stringContaining('Duration must be a positive integer representing seconds'));
    });

    it('throws error for /timeout command with negative duration', async () => {
        // Clear any previous calls
        jest.clearAllMocks();

        const payload = {
            message: "/timeout testuser -60",
            accountType: "Streamer" as const,
            replyToMessageId: undefined
        };

        const result = await chatManager['handleChatMessageTypedInChatFeed'](payload);

        expect(result).toBe(false);
        expect(mockKick.userApi.banUserByUsername).not.toHaveBeenCalled();
        expect(logger.error as jest.Mock).toHaveBeenCalledWith(expect.stringContaining('Duration must be a positive integer representing seconds'));
    });

    it('throws error for /timeout command with zero duration', async () => {
        // Clear any previous calls
        jest.clearAllMocks();

        const payload = {
            message: "/timeout testuser 0",
            accountType: "Streamer" as const,
            replyToMessageId: undefined
        };

        const result = await chatManager['handleChatMessageTypedInChatFeed'](payload);

        expect(result).toBe(false);
        expect(mockKick.userApi.banUserByUsername).not.toHaveBeenCalled();
        expect(logger.error as jest.Mock).toHaveBeenCalledWith(expect.stringContaining('Duration must be a positive integer representing seconds'));
    });

    it('throws error for /timeout command with missing duration', async () => {
        // Clear any previous calls
        jest.clearAllMocks();

        const payload = {
            message: "/timeout testuser",
            accountType: "Streamer" as const,
            replyToMessageId: undefined
        };

        const result = await chatManager['handleChatMessageTypedInChatFeed'](payload);

        expect(result).toBe(false);
        expect(mockKick.userApi.banUserByUsername).not.toHaveBeenCalled();
        expect(logger.error as jest.Mock).toHaveBeenCalledWith(expect.stringContaining('Usage: /timeout <user> <duration> [reason]'));
    });

    it('throws error when /timeout command API fails', async () => {
        // Clear any previous calls
        jest.clearAllMocks();
        mockKick.userApi.banUserByUsername.mockResolvedValue(false);

        const payload = {
            message: "/timeout testuser 300 timeout reason",
            accountType: "Streamer" as const,
            replyToMessageId: undefined
        };

        const result = await chatManager['handleChatMessageTypedInChatFeed'](payload);

        expect(result).toBe(false);
        expect(mockKick.userApi.banUserByUsername).toHaveBeenCalledWith('testuser', 5, true, 'timeout reason');
        expect(logger.error as jest.Mock).toHaveBeenCalledWith(expect.stringContaining('Failed to timeout user: testuser'));
    });
});

describe('ChatManager.handleDeleteMessage', () => {
    let chatManager: ChatManager;
    let mockKick: any;

    beforeEach(() => {
        mockKick = {
            broadcaster: { userId: 'broadcasterId' },
            httpCallWithTimeout: jest.fn().mockResolvedValue(undefined),
            getAuthToken: jest.fn().mockReturnValue('authToken')
        };

        chatManager = new ChatManager(mockKick);
        jest.clearAllMocks();
    });

    it('deletes Kick message when platform is kick', async () => {
        const messageId = 'kick-msg-123';
        chatManager['messagePlatform'][messageId] = 'kick';

        const result = await chatManager['handleDeleteMessage'](messageId);

        expect(mockKick.httpCallWithTimeout).toHaveBeenCalledWith(
            '/public/v1/chat/kick-msg-123',
            'DELETE',
            '',
            null,
            undefined,
            'authToken'
        );
        expect(logger.debug).toHaveBeenCalledWith('Successfully deleted chat message: kick-msg-123');
        expect(result).toBe(true);
    });

    it('returns false for Twitch message', async () => {
        const messageId = 'twitch-msg-456';
        chatManager['messagePlatform'][messageId] = 'twitch';

        const result = await chatManager['handleDeleteMessage'](messageId);

        expect(mockKick.httpCallWithTimeout).not.toHaveBeenCalled();
        expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('is not a Kick message'));
        expect(result).toBe(false);
    });

    it('returns false for unknown message platform', async () => {
        const messageId = 'unknown-msg-789';
        chatManager['messagePlatform'][messageId] = 'unknown';

        const result = await chatManager['handleDeleteMessage'](messageId);

        expect(mockKick.httpCallWithTimeout).not.toHaveBeenCalled();
        expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('is not a Kick message'));
        expect(result).toBe(false);
    });

    it('returns false for unregistered message ID', async () => {
        const messageId = 'unregistered-msg';

        const result = await chatManager['handleDeleteMessage'](messageId);

        expect(mockKick.httpCallWithTimeout).not.toHaveBeenCalled();
        expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('is not a Kick message'));
        expect(result).toBe(false);
    });

    it('returns false when API call fails', async () => {
        const messageId = 'kick-msg-999';
        chatManager['messagePlatform'][messageId] = 'kick';
        mockKick.httpCallWithTimeout.mockRejectedValue(new Error('API error'));

        const result = await chatManager['handleDeleteMessage'](messageId);

        expect(mockKick.httpCallWithTimeout).toHaveBeenCalled();
        expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to delete chat message'));
        expect(result).toBe(false);
    });
});

jest.mock('../../main', () => ({
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

import { ChatManager } from '../chat-manager';
import { logger } from '../../main';
import { platformVariable } from '../../variables/platform';

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
        chatManager = new ChatManager(mockKick);
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
});

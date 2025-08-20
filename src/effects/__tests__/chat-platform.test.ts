/* eslint-disable @typescript-eslint/unbound-method */
import * as ChatManagerModule from '../../internal/chat-manager';
import { Effects } from '@crowbartools/firebot-custom-scripts-types/types/effects';

type chatPlatformEffectParams = {
    chatterKick: 'Streamer' | 'Bot';
    chatterTwitch: 'Streamer' | 'Bot';
    message: string;
    messageKick?: string;
    copyMessageKick?: boolean;
    sendAsReply?: boolean;
    sendAsReplyKick?: boolean;
    skipKick?: boolean;
    skipTwitch?: boolean;
    alwaysSendKick?: boolean;
    alwaysSendTwitch?: boolean;
    defaultSendKick?: boolean;
    defaultSendTwitch?: boolean;
};

const mockSendKickChatMessage = jest.fn().mockResolvedValue(undefined);
const mockSendChatMessage = jest.fn().mockResolvedValue(undefined);

jest.mock('../../integration', () => {
    return {
        integration: {
            kick: {
                chatManager: {
                    sendKickChatMessage: mockSendKickChatMessage
                }
            },
            getModules: () => ({
                twitchChat: {
                    sendChatMessage: mockSendChatMessage
                }
            })
        }
    };
});

jest.mock('../../main', () => ({
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

describe('chatPlatformEffect.onTriggerEvent', () => {
    let chatPlatformEffect: typeof import('../chat-platform').chatPlatformEffect;
    let integration: typeof import('../../integration').integration;
    beforeEach(() => {
        jest.resetModules();
        mockSendKickChatMessage.mockClear();
        mockSendChatMessage.mockClear();
        chatPlatformEffect = require('../chat-platform').chatPlatformEffect;
        integration = require('../../integration').integration;
        jest.restoreAllMocks();
    });

    it('sends to Kick with correct params (no reply)', async () => {
        jest.spyOn(ChatManagerModule.ChatManager, 'getPlatformFromTrigger').mockReturnValue('kick');
        const effect: chatPlatformEffectParams = { message: 'hello', chatterKick: 'Streamer', chatterTwitch: 'Bot', copyMessageKick: true, defaultSendKick: true };
        const trigger: Effects.Trigger = { type: 'command', metadata: { eventSource: { id: 'kick' }} } as any;
        await chatPlatformEffect.onTriggerEvent({ trigger, effect } as any);
        expect(integration.kick.chatManager.sendKickChatMessage).toHaveBeenCalledWith('hello', 'Streamer', undefined);
    });

    it('sends to Kick with reply id for command', async () => {
        jest.spyOn(ChatManagerModule.ChatManager, 'getPlatformFromTrigger').mockReturnValue('kick');
        const effect: chatPlatformEffectParams = { message: 'hi', chatterKick: 'Bot', chatterTwitch: 'Bot', sendAsReply: true, copyMessageKick: true, defaultSendKick: true };
        const trigger: Effects.Trigger = { type: 'command', metadata: { chatMessage: { id: 'msg123' }, eventSource: { id: 'kick' }} } as any;
        await chatPlatformEffect.onTriggerEvent({ trigger, effect } as any);
        expect(integration.kick.chatManager.sendKickChatMessage).toHaveBeenCalledWith('hi', 'Bot', 'msg123');
    });

    it('sends to Kick with reply id for event', async () => {
        jest.spyOn(ChatManagerModule.ChatManager, 'getPlatformFromTrigger').mockReturnValue('kick');
        const effect: chatPlatformEffectParams = { message: 'yo', chatterKick: 'Streamer', chatterTwitch: 'Bot', sendAsReply: true, copyMessageKick: true, defaultSendKick: true };
        const trigger: Effects.Trigger = { type: 'event', metadata: { eventData: { chatMessage: { id: 'evt456' } }, eventSource: { id: 'kick' }} } as any;
        await chatPlatformEffect.onTriggerEvent({ trigger, effect } as any);
        expect(integration.kick.chatManager.sendKickChatMessage).toHaveBeenCalledWith('yo', 'Streamer', 'evt456');
    });

    it('skips sending to Kick if skipKick is true', async () => {
        jest.spyOn(ChatManagerModule.ChatManager, 'getPlatformFromTrigger').mockReturnValue('kick');
        const effect: chatPlatformEffectParams = { message: 'skip', chatterKick: 'Streamer', chatterTwitch: 'Bot', skipKick: true, copyMessageKick: true };
        const trigger: Effects.Trigger = { type: 'command', metadata: { eventSource: { id: 'kick' }} } as any;
        await chatPlatformEffect.onTriggerEvent({ trigger, effect } as any);
        expect(integration.kick.chatManager.sendKickChatMessage).not.toHaveBeenCalled();
    });

    it('sends to Twitch with correct params (no reply)', async () => {
        jest.spyOn(ChatManagerModule.ChatManager, 'getPlatformFromTrigger').mockReturnValue('twitch');
        const effect: chatPlatformEffectParams = { message: 'tmsg', chatterKick: 'Streamer', chatterTwitch: 'Bot', alwaysSendTwitch: false };
        const trigger: Effects.Trigger = { type: 'command', metadata: { eventSource: { id: 'twitch' }} } as any;
        await chatPlatformEffect.onTriggerEvent({ trigger, effect } as any);
        expect(mockSendChatMessage).toHaveBeenCalledWith('tmsg', '', 'bot', undefined);
    });

    it('sends to Twitch with reply id for command', async () => {
        jest.spyOn(ChatManagerModule.ChatManager, 'getPlatformFromTrigger').mockReturnValue('twitch');
        const effect: chatPlatformEffectParams = { message: 'tmsg2', chatterKick: 'Streamer', chatterTwitch: 'Streamer', alwaysSendTwitch: false, sendAsReply: true };
        const trigger: Effects.Trigger = { type: 'command', metadata: { chatMessage: { id: 'tmsgid' }, eventSource: { id: 'twitch' }} } as any;
        await chatPlatformEffect.onTriggerEvent({ trigger, effect } as any);
        expect(mockSendChatMessage).toHaveBeenCalledWith('tmsg2', '', 'streamer', 'tmsgid');
    });

    it('sends to Twitch with reply id for event', async () => {
        jest.spyOn(ChatManagerModule.ChatManager, 'getPlatformFromTrigger').mockReturnValue('twitch');
        const effect: chatPlatformEffectParams = { message: 'tmsg2', chatterKick: 'Streamer', chatterTwitch: 'Streamer', alwaysSendTwitch: false, sendAsReply: true };
        const trigger: Effects.Trigger = { type: 'event', metadata: { eventData: { chatMessage: { id: 'evt456' } }, eventSource: { id: 'twitch' }} } as any;
        await chatPlatformEffect.onTriggerEvent({ trigger, effect } as any);
        expect(mockSendChatMessage).toHaveBeenCalledWith('tmsg2', '', 'streamer', 'evt456');
    });

    it('skips sending to Twitch if skipTwitch is true', async () => {
        jest.spyOn(ChatManagerModule.ChatManager, 'getPlatformFromTrigger').mockReturnValue('twitch');
        const effect: chatPlatformEffectParams = { message: 'skipT', chatterKick: 'Streamer', chatterTwitch: 'Bot', alwaysSendTwitch: false, skipTwitch: true };
        const trigger: Effects.Trigger = { type: 'command', metadata: { eventSource: { id: 'twitch' }} } as any;
        await chatPlatformEffect.onTriggerEvent({ trigger, effect } as any);
        expect(mockSendChatMessage).not.toHaveBeenCalled();
    });

    it('does not send to either platform if platform cannot be determined', async() => {
        jest.spyOn(ChatManagerModule.ChatManager, 'getPlatformFromTrigger').mockReturnValue('');
        const effect: chatPlatformEffectParams = { message: 'unknown', chatterKick: 'Streamer', chatterTwitch: 'Bot' };
        const trigger: Effects.Trigger = { type: 'command', metadata: { eventSource: { id: 'unknown' }} } as any;
        await chatPlatformEffect.onTriggerEvent({ trigger, effect } as any);
        expect(integration.kick.chatManager.sendKickChatMessage).not.toHaveBeenCalled();
        expect(mockSendChatMessage).not.toHaveBeenCalled();
    });

    it('sends to kick when trigger cannot be determined but default kick is enabled', async () => {
        jest.spyOn(ChatManagerModule.ChatManager, 'getPlatformFromTrigger').mockReturnValue('');
        const effect: chatPlatformEffectParams = { message: 'unknown', chatterKick: 'Streamer', chatterTwitch: 'Bot', defaultSendKick: true };
        const trigger: Effects.Trigger = { type: 'command', metadata: {} } as any;
        await chatPlatformEffect.onTriggerEvent({ trigger, effect } as any);
        expect(integration.kick.chatManager.sendKickChatMessage).toHaveBeenCalledWith('unknown', 'Streamer', undefined);
        expect(mockSendChatMessage).not.toHaveBeenCalled();
    });

    it('sends to twitch when trigger cannot be determined but default twitch is enabled', async () => {
        jest.spyOn(ChatManagerModule.ChatManager, 'getPlatformFromTrigger').mockReturnValue('');
        const effect: chatPlatformEffectParams = { message: 'unknown', chatterKick: 'Streamer', chatterTwitch: 'Bot', defaultSendTwitch: true };
        const trigger: Effects.Trigger = { type: 'command', metadata: {} } as any;
        await chatPlatformEffect.onTriggerEvent({ trigger, effect } as any);
        expect(integration.kick.chatManager.sendKickChatMessage).not.toHaveBeenCalled();
        expect(mockSendChatMessage).toHaveBeenCalledWith('unknown', '', 'bot', undefined);
    });

    it('sends to kick when alwaysSendKick is enabled', async () => {
        jest.spyOn(ChatManagerModule.ChatManager, 'getPlatformFromTrigger').mockReturnValue('');
        const effect: chatPlatformEffectParams = { message: 'unknown', chatterKick: 'Streamer', chatterTwitch: 'Bot', alwaysSendKick: true };
        const trigger: Effects.Trigger = { type: 'command', metadata: {} } as any;
        await chatPlatformEffect.onTriggerEvent({ trigger, effect } as any);
        expect(integration.kick.chatManager.sendKickChatMessage).toHaveBeenCalledWith('unknown', 'Streamer', undefined);
        expect(mockSendChatMessage).not.toHaveBeenCalled();
    });

    it('sends to twitch when alwaysSendTwitch is enabled', async () => {
        jest.spyOn(ChatManagerModule.ChatManager, 'getPlatformFromTrigger').mockReturnValue('');
        const effect: chatPlatformEffectParams = { message: 'unknown', chatterKick: 'Streamer', chatterTwitch: 'Bot', alwaysSendTwitch: true };
        const trigger: Effects.Trigger = { type: 'command', metadata: {} } as any;
        await chatPlatformEffect.onTriggerEvent({ trigger, effect } as any);
        expect(integration.kick.chatManager.sendKickChatMessage).not.toHaveBeenCalled();
        expect(mockSendChatMessage).toHaveBeenCalledWith('unknown', '', 'bot', undefined);
    });
});

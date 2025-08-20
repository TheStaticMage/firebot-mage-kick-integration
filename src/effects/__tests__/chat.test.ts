import { chatEffect } from '../chat';
import { Effects } from '@crowbartools/firebot-custom-scripts-types/types/effects';

type chatEffectParams = {
    chatter: 'Streamer' | 'Bot';
    message: string;
    sendAsReply: boolean;
};

jest.mock('../../integration', () => ({
    integration: {
        kick: {
            chatManager: {
                sendKickChatMessage: jest.fn().mockResolvedValue(undefined)
            }
        }
    }
}));

const { integration } = require('../../integration');

describe('chatEffect.onTriggerEvent', () => {
    it('calls sendKickChatMessage with correct params (no reply)', async () => {
        const effect: chatEffectParams = { message: 'hello', chatter: 'Streamer', sendAsReply: false };
        const trigger: Effects.Trigger = { type: 'command', metadata: {} } as any;
        await chatEffect.onTriggerEvent({ trigger, effect } as any);
        expect(integration.kick.chatManager.sendKickChatMessage).toHaveBeenCalledWith('hello', 'Streamer', undefined);
    });

    it('calls sendKickChatMessage with reply id for command', async () => {
        const effect: chatEffectParams = { message: 'hi', chatter: 'Bot', sendAsReply: true };
        const trigger: Effects.Trigger = { type: 'command', metadata: { chatMessage: { id: 'msg123' } } } as any;
        await chatEffect.onTriggerEvent({ trigger, effect } as any);
        expect(integration.kick.chatManager.sendKickChatMessage).toHaveBeenCalledWith('hi', 'Bot', 'msg123');
    });

    it('calls sendKickChatMessage with reply id for event', async () => {
        const effect: chatEffectParams = { message: 'yo', chatter: 'Streamer', sendAsReply: true };
        const trigger: Effects.Trigger = { type: 'event', metadata: { eventData: { chatMessage: { id: 'evt456' } } } } as any;
        await chatEffect.onTriggerEvent({ trigger, effect } as any);
        expect(integration.kick.chatManager.sendKickChatMessage).toHaveBeenCalledWith('yo', 'Streamer', 'evt456');
    });

    it('calls sendKickChatMessage with undefined if no id found for reply', async () => {
        const effect: chatEffectParams = { message: 'test', chatter: 'Bot', sendAsReply: true };
        const trigger: Effects.Trigger = { type: 'event', metadata: { eventData: {} } } as any;
        await chatEffect.onTriggerEvent({ trigger, effect } as any);
        expect(integration.kick.chatManager.sendKickChatMessage).toHaveBeenCalledWith('test', 'Bot', undefined);
    });
});

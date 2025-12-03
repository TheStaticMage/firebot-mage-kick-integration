import { Trigger } from "@crowbartools/firebot-custom-scripts-types/types/triggers";
import { deleteChatMessageEffect } from '../delete-chat-message';

type DeleteMessageEffectParams = Record<string, never>;

jest.mock('../../integration', () => ({
    integration: {
        kick: {
            chatManager: {
                deleteKickChatMessage: jest.fn()
            }
        }
    }
}));

jest.mock('../../main', () => ({
    logger: {
        debug: jest.fn(),
        error: jest.fn()
    }
}));

const { integration } = require('../../integration');

describe('deleteMessageEffect.onTriggerEvent', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('successfully deletes message from command trigger', async () => {
        const effect: DeleteMessageEffectParams = {};
        const trigger: Trigger = {
            type: 'command',
            metadata: {
                chatMessage: {
                    id: 'msg-123'
                }
            }
        } as any;

        integration.kick.chatManager.deleteKickChatMessage.mockResolvedValue(true);

        const result = await deleteChatMessageEffect.onTriggerEvent({ trigger, effect } as any);

        expect(integration.kick.chatManager.deleteKickChatMessage).toHaveBeenCalledWith('msg-123');
        expect(result).toBe(true);
    });

    it('successfully deletes message from chat event trigger', async () => {
        const effect: DeleteMessageEffectParams = {};
        const trigger: Trigger = {
            type: 'event',
            metadata: {
                eventData: {
                    chatMessage: {
                        id: 'msg-456'
                    }
                }
            }
        } as any;

        integration.kick.chatManager.deleteKickChatMessage.mockResolvedValue(true);

        const result = await deleteChatMessageEffect.onTriggerEvent({ trigger, effect } as any);

        expect(integration.kick.chatManager.deleteKickChatMessage).toHaveBeenCalledWith('msg-456');
        expect(result).toBe(true);
    });

    it('successfully deletes message when messageId is provided in event metadata', async () => {
        const effect: DeleteMessageEffectParams = {};
        const trigger: Trigger = {
            type: 'event',
            metadata: {
                eventData: {
                    messageId: 'msg-999'
                }
            }
        } as any;

        integration.kick.chatManager.deleteKickChatMessage.mockResolvedValue(true);

        const result = await deleteChatMessageEffect.onTriggerEvent({ trigger, effect } as any);

        expect(integration.kick.chatManager.deleteKickChatMessage).toHaveBeenCalledWith('msg-999');
        expect(result).toBe(true);
    });

    it('returns false when no messageId in command trigger', async () => {
        const effect: DeleteMessageEffectParams = {};
        const trigger: Trigger = {
            type: 'command',
            metadata: {
                chatMessage: null
            }
        } as any;

        const result = await deleteChatMessageEffect.onTriggerEvent({ trigger, effect } as any);

        expect(integration.kick.chatManager.deleteKickChatMessage).not.toHaveBeenCalled();
        expect(result).toBe(false);
    });

    it('returns false when no messageId in event trigger', async () => {
        const effect: DeleteMessageEffectParams = {};
        const trigger: Trigger = {
            type: 'event',
            metadata: {
                eventData: {
                    chatMessage: null
                }
            }
        } as any;

        const result = await deleteChatMessageEffect.onTriggerEvent({ trigger, effect } as any);

        expect(integration.kick.chatManager.deleteKickChatMessage).not.toHaveBeenCalled();
        expect(result).toBe(false);
    });

    it('returns false when API call fails', async () => {
        const effect: DeleteMessageEffectParams = {};
        const trigger: Trigger = {
            type: 'command',
            metadata: {
                chatMessage: {
                    id: 'msg-789'
                }
            }
        } as any;

        integration.kick.chatManager.deleteKickChatMessage.mockResolvedValue(false);

        const result = await deleteChatMessageEffect.onTriggerEvent({ trigger, effect } as any);

        expect(integration.kick.chatManager.deleteKickChatMessage).toHaveBeenCalledWith('msg-789');
        expect(result).toBe(false);
    });

    it('handles missing metadata gracefully', async () => {
        const effect: DeleteMessageEffectParams = {};
        const trigger: Trigger = {
            type: 'command',
            metadata: {}
        } as any;

        const result = await deleteChatMessageEffect.onTriggerEvent({ trigger, effect } as any);

        expect(integration.kick.chatManager.deleteKickChatMessage).not.toHaveBeenCalled();
        expect(result).toBe(false);
    });
});

import { streamerOrBotFilter } from '../streamer-or-bot';
import { IntegrationConstants } from '../../constants';

jest.mock('../../integration', () => ({
    integration: {
        kick: {
            broadcaster: { name: 'StreamerKick' },
            bot: { name: 'BotKick' }
        },
        getSettings: () => ({ accounts: { authorizeBotAccount: true } })
    }
}));

jest.mock('../../main', () => ({
    firebot: {
        firebot: {
            accounts: {
                streamer: { username: 'StreamerTwitch' },
                bot: { username: 'BotTwitch' }
            }
        }
    },
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn()
    }
}));

jest.mock('../../variables/platform', () => ({
    platformVariable: {
        evaluator: jest.fn()
    }
}));

const { platformVariable } = require('../../variables/platform');

describe('streamerOrBotFilter.predicate', () => {
    const baseEventData = {
        eventSourceId: IntegrationConstants.INTEGRATION_ID,
        eventId: 'test-event',
        eventMeta: { username: '' }
    };

    it('returns false for Kick bot when authorizeBotAccount is false (is)', async () => {
        platformVariable.evaluator.mockReturnValue('kick');
        const integration = require('../../integration').integration;
        // Set authorizeBotAccount to false
        integration.getSettings = () => ({ accounts: { authorizeBotAccount: false } });
        const eventData = { ...baseEventData, eventMeta: { username: 'BotKick' } };
        const result = await streamerOrBotFilter.predicate({ comparisonType: 'is', value: 'bot' }, eventData);
        expect(result).toBe(false);
        // Restore
        integration.getSettings = () => ({ accounts: { authorizeBotAccount: true } });
    });

    it('returns true for Kick bot when authorizeBotAccount is false (is not)', async () => {
        platformVariable.evaluator.mockReturnValue('kick');
        const integration = require('../../integration').integration;
        // Set authorizeBotAccount to false
        integration.getSettings = () => ({ accounts: { authorizeBotAccount: false } });
        const eventData = { ...baseEventData, eventMeta: { username: 'BotKick' } };
        const result = await streamerOrBotFilter.predicate({ comparisonType: 'is not', value: 'bot' }, eventData);
        expect(result).toBe(true);
        // Restore
        integration.getSettings = () => ({ accounts: { authorizeBotAccount: true } });
    });

    it('returns false for Kick bot when bot name is empty string (is)', async () => {
        platformVariable.evaluator.mockReturnValue('kick');
        const integration = require('../../integration').integration;
        integration.kick.bot.name = '';
        const eventData = { ...baseEventData, eventMeta: { username: 'somebody' } };
        // Should be false for bot
        let result = await streamerOrBotFilter.predicate({ comparisonType: 'is', value: 'bot' }, eventData);
        expect(result).toBe(false);
        // Should be false for either
        result = await streamerOrBotFilter.predicate({ comparisonType: 'is', value: 'either' }, eventData);
        expect(result).toBe(false);
        // Restore
        integration.kick.bot.name = 'BotKick';
    });

    it('returns true for Kick bot when bot name is empty string (is not)', async () => {
        platformVariable.evaluator.mockReturnValue('kick');
        const integration = require('../../integration').integration;
        integration.kick.bot.name = '';
        const eventData = { ...baseEventData, eventMeta: { username: 'somebody' } };
        // Should be false for bot
        let result = await streamerOrBotFilter.predicate({ comparisonType: 'is not', value: 'bot' }, eventData);
        expect(result).toBe(true);
        // Should be false for either
        result = await streamerOrBotFilter.predicate({ comparisonType: 'is not', value: 'either' }, eventData);
        expect(result).toBe(true);
        // Restore
        integration.kick.bot.name = 'BotKick';
    });

    it('returns false for Twitch bot when bot username is empty string (is)', async () => {
        platformVariable.evaluator.mockReturnValue('twitch');
        const firebot = require('../../main').firebot;
        firebot.firebot.accounts.bot.username = '';
        const eventData = { ...baseEventData, eventMeta: { username: 'somebody' } };
        // Should be false for bot
        let result = await streamerOrBotFilter.predicate({ comparisonType: 'is', value: 'bot' }, eventData);
        expect(result).toBe(false);
        // Should be false for either
        result = await streamerOrBotFilter.predicate({ comparisonType: 'is', value: 'either' }, eventData);
        expect(result).toBe(false);
        // Restore
        firebot.firebot.accounts.bot.username = 'BotTwitch';
    });

    it('returns true for Twitch bot when bot username is empty string (is not)', async () => {
        platformVariable.evaluator.mockReturnValue('twitch');
        const firebot = require('../../main').firebot;
        firebot.firebot.accounts.bot.username = '';
        const eventData = { ...baseEventData, eventMeta: { username: 'somebody' } };
        // Should be false for bot
        let result = await streamerOrBotFilter.predicate({ comparisonType: 'is not', value: 'bot' }, eventData);
        expect(result).toBe(true);
        // Should be false for either
        result = await streamerOrBotFilter.predicate({ comparisonType: 'is not', value: 'either' }, eventData);
        expect(result).toBe(true);
        // Restore
        firebot.firebot.accounts.bot.username = 'BotTwitch';
    });

    it('returns true for Kick streamer (is)', async () => {
        platformVariable.evaluator.mockReturnValue('kick');
        const eventData = { ...baseEventData, eventMeta: { username: 'StreamerKick' } };
        const result = await streamerOrBotFilter.predicate({ comparisonType: 'is', value: 'streamer' }, eventData);
        expect(result).toBe(true);
    });

    it('returns true for Kick bot (is)', async () => {
        platformVariable.evaluator.mockReturnValue('kick');
        const eventData = { ...baseEventData, eventMeta: { username: 'BotKick' } };
        const result = await streamerOrBotFilter.predicate({ comparisonType: 'is', value: 'bot' }, eventData);
        expect(result).toBe(true);
    });

    it('returns true for Kick either (is)', async () => {
        platformVariable.evaluator.mockReturnValue('kick');
        let eventData = { ...baseEventData, eventMeta: { username: 'StreamerKick' } };
        let result = await streamerOrBotFilter.predicate({ comparisonType: 'is', value: 'either' }, eventData);
        expect(result).toBe(true);
        eventData = { ...baseEventData, eventMeta: { username: 'BotKick' } };
        result = await streamerOrBotFilter.predicate({ comparisonType: 'is', value: 'either' }, eventData);
        expect(result).toBe(true);
    });

    it('returns false for Kick either (is not)', async () => {
        platformVariable.evaluator.mockReturnValue('kick');
        let eventData = { ...baseEventData, eventMeta: { username: 'StreamerKick' } };
        let result = await streamerOrBotFilter.predicate({ comparisonType: 'is not', value: 'either' }, eventData);
        expect(result).toBe(false);
        eventData = { ...baseEventData, eventMeta: { username: 'BotKick' } };
        result = await streamerOrBotFilter.predicate({ comparisonType: 'is not', value: 'either' }, eventData);
        expect(result).toBe(false);
    });

    it('returns false for Kick not streamer (is)', async () => {
        platformVariable.evaluator.mockReturnValue('kick');
        const eventData = { ...baseEventData, eventMeta: { username: 'NotAStreamer' } };
        const result = await streamerOrBotFilter.predicate({ comparisonType: 'is', value: 'streamer' }, eventData);
        expect(result).toBe(false);
    });

    it('returns true for Twitch streamer', async () => {
        platformVariable.evaluator.mockReturnValue('twitch');
        const eventData = { ...baseEventData, eventMeta: { username: 'StreamerTwitch' } };
        const result = await streamerOrBotFilter.predicate({ comparisonType: 'is', value: 'streamer' }, eventData);
        expect(result).toBe(true);
    });

    it('returns true for Twitch bot', async () => {
        platformVariable.evaluator.mockReturnValue('twitch');
        const eventData = { ...baseEventData, eventMeta: { username: 'BotTwitch' } };
        const result = await streamerOrBotFilter.predicate({ comparisonType: 'is', value: 'bot' }, eventData);
        expect(result).toBe(true);
    });

    it('returns true for Twitch either (is)', async () => {
        platformVariable.evaluator.mockReturnValue('twitch');
        let eventData = { ...baseEventData, eventMeta: { username: 'StreamerTwitch' } };
        let result = await streamerOrBotFilter.predicate({ comparisonType: 'is', value: 'either' }, eventData);
        expect(result).toBe(true);
        eventData = { ...baseEventData, eventMeta: { username: 'BotTwitch' } };
        result = await streamerOrBotFilter.predicate({ comparisonType: 'is', value: 'either' }, eventData);
        expect(result).toBe(true);
    });

    it('returns true for Twitch either (is not)', async () => {
        platformVariable.evaluator.mockReturnValue('twitch');
        let eventData = { ...baseEventData, eventMeta: { username: 'StreamerTwitch' } };
        let result = await streamerOrBotFilter.predicate({ comparisonType: 'is not', value: 'either' }, eventData);
        expect(result).toBe(false);
        eventData = { ...baseEventData, eventMeta: { username: 'BotTwitch' } };
        result = await streamerOrBotFilter.predicate({ comparisonType: 'is not', value: 'either' }, eventData);
        expect(result).toBe(false);
    });

    it('returns false for Twitch not streamer', async () => {
        platformVariable.evaluator.mockReturnValue('twitch');
        const eventData = { ...baseEventData, eventMeta: { username: 'NotAStreamer' } };
        const result = await streamerOrBotFilter.predicate({ comparisonType: 'is', value: 'streamer' }, eventData);
        expect(result).toBe(false);
    });

    it('returns false for unknown platform (is)', async () => {
        platformVariable.evaluator.mockReturnValue('unknown');
        const eventData = { ...baseEventData, eventMeta: { username: 'StreamerKick' } };
        const result = await streamerOrBotFilter.predicate({ comparisonType: 'is', value: 'streamer' }, eventData);
        expect(result).toBe(false);
    });

    it('returns true for unknown platform (is not)', async () => {
        platformVariable.evaluator.mockReturnValue('unknown');
        const eventData = { ...baseEventData, eventMeta: { username: 'StreamerKick' } };
        const result = await streamerOrBotFilter.predicate({ comparisonType: 'is not', value: 'streamer' }, eventData);
        expect(result).toBe(true);
    });

    it('returns false for empty username (is)', async () => {
        platformVariable.evaluator.mockReturnValue('kick');
        const eventData = { ...baseEventData, eventMeta: { username: '' } };
        const result = await streamerOrBotFilter.predicate({ comparisonType: 'is', value: 'streamer' }, eventData);
        expect(result).toBe(false);
    });

    it('returns true for empty username (is not)', async () => {
        platformVariable.evaluator.mockReturnValue('kick');
        const eventData = { ...baseEventData, eventMeta: { username: '' } };
        const result = await streamerOrBotFilter.predicate({ comparisonType: 'is not', value: 'streamer' }, eventData);
        expect(result).toBe(true);
    });

    it('returns true for "is not" when username does not match', async () => {
        platformVariable.evaluator.mockReturnValue('kick');
        const eventData = { ...baseEventData, eventMeta: { username: 'NotAStreamer' } };
        const result = await streamerOrBotFilter.predicate({ comparisonType: 'is not', value: 'streamer' }, eventData);
        expect(result).toBe(true);
    });

    it('returns false for "is not" when username matches', async () => {
        platformVariable.evaluator.mockReturnValue('kick');
        const eventData = { ...baseEventData, eventMeta: { username: 'StreamerKick' } };
        const result = await streamerOrBotFilter.predicate({ comparisonType: 'is not', value: 'streamer' }, eventData);
        expect(result).toBe(false);
    });
});

describe('streamerOrBotFilter.events', () => {
    it('should contain both twitch and INTEGRATION_ID "chat-message" events', () => {
        const twitchEvent = streamerOrBotFilter.events.find(
            e => e.eventSourceId === 'twitch' && e.eventId === 'chat-message'
        );
        const integrationEvent = streamerOrBotFilter.events.find(
            e => e.eventSourceId === IntegrationConstants.INTEGRATION_ID && e.eventId === 'chat-message'
        );
        expect(twitchEvent).toBeDefined();
        expect(integrationEvent).toBeDefined();
    });
});

describe('streamerOrBotFilter.getSelectedValueDisplay', () => {
    const dummyComparisonType = 'is';
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const getSelectedValueDisplay = streamerOrBotFilter.getSelectedValueDisplay;
    if (!getSelectedValueDisplay) {
        throw new Error('getSelectedValueDisplay is not defined');
    }
    it('returns correct display value for "streamer"', () => {
        expect(getSelectedValueDisplay({ comparisonType: dummyComparisonType, value: 'streamer' })).toBe('Streamer');
    });

    it('returns correct display value for "bot"', () => {
        expect(getSelectedValueDisplay({ comparisonType: dummyComparisonType, value: 'bot' })).toBe('Stream Bot');
    });

    it('returns correct display value for "either"', () => {
        expect(getSelectedValueDisplay({ comparisonType: dummyComparisonType, value: 'either' })).toBe('Streamer or Stream Bot');
    });

    it('returns the fallback string if unknown value', () => {
        expect(getSelectedValueDisplay({ comparisonType: dummyComparisonType, value: 'unknown' })).toBe('??? (unknown)');
    });
});

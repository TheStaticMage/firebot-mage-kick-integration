import { streamerOrBotFilter } from '../streamer-or-bot';
import { IntegrationConstants } from '../../constants';

jest.mock('../../integration', () => ({
    integration: {
        kick: {
            broadcaster: { name: 'StreamerKick' },
            bot: { name: 'BotKick' }
        }
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

jest.mock('@thestaticmage/mage-platform-lib-client', () => ({
    detectPlatform: jest.fn()
}));

const { detectPlatform } = require('@thestaticmage/mage-platform-lib-client');

describe('streamerOrBotFilter.predicate', () => {
    const baseEventData = {
        eventSourceId: IntegrationConstants.INTEGRATION_ID,
        eventId: 'test-event',
        eventMeta: { username: '' }
    };


    it('returns false for Kick bot when bot name is empty string (is)', async () => {
        detectPlatform.mockReturnValue('kick');
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
        detectPlatform.mockReturnValue('kick');
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
        detectPlatform.mockReturnValue('twitch');
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
        detectPlatform.mockReturnValue('twitch');
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
        detectPlatform.mockReturnValue('kick');
        const eventData = { ...baseEventData, eventMeta: { username: 'StreamerKick' } };
        const result = await streamerOrBotFilter.predicate({ comparisonType: 'is', value: 'streamer' }, eventData);
        expect(result).toBe(true);
    });

    it('returns true for Kick bot (is)', async () => {
        detectPlatform.mockReturnValue('kick');
        const eventData = { ...baseEventData, eventMeta: { username: 'BotKick' } };
        const result = await streamerOrBotFilter.predicate({ comparisonType: 'is', value: 'bot' }, eventData);
        expect(result).toBe(true);
    });

    it('returns true for Kick either (is)', async () => {
        detectPlatform.mockReturnValue('kick');
        let eventData = { ...baseEventData, eventMeta: { username: 'StreamerKick' } };
        let result = await streamerOrBotFilter.predicate({ comparisonType: 'is', value: 'either' }, eventData);
        expect(result).toBe(true);
        eventData = { ...baseEventData, eventMeta: { username: 'BotKick' } };
        result = await streamerOrBotFilter.predicate({ comparisonType: 'is', value: 'either' }, eventData);
        expect(result).toBe(true);
    });

    it('returns false for Kick either (is not)', async () => {
        detectPlatform.mockReturnValue('kick');
        let eventData = { ...baseEventData, eventMeta: { username: 'StreamerKick' } };
        let result = await streamerOrBotFilter.predicate({ comparisonType: 'is not', value: 'either' }, eventData);
        expect(result).toBe(false);
        eventData = { ...baseEventData, eventMeta: { username: 'BotKick' } };
        result = await streamerOrBotFilter.predicate({ comparisonType: 'is not', value: 'either' }, eventData);
        expect(result).toBe(false);
    });

    it('returns false for Kick not streamer (is)', async () => {
        detectPlatform.mockReturnValue('kick');
        const eventData = { ...baseEventData, eventMeta: { username: 'NotAStreamer' } };
        const result = await streamerOrBotFilter.predicate({ comparisonType: 'is', value: 'streamer' }, eventData);
        expect(result).toBe(false);
    });

    it('returns true for Twitch streamer', async () => {
        detectPlatform.mockReturnValue('twitch');
        const eventData = { ...baseEventData, eventMeta: { username: 'StreamerTwitch' } };
        const result = await streamerOrBotFilter.predicate({ comparisonType: 'is', value: 'streamer' }, eventData);
        expect(result).toBe(true);
    });

    it('returns true for Twitch bot', async () => {
        detectPlatform.mockReturnValue('twitch');
        const eventData = { ...baseEventData, eventMeta: { username: 'BotTwitch' } };
        const result = await streamerOrBotFilter.predicate({ comparisonType: 'is', value: 'bot' }, eventData);
        expect(result).toBe(true);
    });

    it('returns true for Twitch either (is)', async () => {
        detectPlatform.mockReturnValue('twitch');
        let eventData = { ...baseEventData, eventMeta: { username: 'StreamerTwitch' } };
        let result = await streamerOrBotFilter.predicate({ comparisonType: 'is', value: 'either' }, eventData);
        expect(result).toBe(true);
        eventData = { ...baseEventData, eventMeta: { username: 'BotTwitch' } };
        result = await streamerOrBotFilter.predicate({ comparisonType: 'is', value: 'either' }, eventData);
        expect(result).toBe(true);
    });

    it('returns true for Twitch either (is not)', async () => {
        detectPlatform.mockReturnValue('twitch');
        let eventData = { ...baseEventData, eventMeta: { username: 'StreamerTwitch' } };
        let result = await streamerOrBotFilter.predicate({ comparisonType: 'is not', value: 'either' }, eventData);
        expect(result).toBe(false);
        eventData = { ...baseEventData, eventMeta: { username: 'BotTwitch' } };
        result = await streamerOrBotFilter.predicate({ comparisonType: 'is not', value: 'either' }, eventData);
        expect(result).toBe(false);
    });

    it('returns false for Twitch not streamer', async () => {
        detectPlatform.mockReturnValue('twitch');
        const eventData = { ...baseEventData, eventMeta: { username: 'NotAStreamer' } };
        const result = await streamerOrBotFilter.predicate({ comparisonType: 'is', value: 'streamer' }, eventData);
        expect(result).toBe(false);
    });

    it('returns false for unknown platform (is)', async () => {
        detectPlatform.mockReturnValue('unknown');
        const eventData = { ...baseEventData, eventMeta: { username: 'StreamerKick' } };
        const result = await streamerOrBotFilter.predicate({ comparisonType: 'is', value: 'streamer' }, eventData);
        expect(result).toBe(false);
    });

    it('returns true for unknown platform (is not)', async () => {
        detectPlatform.mockReturnValue('unknown');
        const eventData = { ...baseEventData, eventMeta: { username: 'StreamerKick' } };
        const result = await streamerOrBotFilter.predicate({ comparisonType: 'is not', value: 'streamer' }, eventData);
        expect(result).toBe(true);
    });

    it('returns false for empty username (is)', async () => {
        detectPlatform.mockReturnValue('kick');
        const eventData = { ...baseEventData, eventMeta: { username: '' } };
        const result = await streamerOrBotFilter.predicate({ comparisonType: 'is', value: 'streamer' }, eventData);
        expect(result).toBe(false);
    });

    it('returns true for empty username (is not)', async () => {
        detectPlatform.mockReturnValue('kick');
        const eventData = { ...baseEventData, eventMeta: { username: '' } };
        const result = await streamerOrBotFilter.predicate({ comparisonType: 'is not', value: 'streamer' }, eventData);
        expect(result).toBe(true);
    });

    it('returns true for "is not" when username does not match', async () => {
        detectPlatform.mockReturnValue('kick');
        const eventData = { ...baseEventData, eventMeta: { username: 'NotAStreamer' } };
        const result = await streamerOrBotFilter.predicate({ comparisonType: 'is not', value: 'streamer' }, eventData);
        expect(result).toBe(true);
    });

    it('returns false for "is not" when username matches', async () => {
        detectPlatform.mockReturnValue('kick');
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

import { IntegrationConstants } from '../../constants';
import { usernameFilter } from '../username';

jest.mock('../../main', () => ({
    logger: {
        info: jest.fn(),
        debug: jest.fn(),
        error: jest.fn(),
        warn: jest.fn()
    }
}));

describe('usernameFilter.predicate', () => {
    it('returns true when the username is equal and comparison type is "is"', async () => {
        const filterSettings = { comparisonType: 'is', value: 'jimbo' };
        const eventData = {
            eventSourceId: IntegrationConstants.INTEGRATION_ID,
            eventId: 'test-event',
            eventMeta: {
                username: 'jimbo'
            }
        };
        const result = await usernameFilter.predicate(filterSettings, eventData);
        expect(result).toBe(true);
    });

    it('returns false when the username is not equal and comparison type is "is"', async () => {
        const filterSettings = { comparisonType: 'is', value: 'jimbo' };
        const eventData = {
            eventSourceId: IntegrationConstants.INTEGRATION_ID,
            eventId: 'test-event',
            eventMeta: {
                username: 'jane'
            }
        };
        const result = await usernameFilter.predicate(filterSettings, eventData);
        expect(result).toBe(false);
    });

    it('returns true when the value has @kick and the condition does not', async () => {
        const filterSettings = { comparisonType: 'is', value: 'jimbo' };
        const eventData = {
            eventSourceId: IntegrationConstants.INTEGRATION_ID,
            eventId: 'test-event',
            eventMeta: {
                username: 'jimbo@kick'
            }
        };
        const result = await usernameFilter.predicate(filterSettings, eventData);
        expect(result).toBe(true);
    });

    it('returns true when the condition has @kick and the value does not', async () => {
        const filterSettings = { comparisonType: 'is', value: 'jimbo@kick' };
        const eventData = {
            eventSourceId: IntegrationConstants.INTEGRATION_ID,
            eventId: 'test-event',
            eventMeta: {
                username: 'jimbo'
            }
        };
        const result = await usernameFilter.predicate(filterSettings, eventData);
        expect(result).toBe(true);
    });


    it('returns true when the condition and value both have @kick', async () => {
        const filterSettings = { comparisonType: 'is', value: 'jimbo@kick' };
        const eventData = {
            eventSourceId: IntegrationConstants.INTEGRATION_ID,
            eventId: 'test-event',
            eventMeta: {
                username: 'jimbo@kick'
            }
        };
        const result = await usernameFilter.predicate(filterSettings, eventData);
        expect(result).toBe(true);
    });

    it('returns true for "is not" condition when the username does not match', async () => {
        const filterSettings = { comparisonType: 'is not', value: 'jimbo' };
        const eventData = {
            eventSourceId: IntegrationConstants.INTEGRATION_ID,
            eventId: 'test-event',
            eventMeta: {
                username: 'jane'
            }
        };
        const result = await usernameFilter.predicate(filterSettings, eventData);
        expect(result).toBe(true);
    });

    it('returns false for "is not" condition when the username matches', async () => {
        const filterSettings = { comparisonType: 'is not', value: 'jimbo' };
        const eventData = {
            eventSourceId: IntegrationConstants.INTEGRATION_ID,
            eventId: 'test-event',
            eventMeta: {
                username: 'jimbo'
            }
        };
        const result = await usernameFilter.predicate(filterSettings, eventData);
        expect(result).toBe(false);
    });

    it('returns true for "contains" when username contains value', async () => {
        const filterSettings = { comparisonType: 'contains', value: 'jim' };
        const eventData = { eventSourceId: IntegrationConstants.INTEGRATION_ID, eventId: 'test-event', eventMeta: { username: 'jimbo' } };
        const result = await usernameFilter.predicate(filterSettings, eventData);
        expect(result).toBe(true);
    });
    it('returns false for "contains" when username does not contain value', async () => {
        const filterSettings = { comparisonType: 'contains', value: 'bob' };
        const eventData = { eventSourceId: IntegrationConstants.INTEGRATION_ID, eventId: 'test-event', eventMeta: { username: 'jimbo' } };
        const result = await usernameFilter.predicate(filterSettings, eventData);
        expect(result).toBe(false);
    });

    it('returns true for "doesn\'t contain" when username does not contain value', async () => {
        const filterSettings = { comparisonType: "doesn't contain", value: 'bob' };
        const eventData = { eventSourceId: IntegrationConstants.INTEGRATION_ID, eventId: 'test-event', eventMeta: { username: 'jimbo' } };
        const result = await usernameFilter.predicate(filterSettings, eventData);
        expect(result).toBe(true);
    });
    it('returns false for "doesn\'t contain" when username contains value', async () => {
        const filterSettings = { comparisonType: "doesn't contain", value: 'jim' };
        const eventData = { eventSourceId: IntegrationConstants.INTEGRATION_ID, eventId: 'test-event', eventMeta: { username: 'jimbo' } };
        const result = await usernameFilter.predicate(filterSettings, eventData);
        expect(result).toBe(false);
    });

    it('returns true for "starts with" when username starts with value', async () => {
        const filterSettings = { comparisonType: 'starts with', value: 'jim' };
        const eventData = { eventSourceId: IntegrationConstants.INTEGRATION_ID, eventId: 'test-event', eventMeta: { username: 'jimbo' } };
        const result = await usernameFilter.predicate(filterSettings, eventData);
        expect(result).toBe(true);
    });
    it('returns false for "starts with" when username does not start with value', async () => {
        const filterSettings = { comparisonType: 'starts with', value: 'bo' };
        const eventData = { eventSourceId: IntegrationConstants.INTEGRATION_ID, eventId: 'test-event', eventMeta: { username: 'jimbo' } };
        const result = await usernameFilter.predicate(filterSettings, eventData);
        expect(result).toBe(false);
    });

    it('returns true for "doesn\'t start with" when username does not start with value', async () => {
        const filterSettings = { comparisonType: "doesn't start with", value: 'bo' };
        const eventData = { eventSourceId: IntegrationConstants.INTEGRATION_ID, eventId: 'test-event', eventMeta: { username: 'jimbo' } };
        const result = await usernameFilter.predicate(filterSettings, eventData);
        expect(result).toBe(true);
    });
    it('returns false for "doesn\'t start with" when username starts with value', async () => {
        const filterSettings = { comparisonType: "doesn't start with", value: 'jim' };
        const eventData = { eventSourceId: IntegrationConstants.INTEGRATION_ID, eventId: 'test-event', eventMeta: { username: 'jimbo' } };
        const result = await usernameFilter.predicate(filterSettings, eventData);
        expect(result).toBe(false);
    });

    it('returns true for "ends with" when username ends with value', async () => {
        const filterSettings = { comparisonType: 'ends with', value: 'bo' };
        const eventData = { eventSourceId: IntegrationConstants.INTEGRATION_ID, eventId: 'test-event', eventMeta: { username: 'jimbo' } };
        const result = await usernameFilter.predicate(filterSettings, eventData);
        expect(result).toBe(true);
    });
    it('returns false for "ends with" when username does not end with value', async () => {
        const filterSettings = { comparisonType: 'ends with', value: 'jim' };
        const eventData = { eventSourceId: IntegrationConstants.INTEGRATION_ID, eventId: 'test-event', eventMeta: { username: 'jimbo' } };
        const result = await usernameFilter.predicate(filterSettings, eventData);
        expect(result).toBe(false);
    });

    it('returns true for "doesn\'t end with" when username does not end with value', async () => {
        const filterSettings = { comparisonType: "doesn't end with", value: 'jim' };
        const eventData = { eventSourceId: IntegrationConstants.INTEGRATION_ID, eventId: 'test-event', eventMeta: { username: 'jimbo' } };
        const result = await usernameFilter.predicate(filterSettings, eventData);
        expect(result).toBe(true);
    });
    it('returns false for "doesn\'t end with" when username ends with value', async () => {
        const filterSettings = { comparisonType: "doesn't end with", value: 'bo' };
        const eventData = { eventSourceId: IntegrationConstants.INTEGRATION_ID, eventId: 'test-event', eventMeta: { username: 'jimbo' } };
        const result = await usernameFilter.predicate(filterSettings, eventData);
        expect(result).toBe(false);
    });

    it('returns true for "matches regex (case-sensitive)" when username matches', async () => {
        const filterSettings = { comparisonType: 'matches regex (case-sensitive)', value: '^jim' };
        const eventData = { eventSourceId: IntegrationConstants.INTEGRATION_ID, eventId: 'test-event', eventMeta: { username: 'jimbo' } };
        const result = await usernameFilter.predicate(filterSettings, eventData);
        expect(result).toBe(true);
    });
    it('returns false for "matches regex (case-sensitive)" when username does not match', async () => {
        const filterSettings = { comparisonType: 'matches regex (case-sensitive)', value: '^bo' };
        const eventData = { eventSourceId: IntegrationConstants.INTEGRATION_ID, eventId: 'test-event', eventMeta: { username: 'jimbo' } };
        const result = await usernameFilter.predicate(filterSettings, eventData);
        expect(result).toBe(false);
    });

    it('returns true for "doesn\'t match regex (case-sensitive)" when username does not match', async () => {
        const filterSettings = { comparisonType: "doesn't match regex (case-sensitive)", value: '^bo' };
        const eventData = { eventSourceId: IntegrationConstants.INTEGRATION_ID, eventId: 'test-event', eventMeta: { username: 'jimbo' } };
        const result = await usernameFilter.predicate(filterSettings, eventData);
        expect(result).toBe(true);
    });
    it('returns false for "doesn\'t match regex (case-sensitive)" when username matches', async () => {
        const filterSettings = { comparisonType: "doesn't match regex (case-sensitive)", value: '^jim' };
        const eventData = { eventSourceId: IntegrationConstants.INTEGRATION_ID, eventId: 'test-event', eventMeta: { username: 'jimbo' } };
        const result = await usernameFilter.predicate(filterSettings, eventData);
        expect(result).toBe(false);
    });

    it('returns true for "matches regex" when username matches (case-insensitive)', async () => {
        const filterSettings = { comparisonType: 'matches regex', value: '^JIM' };
        const eventData = { eventSourceId: IntegrationConstants.INTEGRATION_ID, eventId: 'test-event', eventMeta: { username: 'jimbo' } };
        const result = await usernameFilter.predicate(filterSettings, eventData);
        expect(result).toBe(true);
    });
    it('returns false for "matches regex" when username does not match (case-insensitive)', async () => {
        const filterSettings = { comparisonType: 'matches regex', value: '^BO' };
        const eventData = { eventSourceId: IntegrationConstants.INTEGRATION_ID, eventId: 'test-event', eventMeta: { username: 'jimbo' } };
        const result = await usernameFilter.predicate(filterSettings, eventData);
        expect(result).toBe(false);
    });

    it('returns true for "doesn\'t match regex" when username does not match (case-insensitive)', async () => {
        const filterSettings = { comparisonType: "doesn't match regex", value: '^BO' };
        const eventData = { eventSourceId: IntegrationConstants.INTEGRATION_ID, eventId: 'test-event', eventMeta: { username: 'jimbo' } };
        const result = await usernameFilter.predicate(filterSettings, eventData);
        expect(result).toBe(true);
    });
    it('returns false for "doesn\'t match regex" when username matches (case-insensitive)', async () => {
        const filterSettings = { comparisonType: "doesn't match regex", value: '^JIM' };
        const eventData = { eventSourceId: IntegrationConstants.INTEGRATION_ID, eventId: 'test-event', eventMeta: { username: 'jimbo' } };
        const result = await usernameFilter.predicate(filterSettings, eventData);
        expect(result).toBe(false);
    });
});

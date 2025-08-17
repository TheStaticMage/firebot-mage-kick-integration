
import { IntegrationConstants } from '../../constants';
import { platformFilter } from '../platform';

describe('platformFilter.predicate', () => {
    it('returns true when platform matches and comparisonType is "is"', () => {
        const filterSettings = { comparisonType: 'is', value: 'kick' };
        const eventData = {
            eventSourceId: IntegrationConstants.INTEGRATION_ID,
            eventId: 'test-event',
            eventMeta: {}
        };
        expect(platformFilter.predicate(filterSettings, eventData)).toBe(true);
    });

    it('returns false when platform does not match and comparisonType is "is"', () => {
        const filterSettings = { comparisonType: 'is', value: 'twitch' };
        const eventData = {
            eventSourceId: IntegrationConstants.INTEGRATION_ID,
            eventId: 'test-event',
            eventMeta: {}
        };
        expect(platformFilter.predicate(filterSettings, eventData)).toBe(false);
    });

    it('returns true when platform does not match and comparisonType is "is not"', () => {
        const filterSettings = { comparisonType: 'is not', value: 'twitch' };
        const eventData = {
            eventSourceId: IntegrationConstants.INTEGRATION_ID,
            eventId: 'test-event',
            eventMeta: {}
        };
        expect(platformFilter.predicate(filterSettings, eventData)).toBe(true);
    });

    it('returns false when platform matches and comparisonType is "is not"', () => {
        const filterSettings = { comparisonType: 'is not', value: 'kick' };
        const eventData = {
            eventSourceId: IntegrationConstants.INTEGRATION_ID,
            eventId: 'test-event',
            eventMeta: {}
        };
        expect(platformFilter.predicate(filterSettings, eventData)).toBe(false);
    });
});

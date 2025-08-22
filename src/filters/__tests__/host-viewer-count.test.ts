import { hostViewerCountFilter } from '../host-viewer-count';
import { IntegrationConstants } from '../../constants';
import { ComparisonType } from '../common';

jest.mock('../../main', () => ({
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn()
    }
}));

describe('hostViewerCountFilter.predicate', () => {
    const baseEventData = {
        eventSourceId: IntegrationConstants.INTEGRATION_ID,
        eventId: 'raid',
        eventMeta: { viewerCount: 5 }
    };

    const cases = [
        // [comparisonType, viewerCount, value, expectedResult]
        [ComparisonType.IS, 5, 5, true],
        [ComparisonType.IS, 4, 5, false],
        [ComparisonType.IS, 0, 0, true],
        [ComparisonType.IS, 1, 0, false],

        [ComparisonType.IS_NOT, 4, 5, true],
        [ComparisonType.IS_NOT, 5, 5, false],
        [ComparisonType.IS_NOT, 1, 0, true],
        [ComparisonType.IS_NOT, 0, 0, false],

        [ComparisonType.LESS_THAN, 4, 5, true],
        [ComparisonType.LESS_THAN, 5, 5, false],
        [ComparisonType.LESS_THAN, -1, 0, true],
        [ComparisonType.LESS_THAN, 0, 0, false],

        [ComparisonType.LESS_THAN_OR_EQUAL_TO, 5, 5, true],
        [ComparisonType.LESS_THAN_OR_EQUAL_TO, 4, 5, true],
        [ComparisonType.LESS_THAN_OR_EQUAL_TO, 6, 5, false],
        [ComparisonType.LESS_THAN_OR_EQUAL_TO, 0, 0, true],
        [ComparisonType.LESS_THAN_OR_EQUAL_TO, -1, 0, true],

        [ComparisonType.GREATER_THAN, 6, 5, true],
        [ComparisonType.GREATER_THAN, 5, 5, false],
        [ComparisonType.GREATER_THAN, 1, 0, true],
        [ComparisonType.GREATER_THAN, 0, 0, false],

        [ComparisonType.GREATER_THAN_OR_EQUAL_TO, 5, 5, true],
        [ComparisonType.GREATER_THAN_OR_EQUAL_TO, 6, 5, true],
        [ComparisonType.GREATER_THAN_OR_EQUAL_TO, 4, 5, false],
        [ComparisonType.GREATER_THAN_OR_EQUAL_TO, 0, 0, true],
        [ComparisonType.GREATER_THAN_OR_EQUAL_TO, -1, 0, false]
    ];

    for (const [comparisonType, viewerCount, value, expectedResult] of cases) {
        it(`returns ${expectedResult} for ${comparisonType} when viewerCount=${viewerCount} and value=${value}`, async () => {
            const eventData = { ...baseEventData, eventMeta: { viewerCount: Number(viewerCount) } };
            const result = await hostViewerCountFilter.predicate({ comparisonType: comparisonType as string, value }, eventData);
            expect(result).toBe(expectedResult);
        });
    }

    it('treats non-numeric viewerCount as 0', async () => {
        const eventData = { ...baseEventData, eventMeta: { viewerCount: 'not-a-number' } };
        // For value 0, is should be true, greater than should be false, less than or equal to should be true, etc.
        expect(await hostViewerCountFilter.predicate({ comparisonType: ComparisonType.IS, value: 0 }, eventData)).toBe(true);
        expect(await hostViewerCountFilter.predicate({ comparisonType: ComparisonType.IS_NOT, value: 0 }, eventData)).toBe(false);
        expect(await hostViewerCountFilter.predicate({ comparisonType: ComparisonType.GREATER_THAN, value: 0 }, eventData)).toBe(false);
        expect(await hostViewerCountFilter.predicate({ comparisonType: ComparisonType.GREATER_THAN_OR_EQUAL_TO, value: 0 }, eventData)).toBe(true);
        expect(await hostViewerCountFilter.predicate({ comparisonType: ComparisonType.LESS_THAN, value: 0 }, eventData)).toBe(false);
        expect(await hostViewerCountFilter.predicate({ comparisonType: ComparisonType.LESS_THAN, value: 1 }, eventData)).toBe(true);
        expect(await hostViewerCountFilter.predicate({ comparisonType: ComparisonType.LESS_THAN_OR_EQUAL_TO, value: 0 }, eventData)).toBe(true);
    });
});

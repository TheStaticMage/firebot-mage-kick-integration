import { userIdToCleanNumber, userIdToCleanString, parseDate } from '../util';

describe('userIdToCleanString', () => {
    it('returns string for positive number', () => {
        expect(userIdToCleanString(123)).toBe('123');
    });

    it('returns empty string for zero', () => {
        expect(userIdToCleanString(0)).toBe('');
    });

    it('returns empty string for negative number', () => {
        expect(userIdToCleanString(-5)).toBe('');
    });

    it('returns cleaned string for numeric string', () => {
        expect(userIdToCleanString('456')).toBe('456');
    });

    it('returns a number for a kickified user ID', () => {
        expect(userIdToCleanString('k12345')).toBe('12345');
    });

    it('returns empty string for empty string', () => {
        expect(userIdToCleanString('')).toBe('');
    });

    it('throws for non-numeric string', () => {
        expect(() => userIdToCleanString('abc')).toThrow('userId string must be numeric.');
    });

    it('returns empty string for whitespace string', () => {
        expect(userIdToCleanString('   ')).toBe('');
    });

    it('throws for kickified non-numeric string', () => {
        expect(() => userIdToCleanString('kabc')).toThrow('userId string must be numeric.');
    });

    it('returns empty string for undefined', () => {
        expect(userIdToCleanString(undefined as any)).toBe('');
    });
});

describe('userIdToCleanNumber', () => {
    it('returns number for positive number', () => {
        expect(userIdToCleanNumber(123)).toBe(123);
    });

    it('returns 0 for zero', () => {
        expect(userIdToCleanNumber(0)).toBe(0);
    });

    it('returns 0 for negative number', () => {
        expect(userIdToCleanNumber(-5)).toBe(0);
    });

    it('returns number for numeric string', () => {
        expect(userIdToCleanNumber('456')).toBe(456);
    });

    it('returns number for kickified user ID', () => {
        expect(userIdToCleanNumber('k12345')).toBe(12345);
    });

    it('returns 0 for empty string', () => {
        expect(userIdToCleanNumber('')).toBe(0);
    });

    it('returns 0 for whitespace string', () => {
        expect(userIdToCleanNumber('   ')).toBe(0);
    });

    it('throws for non-numeric string', () => {
        expect(() => userIdToCleanNumber('abc')).toThrow('userId string must be numeric.');
    });

    it('throws for kickified non-numeric string', () => {
        expect(() => userIdToCleanNumber('kabc')).toThrow('userId string must be numeric.');
    });

    it('returns 0 for undefined', () => {
        expect(userIdToCleanNumber(undefined as any)).toBe(0);
    });
});

describe('parseDate', () => {
    it('returns undefined for undefined input', () => {
        expect(parseDate(undefined)).toBeUndefined();
    });

    it('returns undefined for null input', () => {
        expect(parseDate(null)).toBeUndefined();
    });

    it('returns undefined for empty string', () => {
        expect(parseDate('')).toBeUndefined();
    });

    it('returns undefined for whitespace string', () => {
        expect(parseDate('   ')).toBeUndefined();
    });

    it('returns undefined for zero date string', () => {
        expect(parseDate('0001-01-01T00:00:00Z')).toBeUndefined();
    });

    it('returns undefined for invalid date string', () => {
        expect(parseDate('invalid-date')).toBeUndefined();
    });

    it('returns Date object for valid ISO date string', () => {
        const result = parseDate('2025-08-20T07:05:42+00:00');
        expect(result).toBeInstanceOf(Date);
        expect(result?.getTime()).toBe(new Date('2025-08-20T07:05:42+00:00').getTime());
    });

    it('returns Date object for valid date string', () => {
        const result = parseDate('2025-12-25T12:00:00Z');
        expect(result).toBeInstanceOf(Date);
        expect(result?.getTime()).toBe(new Date('2025-12-25T12:00:00Z').getTime());
    });

    it('returns undefined for malformed date string', () => {
        expect(parseDate('2025-13-45T25:70:90Z')).toBeUndefined();
    });

    it('handles partial date strings gracefully', () => {
        expect(parseDate('2025')).toBeInstanceOf(Date);
        expect(parseDate('2025-01')).toBeInstanceOf(Date);
        expect(parseDate('2025-01-01')).toBeInstanceOf(Date);
    });
});

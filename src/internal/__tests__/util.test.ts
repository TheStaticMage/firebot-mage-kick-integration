import { userIdToCleanNumber, userIdToCleanString } from '../util';

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

import { getNumberFromUnknown } from '../util';

describe('getNumberFromUnknown', () => {
    it('returns string for valid number input', () => {
        expect(getNumberFromUnknown(42, 'default')).toBe('42');
        expect(getNumberFromUnknown(0, 'default')).toBe('0');
        expect(getNumberFromUnknown(-5, 'default')).toBe('-5');
    });

    it('returns string for valid numeric string input', () => {
        expect(getNumberFromUnknown('123', 'default')).toBe('123');
        expect(getNumberFromUnknown('0', 'default')).toBe('0');
        expect(getNumberFromUnknown('-7', 'default')).toBe('-7');
    });

    it('returns default for NaN, non-numeric string, or undefined', () => {
        expect(getNumberFromUnknown(NaN, 'default')).toBe('default');
        expect(getNumberFromUnknown('abc', 'default')).toBe('default');
        expect(getNumberFromUnknown(undefined, 'default')).toBe('default');
        expect(getNumberFromUnknown(null, 'default')).toBe('default');
        expect(getNumberFromUnknown({}, 'default')).toBe('default');
    });

    it('returns default for empty string', () => {
        expect(getNumberFromUnknown('', 'default')).toBe('default');
    });
});

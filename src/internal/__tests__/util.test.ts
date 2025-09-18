import {
    userIdToCleanNumber,
    userIdToCleanString,
    parseDate,
    kickifyUserId,
    unkickifyUserId,
    kickifyUsername,
    unkickifyUsername
} from '../util';

describe('kickifyUserId', () => {
    it('returns empty string for undefined', () => {
        expect(kickifyUserId(undefined)).toBe('');
    });

    it('returns empty string for null', () => {
        expect(kickifyUserId(null as any)).toBe('');
    });

    it('adds k prefix to numeric userId', () => {
        expect(kickifyUserId(12345)).toBe('k12345');
    });

    it('adds k prefix to string userId', () => {
        expect(kickifyUserId('67890')).toBe('k67890');
    });

    it('does not add k prefix if already present', () => {
        expect(kickifyUserId('k12345')).toBe('k12345');
    });

    it('handles zero userId', () => {
        expect(kickifyUserId(0)).toBe('k0');
    });

    it('handles empty string', () => {
        expect(kickifyUserId('')).toBe('k');
    });

    it('handles string that starts with k but is not kickified', () => {
        expect(kickifyUserId('kabc')).toBe('kabc');
    });
});

describe('unkickifyUserId', () => {
    it('returns empty string for undefined', () => {
        expect(unkickifyUserId(undefined)).toBe('');
    });

    it('returns empty string for null', () => {
        expect(unkickifyUserId(null as any)).toBe('');
    });

    it('removes k prefix from kickified userId', () => {
        expect(unkickifyUserId('k12345')).toBe('12345');
    });

    it('returns as-is for non-kickified userId', () => {
        expect(unkickifyUserId('67890')).toBe('67890');
    });

    it('handles numeric input by converting to string', () => {
        expect(unkickifyUserId(12345)).toBe('12345');
    });

    it('handles zero', () => {
        expect(unkickifyUserId(0)).toBe('0');
    });

    it('handles empty string', () => {
        expect(unkickifyUserId('')).toBe('');
    });

    it('handles single k character', () => {
        expect(unkickifyUserId('k')).toBe('');
    });

    it('handles k with other text', () => {
        expect(unkickifyUserId('kabc')).toBe('abc');
    });
});

describe('kickifyUsername', () => {
    it('returns empty string for undefined', () => {
        expect(kickifyUsername(undefined)).toBe('');
    });

    it('returns empty string for empty string', () => {
        expect(kickifyUsername('')).toBe('');
    });

    it('adds @kick suffix to username', () => {
        expect(kickifyUsername('testuser')).toBe('testuser@kick');
    });

    it('does not add @kick suffix if already present', () => {
        expect(kickifyUsername('testuser@kick')).toBe('testuser@kick');
    });

    it('handles username with @ symbol but not @kick', () => {
        expect(kickifyUsername('user@other')).toBe('user@other@kick');
    });

    it('handles username that ends with partial @kick', () => {
        expect(kickifyUsername('user@kic')).toBe('user@kic@kick');
    });

    it('handles single character username', () => {
        expect(kickifyUsername('a')).toBe('a@kick');
    });

    it('removes leading @ symbol from username', () => {
        expect(kickifyUsername('@testuser')).toBe('testuser@kick');
    });

    it('handles username with leading @ that already has @kick suffix', () => {
        expect(kickifyUsername('@testuser@kick')).toBe('testuser@kick');
    });

    it('handles username with multiple leading @ symbols', () => {
        expect(kickifyUsername('@@testuser')).toBe('@testuser@kick');
    });
});

describe('unkickifyUsername', () => {
    it('returns empty string for undefined', () => {
        expect(unkickifyUsername(undefined)).toBe('');
    });

    it('returns empty string for empty string', () => {
        expect(unkickifyUsername('')).toBe('');
    });

    it('removes @kick suffix from username', () => {
        expect(unkickifyUsername('testuser@kick')).toBe('testuser');
    });

    it('returns as-is for username without @kick suffix', () => {
        expect(unkickifyUsername('testuser')).toBe('testuser');
    });

    it('removes leading @ symbol after removing @kick', () => {
        expect(unkickifyUsername('@testuser@kick')).toBe('testuser');
    });

    it('handles username that is just @kick', () => {
        expect(unkickifyUsername('@kick')).toBe('');
    });

    it('handles username with @ but not @kick suffix', () => {
        expect(unkickifyUsername('user@other')).toBe('user@other');
    });

    it('handles username with multiple @ symbols', () => {
        expect(unkickifyUsername('@user@test@kick')).toBe('user@test');
    });

    it('removes @ prefix from regular username', () => {
        expect(unkickifyUsername('@username')).toBe('username');
    });

    it('handles complex username with @ prefix and @kick suffix', () => {
        expect(unkickifyUsername('@complex.user-name123@kick')).toBe('complex.user-name123');
    });
});

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

    it('handles large numbers within safe integer range', () => {
        const maxSafeInteger = Number.MAX_SAFE_INTEGER; // 9007199254740991
        expect(userIdToCleanNumber(maxSafeInteger.toString())).toBe(maxSafeInteger);
        expect(userIdToCleanNumber(maxSafeInteger)).toBe(maxSafeInteger);
    });

    it('throws for numbers exceeding MAX_SAFE_INTEGER', () => {
        const unsafeInteger = '9007199254740992'; // MAX_SAFE_INTEGER + 1
        expect(() => userIdToCleanNumber(unsafeInteger)).toThrow('userId number 9007199254740992 exceeds maximum safe integer value (9007199254740991)');
    });

    it('throws for very large numbers', () => {
        const veryLargeNumber = '99999999999999999999999999999';
        expect(() => userIdToCleanNumber(veryLargeNumber)).toThrow('exceeds maximum safe integer value');
    });

    it('throws for kickified numbers exceeding MAX_SAFE_INTEGER', () => {
        const unsafeKickifiedId = 'k9007199254740992'; // MAX_SAFE_INTEGER + 1 with k prefix
        expect(() => userIdToCleanNumber(unsafeKickifiedId)).toThrow('userId number 9007199254740992 exceeds maximum safe integer value (9007199254740991)');
    });

    it('handles edge case near MAX_SAFE_INTEGER', () => {
        const nearMaxSafe = (Number.MAX_SAFE_INTEGER - 1).toString();
        expect(userIdToCleanNumber(nearMaxSafe)).toBe(Number.MAX_SAFE_INTEGER - 1);
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

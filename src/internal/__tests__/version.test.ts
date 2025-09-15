jest.mock('../../main', () => ({
    firebot: {
        firebot: {
            version: '5.65.0'
        }
    }
}));

import { requireVersion } from '../version';
import { firebot } from '../../main';

describe('requireVersion', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('firebot availability checks', () => {
        it('should throw error when firebot.firebot is not available', () => {
            const originalFirebotInner = firebot.firebot;
            (firebot as any).firebot = undefined;

            expect(() => {
                requireVersion('5.65.0');
            }).toThrow('Firebot version information is not available.');

            (firebot as any).firebot = originalFirebotInner;
        });

        it('should throw error when version is not available', () => {
            const originalVersion = firebot.firebot.version;
            (firebot.firebot as any).version = undefined;

            expect(() => {
                requireVersion('5.65.0');
            }).toThrow('Firebot version information is not available.');

            (firebot.firebot as any).version = originalVersion;
        });
    });

    describe('major.minor version checking (no patch)', () => {
        it('should pass when major version is higher', () => {
            (firebot.firebot as any).version = '6.0.0';
            expect(() => {
                requireVersion('5.65');
            }).not.toThrow();
        });

        it('should pass when major.minor version is equal', () => {
            (firebot.firebot as any).version = '5.65.0';
            expect(() => {
                requireVersion('5.65');
            }).not.toThrow();
        });

        it('should pass when major is equal and minor is higher', () => {
            (firebot.firebot as any).version = '5.70.0';
            expect(() => {
                requireVersion('5.65');
            }).not.toThrow();
        });

        it('should throw when major version is lower', () => {
            (firebot.firebot as any).version = '4.99.0';
            expect(() => {
                requireVersion('5.65');
            }).toThrow('Firebot version must be >= 5.65 to use this feature (got 4.99.0).');
        });

        it('should throw when major is equal but minor is lower', () => {
            (firebot.firebot as any).version = '5.64.0';
            expect(() => {
                requireVersion('5.65');
            }).toThrow('Firebot version must be >= 5.65 to use this feature (got 5.64.0).');
        });
    });

    describe('major.minor.patch version checking', () => {
        it('should pass when major.minor.patch version is equal', () => {
            (firebot.firebot as any).version = '5.65.3';
            expect(() => {
                requireVersion('5.65.3');
            }).not.toThrow();
        });

        it('should pass when patch version is higher', () => {
            (firebot.firebot as any).version = '5.65.5';
            expect(() => {
                requireVersion('5.65.3');
            }).not.toThrow();
        });

        it('should pass when minor version is higher (patch ignored)', () => {
            (firebot.firebot as any).version = '5.66.0';
            expect(() => {
                requireVersion('5.65.3');
            }).not.toThrow();
        });

        it('should pass when major version is higher (minor and patch ignored)', () => {
            (firebot.firebot as any).version = '6.0.0';
            expect(() => {
                requireVersion('5.65.3');
            }).not.toThrow();
        });

        it('should throw when patch version is lower', () => {
            (firebot.firebot as any).version = '5.65.2';
            expect(() => {
                requireVersion('5.65.3');
            }).toThrow('Firebot version must be >= 5.65.3 to use this feature (got 5.65.2).');
        });

        it('should throw when minor version is lower (regardless of patch)', () => {
            (firebot.firebot as any).version = '5.64.9';
            expect(() => {
                requireVersion('5.65.0');
            }).toThrow('Firebot version must be >= 5.65.0 to use this feature (got 5.64.9).');
        });

        it('should throw when major version is lower (regardless of minor and patch)', () => {
            (firebot.firebot as any).version = '4.99.99';
            expect(() => {
                requireVersion('5.0.0');
            }).toThrow('Firebot version must be >= 5.0.0 to use this feature (got 4.99.99).');
        });
    });

    describe('edge cases and malformed versions', () => {
        it('should handle version with missing minor component in firebot version', () => {
            (firebot.firebot as any).version = '5';
            expect(() => {
                requireVersion('5.0');
            }).not.toThrow();
        });

        it('should handle version with missing patch component in firebot version', () => {
            (firebot.firebot as any).version = '5.65';
            expect(() => {
                requireVersion('5.65.0');
            }).not.toThrow();
        });

        it('should handle requirement with missing minor component', () => {
            (firebot.firebot as any).version = '5.65.0';
            expect(() => {
                requireVersion('5');
            }).not.toThrow();
        });

        it('should treat missing components as zero in firebot version', () => {
            (firebot.firebot as any).version = '5';
            expect(() => {
                requireVersion('5.1');
            }).toThrow('Firebot version must be >= 5.1 to use this feature (got 5).');
        });

        it('should treat missing components as zero in requirement version', () => {
            (firebot.firebot as any).version = '5.0.0';
            expect(() => {
                requireVersion('5');
            }).not.toThrow();
        });

        it('should handle beta/pre-release versions', () => {
            (firebot.firebot as any).version = '5.65.1-beta.2';
            expect(() => {
                requireVersion('5.65.0');
            }).not.toThrow();
        });

        it('should handle version with non-numeric patch part', () => {
            (firebot.firebot as any).version = '5.65.1-alpha';
            expect(() => {
                requireVersion('5.65.1');
            }).not.toThrow();
        });
    });

    describe('zero versions', () => {
        it('should handle zero major version', () => {
            (firebot.firebot as any).version = '0.5.0';
            expect(() => {
                requireVersion('0.5');
            }).not.toThrow();
        });

        it('should handle zero minor version', () => {
            (firebot.firebot as any).version = '5.0.3';
            expect(() => {
                requireVersion('5.0.2');
            }).not.toThrow();
        });

        it('should handle zero patch version', () => {
            (firebot.firebot as any).version = '5.65.0';
            expect(() => {
                requireVersion('5.65.0');
            }).not.toThrow();
        });

        it('should handle all zero version', () => {
            (firebot.firebot as any).version = '0.0.0';
            expect(() => {
                requireVersion('0.0.0');
            }).not.toThrow();
        });
    });

    describe('real-world scenarios', () => {
        it('should handle current typical usage (5.65)', () => {
            (firebot.firebot as any).version = '5.65.0';
            expect(() => {
                requireVersion('5.65');
            }).not.toThrow();
        });

        it('should handle future major version bump', () => {
            (firebot.firebot as any).version = '6.0.0';
            expect(() => {
                requireVersion('5.65');
            }).not.toThrow();
        });

        it('should handle specific patch requirements', () => {
            (firebot.firebot as any).version = '5.65.4';
            expect(() => {
                requireVersion('5.65.3');
            }).not.toThrow();
        });

        it('should fail for insufficient patch version', () => {
            (firebot.firebot as any).version = '5.65.2';
            expect(() => {
                requireVersion('5.65.3');
            }).toThrow('Firebot version must be >= 5.65.3 to use this feature (got 5.65.2).');
        });
    });
});

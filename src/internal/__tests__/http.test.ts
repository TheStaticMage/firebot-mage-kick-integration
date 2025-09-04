jest.mock('../../main', () => ({
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

import { httpCallWithTimeout } from '../http';

describe('httpCallWithTimeout', () => {
    beforeEach(() => {
        global.fetch = jest.fn();
        jest.useFakeTimers();
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('returns JSON on success', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ foo: 'bar' }),
            headers: { get: () => 'application/json' }
        });
        const result = await httpCallWithTimeout({ url: 'http://test', method: 'GET' });
        expect(result).toEqual({ foo: 'bar' });
    });

    it('throws on HTTP error with text body', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: false,
            status: 404,
            json: async () => {
                throw new Error('not json');
            },
            text: async () => 'not found',
            headers: { get: () => 'text/plain' }
        });
        await expect(httpCallWithTimeout({ url: 'http://test', method: 'GET' })).rejects.toThrow(/HTTP error! Status: 404/);
        try {
            await httpCallWithTimeout({ url: 'http://test', method: 'GET' });
        } catch (e: any) {
            expect(e.message).toMatch(/not found/);
        }
    });

    it('follows redirects correctly but eventually resolves', async () => {
        let callCount = 0;
        (global.fetch as jest.Mock).mockImplementation(() => {
            callCount++;
            if (callCount <= 5) {
                return Promise.resolve({
                    ok: true,
                    status: 302,
                    url: 'http://redirect',
                    headers: { get: () => 'application/json' }
                });
            }
            return Promise.resolve({
                ok: true,
                status: 200,
                json: async () => ({ done: true }),
                headers: { get: () => 'application/json' }
            });
        });
        const result = await httpCallWithTimeout({ url: 'http://test', method: 'GET' });
        expect(result).toEqual({ done: true });
    });

    it('follows redirects to new URLs correctly', async () => {
        const fetchedUrls: string[] = [];
        (global.fetch as jest.Mock).mockImplementation((url) => {
            fetchedUrls.push(url);
            if (url === 'http://original') {
                return Promise.resolve({
                    ok: true,
                    status: 301,
                    url: 'http://redirected',
                    headers: { get: () => 'application/json' }
                });
            } else if (url === 'http://redirected') {
                return Promise.resolve({
                    ok: true,
                    status: 302,
                    url: 'http://final',
                    headers: { get: () => 'application/json' }
                });
            } else if (url === 'http://final') {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => ({ final: true }),
                    headers: { get: () => 'application/json' }
                });
            }
            throw new Error(`Unexpected URL: ${url}`);
        });

        const result = await httpCallWithTimeout({ url: 'http://original', method: 'GET' });
        expect(result).toEqual({ final: true });
        expect(fetchedUrls).toEqual(['http://original', 'http://redirected', 'http://final']);
    });

    it('throws error after too many redirects', async () => {
        (global.fetch as jest.Mock).mockImplementation(() => {
            return Promise.resolve({
                ok: true,
                status: 301,
                url: 'http://infinite-redirect',
                headers: { get: () => 'application/json' }
            });
        });

        await expect(
            httpCallWithTimeout({ url: 'http://test', method: 'GET' })
        ).rejects.toThrow(/Too many redirects \(11\)/);
    });

    it('throws error when redirect response has no url', async () => {
        (global.fetch as jest.Mock).mockImplementation(() => {
            return Promise.resolve({
                ok: true,
                status: 302,
                url: '', // Empty URL simulates missing Location header
                headers: { get: () => 'application/json' }
            });
        });

        await expect(
            httpCallWithTimeout({ url: 'http://test', method: 'GET' })
        ).rejects.toThrow(/Redirect response missing Location header/);
    });

    it('follows redirects to new URLs correctly', async () => {
        const fetchedUrls: string[] = [];
        (global.fetch as jest.Mock).mockImplementation((url) => {
            fetchedUrls.push(url);
            if (url === 'http://original') {
                return Promise.resolve({
                    ok: true,
                    status: 301,
                    url: 'http://redirected',
                    headers: { get: () => 'application/json' }
                });
            } else if (url === 'http://redirected') {
                return Promise.resolve({
                    ok: true,
                    status: 302,
                    url: 'http://final',
                    headers: { get: () => 'application/json' }
                });
            } else if (url === 'http://final') {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => ({ final: true }),
                    headers: { get: () => 'application/json' }
                });
            }
            throw new Error(`Unexpected URL: ${url}`);
        });

        const result = await httpCallWithTimeout({ url: 'http://original', method: 'GET' });
        expect(result).toEqual({ final: true });
        expect(fetchedUrls).toEqual(['http://original', 'http://redirected', 'http://final']);
    });

    it('throws error after too many redirects', async () => {
        (global.fetch as jest.Mock).mockImplementation(() => {
            return Promise.resolve({
                ok: true,
                status: 301,
                url: 'http://infinite-redirect',
                headers: { get: () => 'application/json' }
            });
        });

        await expect(
            httpCallWithTimeout({ url: 'http://test', method: 'GET' })
        ).rejects.toThrow(/Too many redirects \(11\)/);
    });

    it('throws error when redirect response has no url', async () => {
        (global.fetch as jest.Mock).mockImplementation(() => {
            return Promise.resolve({
                ok: true,
                status: 302,
                url: '', // Empty URL simulates missing Location header
                headers: { get: () => 'application/json' }
            });
        });

        await expect(
            httpCallWithTimeout({ url: 'http://test', method: 'GET' })
        ).rejects.toThrow(/Redirect response missing Location header/);
    });

    it('respects custom maxRedirects parameter', async () => {
        (global.fetch as jest.Mock).mockImplementation(() => {
            return Promise.resolve({
                ok: true,
                status: 301,
                url: 'http://infinite-redirect',
                headers: { get: () => 'application/json' }
            });
        });

        await expect(
            httpCallWithTimeout({ url: 'http://test', method: 'GET', maxRedirects: 3 })
        ).rejects.toThrow(/Too many redirects \(4\)/);
    });

    it('allows zero redirects when maxRedirects is 0', async () => {
        (global.fetch as jest.Mock).mockImplementation(() => {
            return Promise.resolve({
                ok: true,
                status: 301,
                url: 'http://redirect',
                headers: { get: () => 'application/json' }
            });
        });

        await expect(
            httpCallWithTimeout({ url: 'http://test', method: 'GET', maxRedirects: 0 })
        ).rejects.toThrow(/Too many redirects \(1\)/);
    });

    it('uses default maxRedirects when not specified', async () => {
        (global.fetch as jest.Mock).mockImplementation(() => {
            return Promise.resolve({
                ok: true,
                status: 301,
                url: 'http://infinite-redirect',
                headers: { get: () => 'application/json' }
            });
        });

        // Should use default of 10 redirects
        await expect(
            httpCallWithTimeout({ url: 'http://test', method: 'GET' })
        ).rejects.toThrow(/Too many redirects \(11\)/);
    });

    it('resets timeout on redirects', async () => {
        let callCount = 0;

        (global.fetch as jest.Mock).mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                // First call - immediate redirect
                return Promise.resolve({
                    ok: true,
                    status: 302,
                    url: 'http://redirected',
                    headers: { get: () => 'application/json' }
                });
            }
            // Second call - immediate success
            return Promise.resolve({
                ok: true,
                status: 200,
                json: async () => ({ redirected: true }),
                headers: { get: () => 'application/json' }
            });
        });

        // This test verifies that we can complete a redirect chain
        // The key is that the timeout should reset on redirect
        const result = await httpCallWithTimeout({
            url: 'http://original',
            method: 'GET',
            timeout: 1000
        });

        expect(result).toEqual({ redirected: true });
        expect(callCount).toBe(2);
    });

    it('returns empty object for 204', async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            status: 204,
            headers: { get: () => 'application/json' }
        });
        const result = await httpCallWithTimeout({ url: 'http://test', method: 'GET' });
        expect(result).toEqual({});
    });

    it('aborts on timeout', async () => {
        (global.fetch as jest.Mock).mockImplementation((_, options) => {
            return new Promise((_, reject) => {
                if (options && options.signal) {
                    options.signal.addEventListener('abort', () => {
                        reject(new DOMException('Aborted', 'AbortError'));
                    });
                }
            });
        });
        const promise = httpCallWithTimeout({ url: 'http://test', method: 'GET', timeout: 10 });
        jest.advanceTimersByTime(20);
        await expect(promise).rejects.toThrow(/abort/i);
    });

    it('aborts if signal is already aborted', async () => {
        const controller = new AbortController();
        controller.abort();
        await expect(httpCallWithTimeout({ url: 'http://test', method: 'GET', signal: controller.signal })).rejects.toThrow('API request aborted');
    });

    it('retries on 429 rate limit and succeeds', async () => {
        const { logger } = require('../../main');
        let callCount = 0;
        (global.fetch as jest.Mock).mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                return Promise.resolve({
                    ok: false,
                    status: 429,
                    headers: { get: () => 'application/json' }
                });
            }
            return Promise.resolve({
                ok: true,
                status: 200,
                json: async () => ({ success: true }),
                headers: { get: () => 'application/json' }
            });
        });

        // Mock setTimeout to resolve immediately for testing
        const originalSetTimeout = global.setTimeout;
        global.setTimeout = ((fn: (...args: any[]) => void) => {
            fn();
            return 123 as any;
        }) as any;

        try {
            const result = await httpCallWithTimeout({ url: 'http://test', method: 'GET' });
            expect(result).toEqual({ success: true });
            expect(logger.warn).toHaveBeenCalledWith('Rate limit exceeded for http://test. Retrying in 500ms...');
            expect(callCount).toBe(2);
        } finally {
            global.setTimeout = originalSetTimeout;
        }
    });

    it('retries multiple times on 429 with exponential backoff', async () => {
        let callCount = 0;
        const backoffDelays: number[] = [];

        (global.fetch as jest.Mock).mockImplementation(() => {
            callCount++;
            if (callCount <= 3) {
                return Promise.resolve({
                    ok: false,
                    status: 429,
                    headers: { get: () => 'application/json' }
                });
            }
            return Promise.resolve({
                ok: true,
                status: 200,
                json: async () => ({ success: true }),
                headers: { get: () => 'application/json' }
            });
        });

        // Mock setTimeout to capture backoff delays and resolve immediately
        const originalSetTimeout = global.setTimeout;
        global.setTimeout = ((fn: (...args: any[]) => void, delay: number) => {
            if (delay > 0 && delay < 10000) { // Filter out timeout delays, only capture backoff delays
                backoffDelays.push(delay);
            }
            fn();
            return 123 as any;
        }) as any;

        try {
            const result = await httpCallWithTimeout({ url: 'http://test', method: 'GET' });
            expect(result).toEqual({ success: true });
            expect(backoffDelays).toEqual([500, 1000, 2000]);
            expect(callCount).toBe(4);
        } finally {
            global.setTimeout = originalSetTimeout;
        }
    });

    it('caps backoff at 5000ms for 429 retries', async () => {
        let callCount = 0;
        const backoffDelays: number[] = [];

        (global.fetch as jest.Mock).mockImplementation(() => {
            callCount++;
            if (callCount <= 5) {
                return Promise.resolve({
                    ok: false,
                    status: 429,
                    headers: { get: () => 'application/json' }
                });
            }
            return Promise.resolve({
                ok: true,
                status: 200,
                json: async () => ({ success: true }),
                headers: { get: () => 'application/json' }
            });
        });

        // Mock setTimeout to capture backoff delays and resolve immediately
        const originalSetTimeout = global.setTimeout;
        global.setTimeout = ((fn: (...args: any[]) => void, delay: number) => {
            if (delay > 0 && delay < 10000) { // Filter out timeout delays, only capture backoff delays
                backoffDelays.push(delay);
            }
            fn();
            return 123 as any;
        }) as any;

        try {
            const result = await httpCallWithTimeout({ url: 'http://test', method: 'GET' });
            expect(result).toEqual({ success: true });
            expect(backoffDelays).toEqual([500, 1000, 2000, 4000, 5000]); // Last one should be capped at 5000
            expect(callCount).toBe(6);
        } finally {
            global.setTimeout = originalSetTimeout;
        }
    });

    it('throws timeout error when 429 retries would exceed effectiveTimeout', async () => {
        const { logger } = require('../../main');
        let callCount = 0;

        (global.fetch as jest.Mock).mockImplementation(() => {
            callCount++;
            // Always return 429 to trigger retries
            return Promise.resolve({
                ok: false,
                status: 429,
                headers: { get: () => 'application/json' }
            });
        });

        // Mock performance.now to simulate time passing
        const originalPerformanceNow = performance.now.bind(performance);
        let mockTime = 0;
        performance.now = jest.fn(() => mockTime);

        // Mock setTimeout to track delays and simulate immediate execution
        const originalSetTimeout = global.setTimeout;
        global.setTimeout = ((fn: (...args: any[]) => void, delay: number) => {
            if (delay > 0 && delay < 10000) {
                // Simulate time passing during backoff
                mockTime += delay;
            }
            fn();
            return 123 as any;
        }) as any;

        try {
            await expect(
                httpCallWithTimeout({ url: 'http://test', method: 'GET', timeout: 1000 })
            ).rejects.toThrow(/Request timeout exceeded during rate limit retries/);

            // Should have made at least one attempt before timeout
            expect(callCount).toBeGreaterThanOrEqual(1);
            expect(logger.warn).toHaveBeenCalledWith(
                expect.stringContaining('Rate limit retry would exceed timeout for http://test')
            );
        } finally {
            global.setTimeout = originalSetTimeout;
            performance.now = originalPerformanceNow;
        }
    });
});

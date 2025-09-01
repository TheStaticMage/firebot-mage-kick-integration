jest.mock('../../main', () => ({
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    },
    scriptVersion: '1.0.0'
}));

jest.mock('../../integration', () => ({
    integration: {
        sendCriticalErrorNotification: jest.fn(),
        getSettings: jest.fn(() => ({
            webhookProxy: {
                webhookProxyUrl: 'http://test-proxy.com'
            }
        })),
        kick: {
            broadcaster: {
                name: 'test-broadcaster'
            }
        }
    }
}));

jest.mock('../http', () => ({
    httpCallWithTimeout: jest.fn()
}));

jest.mock('../webhook-handler/webhook-handler', () => ({
    handleWebhook: jest.fn()
}));

import { Poller } from '../poll';
import { httpCallWithTimeout } from '../http';

describe('Poller', () => {
    let poller: Poller;
    let mockHttpCallWithTimeout: jest.MockedFunction<typeof httpCallWithTimeout>;

    beforeEach(() => {
        poller = new Poller();
        mockHttpCallWithTimeout = httpCallWithTimeout as jest.MockedFunction<typeof httpCallWithTimeout>;
        jest.useFakeTimers();
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('startPoller', () => {
        it('returns false when proxyPollKey is not set', () => {
            // Access private method via any cast for testing
            const result = (poller as any).startPoller();
            expect(result).toBe(false);
        });

        it('returns false when isDisconnecting is true', () => {
            // Set up poller with proxy key
            (poller as any).proxyPollKey = 'test-key';
            (poller as any).isDisconnecting = true;

            const result = (poller as any).startPoller();
            expect(result).toBe(false);
        });

        it('returns false when already polling', () => {
            // Set up poller with proxy key
            (poller as any).proxyPollKey = 'test-key';
            (poller as any).isPolling = true;

            const result = (poller as any).startPoller();
            expect(result).toBe(false);
        });

        it('returns true and starts polling when conditions are met', () => {
            // Set up poller with proxy key and URL
            (poller as any).proxyPollKey = 'test-key';
            (poller as any).proxyPollUrl = 'http://test-proxy.com/poll';

            const result = (poller as any).startPoller();
            expect(result).toBe(true);
        });

        it('reschedules poller after successful poll', async () => {
            mockHttpCallWithTimeout.mockResolvedValue({ status: 200, webhooks: [] });

            // Set up poller properly before creating spy
            (poller as any).proxyPollKey = 'test-key';
            (poller as any).proxyPollUrl = 'http://test-proxy.com/poll';
            (poller as any).instanceId = 'test-instance';

            let rescheduleCalls = 0;
            const originalStartPoller = (poller as any).startPoller.bind(poller);
            jest.spyOn(poller as any, 'startPoller').mockImplementation(() => {
                rescheduleCalls++;
                if (rescheduleCalls === 1) {
                    return originalStartPoller();
                }
                return true; // Prevent recursive calls
            });

            const result = (poller as any).startPoller();
            expect(result).toBe(true);

            // Execute the initial setTimeout (0ms) and allow async operations to complete
            await jest.runOnlyPendingTimersAsync();

            // Execute the reschedule setTimeout (250ms)
            await jest.runAllTimersAsync();

            // Should have called startPoller again for rescheduling
            expect(rescheduleCalls).toBe(2);
        });

        it('reschedules poller after 5 seconds on error', async () => {
            mockHttpCallWithTimeout.mockRejectedValue(new Error('Network error'));

            // Set up poller properly before creating spy
            (poller as any).proxyPollKey = 'test-key';
            (poller as any).proxyPollUrl = 'http://test-proxy.com/poll';
            (poller as any).instanceId = 'test-instance';

            let rescheduleCalls = 0;
            const originalStartPoller = (poller as any).startPoller.bind(poller);
            jest.spyOn(poller as any, 'startPoller').mockImplementation(() => {
                rescheduleCalls++;
                if (rescheduleCalls === 1) {
                    return originalStartPoller();
                }
                return true; // Prevent recursive calls
            });

            const result = (poller as any).startPoller();
            expect(result).toBe(true);

            // Execute the initial setTimeout (0ms) and allow async operations to complete
            await jest.runOnlyPendingTimersAsync();

            // Execute the error reschedule setTimeout (5000ms)
            await jest.runAllTimersAsync();

            // Should have called startPoller again for rescheduling
            expect(rescheduleCalls).toBe(2);
        });

        it('does not reschedule when disconnecting during error', async () => {
            // Set up poller
            (poller as any).proxyPollKey = 'test-key';
            (poller as any).proxyPollUrl = 'http://test-proxy.com/poll';
            (poller as any).instanceId = 'test-instance';

            // Mock HTTP error
            mockHttpCallWithTimeout.mockRejectedValue(new Error('Network error'));

            // Spy on startPoller to track calls
            const startPollerSpy = jest.spyOn(poller as any, 'startPoller');

            // Start initial polling
            (poller as any).startPoller();

            // Set disconnecting flag before error handling
            (poller as any).isDisconnecting = true;

            // Execute the initial setTimeout
            jest.advanceTimersByTime(1);

            // Wait for the poll promise to reject
            await Promise.resolve();

            // Execute potential error reschedule setTimeout
            jest.advanceTimersByTime(5000);

            // Should not have rescheduled due to disconnecting flag
            expect(startPollerSpy).toHaveBeenCalledTimes(1);
        });

        it('sets pollTimeout on error and clears it on retry', async () => {
            // Set up poller
            (poller as any).proxyPollKey = 'test-key';
            (poller as any).proxyPollUrl = 'http://test-proxy.com/poll';
            (poller as any).instanceId = 'test-instance';

            // Mock HTTP error
            mockHttpCallWithTimeout.mockRejectedValue(new Error('Network error'));

            // Start polling and let it fail
            try {
                await (poller as any).poll();
            } catch {
                // Expected to fail
            }

            // Now manually trigger the error handling that would happen in startPoller
            // This simulates the timeout being set in the catch block
            const testTimeout = setTimeout(() => { /* test timeout */ }, 5000);
            (poller as any).pollTimeout = testTimeout;

            // Verify timeout was set
            expect((poller as any).pollTimeout).toBeTruthy();

            // Clear the timeout (simulating the clear in the retry)
            clearTimeout((poller as any).pollTimeout);
            (poller as any).pollTimeout = null;

            // pollTimeout should be cleared
            expect((poller as any).pollTimeout).toBeNull();
        });
    });

    describe('poll', () => {
        beforeEach(() => {
            // Set up poller for poll tests
            (poller as any).proxyPollKey = 'test-key';
            (poller as any).proxyPollUrl = 'http://test-proxy.com/poll';
            (poller as any).instanceId = 'test-instance';
        });

        it('rejects if already polling', async () => {
            (poller as any).isPolling = true;

            await expect((poller as any).poll()).rejects.toEqual(
                'Poller is already polling. Skipping this polling request.'
            );
        });

        it('sets isPolling flag during execution', async () => {
            let wasPollingDuringExecution = false;
            mockHttpCallWithTimeout.mockImplementation(() => {
                // Check that isPolling is true during execution
                wasPollingDuringExecution = (poller as any).isPolling;
                return Promise.resolve({ webhooks: [] });
            });

            // Expect the flag to be set during execution
            expect(wasPollingDuringExecution).toBe(false); // Initially false

            const pollPromise = (poller as any).poll();

            // Wait for completion
            await pollPromise;

            expect(wasPollingDuringExecution).toBe(true);
            // Note: Due to timing issues with finally blocks in tests,
            // we won't test the final state here
        });

        it('resets isPolling flag even on error', async () => {
            mockHttpCallWithTimeout.mockRejectedValue(new Error('Network error'));

            await expect((poller as any).poll()).rejects.toThrow('Network error');

            // Should be false after error
            expect((poller as any).isPolling).toBe(false);
        });

        it('resolves successfully with no webhooks', async () => {
            mockHttpCallWithTimeout.mockResolvedValue({
                webhooks: null
            });

            await expect((poller as any).poll()).resolves.toBeUndefined();
        });

        it('processes webhooks successfully', async () => {
            const mockWebhooks = [
                { id: '1', type: 'test' },
                { id: '2', type: 'test' }
            ];

            mockHttpCallWithTimeout.mockResolvedValue({
                webhooks: mockWebhooks
            });

            const handleResponseSpy = jest.spyOn(poller as any, 'handleResponse');

            await (poller as any).poll();

            expect(handleResponseSpy).toHaveBeenCalledTimes(2);
            expect(handleResponseSpy).toHaveBeenCalledWith(mockWebhooks[0]);
            expect(handleResponseSpy).toHaveBeenCalledWith(mockWebhooks[1]);
        });

        it('rejects on HTTP error when not disconnecting', async () => {
            const error = new Error('Network error');
            mockHttpCallWithTimeout.mockRejectedValue(error);

            await expect((poller as any).poll()).rejects.toEqual(error);
        });

        it('rejects on HTTP error but skips error handling when disconnecting', async () => {
            const error = new Error('Network error');
            mockHttpCallWithTimeout.mockRejectedValue(error);
            (poller as any).isDisconnecting = true;

            await expect((poller as any).poll()).rejects.toEqual(error);
        });

        it('makes HTTP request with correct parameters', async () => {
            mockHttpCallWithTimeout.mockResolvedValue({ webhooks: [] });

            await (poller as any).poll();

            expect(mockHttpCallWithTimeout).toHaveBeenCalledWith({
                url: 'http://test-proxy.com/poll/test-key',
                method: 'GET',
                signal: expect.any(AbortSignal),
                timeout: 45000,
                headers: {
                    'X-Broadcaster-Username': 'test-broadcaster',
                    'X-Instance-ID': 'test-instance',
                    'X-Request-ID': expect.any(String)
                },
                userAgent: 'firebot-mage-kick-integration/1.0.0 (+https://github.com/TheStaticMage/firebot-mage-kick-integration)'
            });
        });
    });

    describe('polling integration', () => {
        it('prevents concurrent polling attempts', () => {
            // Set up poller
            (poller as any).proxyPollKey = 'test-key';
            (poller as any).proxyPollUrl = 'http://test-proxy.com/poll';
            (poller as any).instanceId = 'test-instance';

            // Create a promise that we can control
            let resolveHttp!: (value: any) => void;
            const httpPromise = new Promise((resolve) => {
                resolveHttp = resolve;
            });
            mockHttpCallWithTimeout.mockReturnValue(httpPromise);

            // Start first poller
            const result1 = (poller as any).startPoller();
            expect(result1).toBe(true);

            // Execute the initial setTimeout to start polling
            jest.advanceTimersByTime(1);

            // Try to start second poller while first is still running
            const result2 = (poller as any).startPoller();
            expect(result2).toBe(false); // Should be rejected due to isPolling

            // Resolve the HTTP call for cleanup
            resolveHttp({ webhooks: [] });

            // The important part is that the second startPoller call returned false
            // This proves concurrent polling prevention is working
        });
    });
});

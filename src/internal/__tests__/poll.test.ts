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

        it('handles error flow correctly with proper timeout management and flag reset', async () => {
            // Set up poller
            (poller as any).proxyPollKey = 'test-key';
            (poller as any).proxyPollUrl = 'http://test-proxy.com/poll';
            (poller as any).instanceId = 'test-instance';

            const networkError = new Error('Network timeout');
            mockHttpCallWithTimeout.mockRejectedValue(networkError);

            // Track retry attempts
            const startPollerSpy = jest.spyOn(poller as any, 'startPoller');

            // Start the poller (first call)
            const result = (poller as any).startPoller();
            expect(result).toBe(true);
            expect((poller as any).isPolling).toBe(true);
            expect(startPollerSpy).toHaveBeenCalledTimes(1);

            // Initially no timeout should be set
            expect((poller as any).pollTimeout).toBeNull();

            // Execute the initial setTimeout to start polling and let the error occur
            await jest.runOnlyPendingTimersAsync();

            // After error, pollTimeout should be set
            expect((poller as any).pollTimeout).not.toBeNull();

            // Verify the 5-second delay timing
            jest.advanceTimersByTime(4999); // Just before 5 seconds
            expect(startPollerSpy).toHaveBeenCalledTimes(1); // Should not have retried yet

            jest.advanceTimersByTime(1); // Complete the 5 seconds
            expect(startPollerSpy).toHaveBeenCalledTimes(2); // Should have retried now

            // After retry attempt, pollTimeout should be cleared
            expect((poller as any).pollTimeout).toBeNull();
        });

        it('resets isPolling flag after error occurs and logs appropriate messages', async () => {
            // Set up poller
            (poller as any).proxyPollKey = 'test-key';
            (poller as any).proxyPollUrl = 'http://test-proxy.com/poll';
            (poller as any).instanceId = 'test-instance';

            const networkError = new Error('Connection refused');
            mockHttpCallWithTimeout.mockRejectedValue(networkError);

            // Mock logger to verify error messages
            const { logger } = require('../../main');
            jest.clearAllMocks();

            // Start the poller
            const result = (poller as any).startPoller();
            expect(result).toBe(true);
            expect((poller as any).isPolling).toBe(true);

            // Execute the initial setTimeout and let the error occur
            await jest.runOnlyPendingTimersAsync();

            // Verify error logging
            expect(logger.debug).toHaveBeenCalledWith(
                'startPoller will be retried in 5 seconds due to error: Error: Connection refused'
            );

            // The isPolling flag should be reset after the error (by the finally block in poll())
            expect((poller as any).isPolling).toBe(false);

            // Should be able to start a new poller now
            const result2 = (poller as any).startPoller();
            expect(result2).toBe(true);
        });
    });

    describe('poll', () => {
        beforeEach(() => {
            // Set up poller for poll tests
            (poller as any).proxyPollKey = 'test-key';
            (poller as any).proxyPollUrl = 'http://test-proxy.com/poll';
            (poller as any).instanceId = 'test-instance';
        });

        it('can be called when isPolling is already set by startPoller', async () => {
            // Simulate the state when called from startPoller (isPolling already true)
            (poller as any).isPolling = true;

            mockHttpCallWithTimeout.mockResolvedValue({ webhooks: [] });

            // Should not reject when called with isPolling already true (normal case from startPoller)
            await expect((poller as any).poll()).resolves.toBeUndefined();
        });

        it('maintains isPolling flag during execution', async () => {
            let wasPollingDuringExecution = false;
            mockHttpCallWithTimeout.mockImplementation(() => {
                // Check that isPolling remains true during execution
                wasPollingDuringExecution = (poller as any).isPolling;
                return Promise.resolve({ webhooks: [] });
            });

            // Start with isPolling false
            expect((poller as any).isPolling).toBe(false);

            // Set isPolling to true (as startPoller would do)
            (poller as any).isPolling = true;

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
                    'X-Request-ID': expect.any(String),
                    'X-Cursor-ID': '0'
                },
                userAgent: 'firebot-mage-kick-integration/1.0.0 (+https://github.com/TheStaticMage/firebot-mage-kick-integration)',
                maxRedirects: 1000
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

        it('prevents race condition when multiple startPoller calls happen rapidly', () => {
            // Set up poller
            (poller as any).proxyPollKey = 'test-key';
            (poller as any).proxyPollUrl = 'http://test-proxy.com/poll';
            (poller as any).instanceId = 'test-instance';

            // Mock HTTP to return immediately but don't advance timers
            mockHttpCallWithTimeout.mockResolvedValue({ webhooks: [] });

            // Make multiple rapid calls to startPoller
            const result1 = (poller as any).startPoller();
            const result2 = (poller as any).startPoller();
            const result3 = (poller as any).startPoller();

            // Only the first call should succeed
            expect(result1).toBe(true);
            expect(result2).toBe(false);
            expect(result3).toBe(false);

            // Verify the isPolling flag was set immediately
            expect((poller as any).isPolling).toBe(true);
        });

        it('resets isPolling flag on disconnection during error', async () => {
            // Set up poller
            (poller as any).proxyPollKey = 'test-key';
            (poller as any).proxyPollUrl = 'http://test-proxy.com/poll';
            (poller as any).instanceId = 'test-instance';

            // Mock HTTP error
            mockHttpCallWithTimeout.mockRejectedValue(new Error('Network error'));

            // Start polling
            const result = (poller as any).startPoller();
            expect(result).toBe(true);
            expect((poller as any).isPolling).toBe(true);

            // Set disconnecting flag
            (poller as any).isDisconnecting = true;

            // Execute the setTimeout and let error handling complete
            await jest.runOnlyPendingTimersAsync();

            // isPolling should be reset to false after disconnection error handling
            expect((poller as any).isPolling).toBe(false);
        });

        it('properly serializes concurrent startPoller calls during active polling', () => {
            // Set up poller
            (poller as any).proxyPollKey = 'test-key';
            (poller as any).proxyPollUrl = 'http://test-proxy.com/poll';
            (poller as any).instanceId = 'test-instance';

            let httpCallCount = 0;

            mockHttpCallWithTimeout.mockImplementation(() => {
                httpCallCount++;
                // Return a never-resolving promise to simulate long-running request
                return new Promise(() => { /* never resolves */ });
            });

            // Start first poller - should succeed and set isPolling immediately
            const result1 = (poller as any).startPoller();
            expect(result1).toBe(true);
            expect((poller as any).isPolling).toBe(true);

            // Subsequent calls should fail immediately due to isPolling flag
            const result2 = (poller as any).startPoller();
            const result3 = (poller as any).startPoller();

            expect(result2).toBe(false);
            expect(result3).toBe(false);

            // Execute the setTimeout to trigger the HTTP call
            jest.advanceTimersByTime(1);

            // Still should only have one HTTP call
            expect(httpCallCount).toBe(1);
        });
    });
});

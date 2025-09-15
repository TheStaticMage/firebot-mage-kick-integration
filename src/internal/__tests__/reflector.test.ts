/* eslint-disable @typescript-eslint/unbound-method */
jest.mock('../../main', () => ({
    firebot: {
        firebot: {
            version: '5.65.0'
        },
        modules: {
            frontendCommunicator: {
                fireEventAsync: jest.fn()
            }
        }
    },
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

import { reflectEvent } from '../reflector';
import { firebot, logger } from '../../main';
import { IntegrationConstants } from '../../constants';

describe('reflectEvent', () => {
    let mockFrontendCommunicator: jest.Mocked<typeof firebot.modules.frontendCommunicator>;
    let mockLogger: jest.Mocked<typeof logger>;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();

        mockFrontendCommunicator = firebot.modules.frontendCommunicator as jest.Mocked<typeof firebot.modules.frontendCommunicator>;
        mockLogger = logger as jest.Mocked<typeof logger>;
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('version checking', () => {
        it('should throw error for Firebot version < 5.65', async () => {
            (firebot.firebot as any).version = '5.64.0';

            await expect(reflectEvent('test-event', { data: 'test' }))
                .rejects
                .toThrow('Firebot version must be >= 5.65 to use this feature (got 5.64.0).');
        });

        it('should throw error for Firebot version < 5', async () => {
            (firebot.firebot as any).version = '4.99.0';

            await expect(reflectEvent('test-event', { data: 'test' }))
                .rejects
                .toThrow('Firebot version must be >= 5.65 to use this feature (got 4.99.0).');
        });

        it('should work with Firebot version = 5.65', async () => {
            (firebot.firebot as any).version = '5.65.0';
            mockFrontendCommunicator.fireEventAsync.mockResolvedValue({ result: 'success' });

            const result = await reflectEvent('test-event', { data: 'test' });

            expect(result).toEqual({ result: 'success' });
        });

        it('should work with Firebot version > 5.65', async () => {
            (firebot.firebot as any).version = '6.0.0';
            mockFrontendCommunicator.fireEventAsync.mockResolvedValue({ result: 'success' });

            const result = await reflectEvent('test-event', { data: 'test' });

            expect(result).toEqual({ result: 'success' });
        });

        it('should handle complex version numbers', async () => {
            (firebot.firebot as any).version = '5.65.1-beta.2';
            mockFrontendCommunicator.fireEventAsync.mockResolvedValue({ result: 'success' });

            const result = await reflectEvent('test-event', { data: 'test' });

            expect(result).toEqual({ result: 'success' });
        });
    });

    describe('successful event reflection', () => {
        beforeEach(() => {
            (firebot.firebot as any).version = '5.65.0';
        });

        it('should reflect async event successfully', async () => {
            const eventData = { userId: '123', message: 'Hello World' };
            const expectedResponse = { success: true, eventId: 'abc123' };

            mockFrontendCommunicator.fireEventAsync.mockResolvedValue(expectedResponse);

            const result = await reflectEvent('chat-message', eventData, true);

            expect(result).toEqual(expectedResponse);
            expect(mockFrontendCommunicator.fireEventAsync).toHaveBeenCalledWith(
                `${IntegrationConstants.INTEGRATION_ID}:reflect-async`,
                {
                    async: true,
                    eventName: 'chat-message',
                    eventData
                }
            );
            expect(mockLogger.debug).toHaveBeenCalledWith(
                'Sending reflect event to frontend: eventName=chat-message, isAsync=true'
            );
        });

        it('should reflect sync event successfully', async () => {
            const eventData = { action: 'ban', userId: '456' };
            const expectedResponse = { acknowledged: true };

            mockFrontendCommunicator.fireEventAsync.mockResolvedValue(expectedResponse);

            const result = await reflectEvent('moderation-action', eventData, false);

            expect(result).toEqual(expectedResponse);
            expect(mockFrontendCommunicator.fireEventAsync).toHaveBeenCalledWith(
                `${IntegrationConstants.INTEGRATION_ID}:reflect-async`,
                {
                    async: false,
                    eventName: 'moderation-action',
                    eventData
                }
            );
            expect(mockLogger.debug).toHaveBeenCalledWith(
                'Sending reflect event to frontend: eventName=moderation-action, isAsync=false'
            );
        });

        it('should default to async=true when not specified', async () => {
            const eventData = { type: 'subscription' };
            mockFrontendCommunicator.fireEventAsync.mockResolvedValue({ ok: true });

            await reflectEvent('sub-event', eventData);

            expect(mockFrontendCommunicator.fireEventAsync).toHaveBeenCalledWith(
                `${IntegrationConstants.INTEGRATION_ID}:reflect-async`,
                {
                    async: true,
                    eventName: 'sub-event',
                    eventData
                }
            );
        });

        it('should handle null event data', async () => {
            mockFrontendCommunicator.fireEventAsync.mockResolvedValue({ received: true });

            const result = await reflectEvent('null-data-event', null);

            expect(result).toEqual({ received: true });
            expect(mockFrontendCommunicator.fireEventAsync).toHaveBeenCalledWith(
                `${IntegrationConstants.INTEGRATION_ID}:reflect-async`,
                {
                    async: true,
                    eventName: 'null-data-event',
                    eventData: null
                }
            );
        });

        it('should handle complex event data structures', async () => {
            const complexEventData = {
                user: { id: '789', name: 'TestUser', roles: ['mod', 'vip'] },
                message: { text: 'Complex message', timestamp: new Date().toISOString() },
                metadata: { platform: 'kick', channel: 'test-channel' }
            };

            mockFrontendCommunicator.fireEventAsync.mockResolvedValue({ processed: true });

            await reflectEvent('complex-event', complexEventData);

            expect(mockFrontendCommunicator.fireEventAsync).toHaveBeenCalledWith(
                `${IntegrationConstants.INTEGRATION_ID}:reflect-async`,
                {
                    async: true,
                    eventName: 'complex-event',
                    eventData: complexEventData
                }
            );
        });
    });

    describe('timeout handling', () => {
        beforeEach(() => {
            (firebot.firebot as any).version = '5.65.0';
        });

        it('should timeout after 1000ms when frontend does not respond', async () => {
            // Mock a promise that never resolves
            mockFrontendCommunicator.fireEventAsync.mockImplementation(
                () => new Promise(() => {
                    // Intentionally never resolves
                })
            );

            const reflectPromise = reflectEvent('slow-event', { data: 'test' });

            // Advance timers by 1000ms
            jest.advanceTimersByTime(1000);

            await expect(reflectPromise).rejects.toThrow('Reflect event timeout');
        });

        it('should not timeout when frontend responds quickly', async () => {
            const quickResponse = { fast: true };
            mockFrontendCommunicator.fireEventAsync.mockResolvedValue(quickResponse);

            const result = await reflectEvent('fast-event', { data: 'test' });

            expect(result).toEqual(quickResponse);
        });

        it('should not timeout when frontend responds just before timeout', async () => {
            const responseData = { justInTime: true };

            // Mock a promise that resolves after 999ms
            mockFrontendCommunicator.fireEventAsync.mockImplementation(
                () => new Promise((resolve) => {
                    setTimeout(() => {
                        resolve(responseData);
                    }, 999);
                })
            );

            const reflectPromise = reflectEvent('just-in-time-event', { data: 'test' });

            // Advance timers by 999ms (just before timeout)
            jest.advanceTimersByTime(999);

            const result = await reflectPromise;
            expect(result).toEqual(responseData);
        });
    });

    describe('error handling', () => {
        beforeEach(() => {
            (firebot.firebot as any).version = '5.65.0';
        });

        it('should propagate frontend communicator errors', async () => {
            const frontendError = new Error('Frontend communication failed');
            mockFrontendCommunicator.fireEventAsync.mockRejectedValue(frontendError);

            await expect(reflectEvent('error-event', { data: 'test' }))
                .rejects
                .toThrow('Frontend communication failed');
        });

        it('should handle empty event name', async () => {
            mockFrontendCommunicator.fireEventAsync.mockResolvedValue({ ok: true });

            await reflectEvent('', { data: 'test' });

            expect(mockFrontendCommunicator.fireEventAsync).toHaveBeenCalledWith(
                `${IntegrationConstants.INTEGRATION_ID}:reflect-async`,
                {
                    async: true,
                    eventName: '',
                    eventData: { data: 'test' }
                }
            );
        });
    });

    describe('type safety', () => {
        beforeEach(() => {
            (firebot.firebot as any).version = '5.65.0';
        });

        it('should preserve return type through generic parameter', async () => {
            interface CustomResponse {
                status: 'success' | 'error';
                data: string[];
            }

            const typedResponse: CustomResponse = {
                status: 'success',
                data: ['item1', 'item2']
            };

            mockFrontendCommunicator.fireEventAsync.mockResolvedValue(typedResponse);

            const result = await reflectEvent<CustomResponse>('typed-event', { input: 'test' });

            expect(result.status).toBe('success');
            expect(result.data).toEqual(['item1', 'item2']);
        });
    });

    describe('integration with constants', () => {
        beforeEach(() => {
            (firebot.firebot as any).version = '5.65.0';
        });

        it('should use correct integration ID in event name', async () => {
            mockFrontendCommunicator.fireEventAsync.mockResolvedValue({ ok: true });

            await reflectEvent('test-event', { data: 'test' });

            expect(mockFrontendCommunicator.fireEventAsync).toHaveBeenCalledWith(
                'mage-kick-integration:reflect-async',
                expect.any(Object)
            );
        });
    });
});

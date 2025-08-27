import type { IKick } from './kick-interface';

export function createMockKick(overrides: Partial<IKick> = {}): IKick {
    return {
        bot: null,
        broadcaster: null,
        channelManager: {} as any,
        chatManager: {} as any,
        userApi: {} as any,
        userManager: {} as any,
        connect: jest.fn(),
        disconnect: jest.fn(),
        getAuthToken: jest.fn().mockReturnValue(''),
        setAuthToken: jest.fn(),
        getBotAuthToken: jest.fn().mockReturnValue(''),
        setBotAuthToken: jest.fn(),
        httpCallWithTimeout: jest.fn(),
        ...overrides
    };
}

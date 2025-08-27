import type { BasicKickUser } from "../shared/types";

export interface IKick {
    bot: BasicKickUser | null;
    broadcaster: BasicKickUser | null;
    channelManager: any;
    chatManager: any;
    userApi: any;
    userManager: any;

    connect(token: string, botToken: string): Promise<void>;
    disconnect(): Promise<void>;
    getAuthToken(): string;
    setAuthToken(token: string): void;
    getBotAuthToken(): string;
    setBotAuthToken(token: string): void;
    httpCallWithTimeout(
        uri: string,
        method: string,
        body?: string,
        signal?: AbortSignal | null,
        timeout?: number,
        authToken?: string
    ): Promise<any>;
}

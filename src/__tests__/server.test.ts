/* eslint-disable @typescript-eslint/unbound-method */
jest.mock("../main", () => ({
    firebot: {
        modules: {
            httpServer: {
                registerCustomRoute: jest.fn(),
                unregisterCustomRoute: jest.fn()
            },
            frontendCommunicator: {
                send: jest.fn()
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

import { IntegrationConstants } from "../constants";
import { registerRoutes, unregisterRoutes } from "../server/server";
import { firebot } from "../main";

type RouteHandler = (req: any, res: any) => void | Promise<void>;

describe("server routes", () => {
    const routeHandlers = new Map<string, RouteHandler>();
    let kickIntegration: any;

    const getRouteHandler = (path: string, method: string) => {
        const handler = routeHandlers.get(`${path}:${method}`);
        if (!handler) {
            throw new Error(`Handler not found for ${path}:${method}`);
        }
        return handler;
    };

    const buildRes = () => {
        const res: any = {};
        res.status = jest.fn().mockReturnValue(res);
        res.json = jest.fn().mockReturnValue(res);
        return res;
    };

    beforeEach(() => {
        routeHandlers.clear();
        jest.clearAllMocks();

        const httpServer = firebot.modules.httpServer as jest.Mocked<typeof firebot.modules.httpServer>;
        httpServer.registerCustomRoute.mockImplementation(
            (_integrationUri: string, path: string, method: string, handler: RouteHandler) => {
                routeHandlers.set(`${path}:${method}`, handler);
                return true;
            }
        );

        kickIntegration = {
            kick: {
                broadcaster: { userId: 1 },
                chatManager: {
                    sendKickChatMessage: jest.fn().mockResolvedValue(true),
                    enqueueMessage: jest.fn().mockReturnValue("msg_123")
                },
                channelManager: {
                    getChannel: jest.fn().mockResolvedValue({ stream: { isLive: true } })
                },
                userManager: {
                    getViewerByUsername: jest.fn().mockResolvedValue({ displayName: "Display Name" })
                }
            }
        };

        registerRoutes(kickIntegration);
    });

    describe("operations/send-chat-message", () => {
        it("rejects missing message", async () => {
            const handler = getRouteHandler("operations/send-chat-message", "POST");
            const req = { body: { chatter: "Streamer" } };
            const res = buildRes();

            await handler(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ success: false, error: "Missing message" });
        });

        it("rejects invalid chatter", async () => {
            const handler = getRouteHandler("operations/send-chat-message", "POST");
            const req = { body: { message: "Hello", chatter: "Viewer" } };
            const res = buildRes();

            await handler(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ success: false, error: "Invalid chatter value" });
        });

        it("rejects when broadcaster is not connected", async () => {
            const handler = getRouteHandler("operations/send-chat-message", "POST");
            kickIntegration.kick.broadcaster = null;

            const req = { body: { message: "Hello", chatter: "Streamer" } };
            const res = buildRes();

            await handler(req, res);

            expect(res.status).toHaveBeenCalledWith(503);
            expect(res.json).toHaveBeenCalledWith({ success: false, error: "Broadcaster not connected" });
        });

        it("sends chat message when offlineSendMode is send-anyway", async () => {
            const handler = getRouteHandler("operations/send-chat-message", "POST");
            kickIntegration.kick.channelManager.getChannel.mockResolvedValue({ stream: { isLive: false } });

            const req = { body: { message: "Hello", chatter: "Streamer", offlineSendMode: "send-anyway" } };
            const res = buildRes();

            await handler(req, res);

            expect(kickIntegration.kick.chatManager.enqueueMessage).toHaveBeenCalledWith("Hello", "Streamer", undefined);
            expect(res.json).toHaveBeenCalledWith({ success: true });
        });

        it("posts a chat feed alert when offlineSendMode is chat-feed-only and stream is offline", async () => {
            const handler = getRouteHandler("operations/send-chat-message", "POST");
            kickIntegration.kick.channelManager.getChannel.mockResolvedValue({ stream: { isLive: false } });

            const req = { body: { message: "Hello", chatter: "Streamer", offlineSendMode: "chat-feed-only" } };
            const res = buildRes();

            await handler(req, res);

            const frontendCommunicator = firebot.modules.frontendCommunicator as jest.Mocked<typeof firebot.modules.frontendCommunicator>;
            expect(frontendCommunicator.send).toHaveBeenCalledWith("chatUpdate", {
                fbEvent: "ChatAlert",
                message: "[Not sent (Kick): Stream offline] Hello"
            });
            expect(kickIntegration.kick.chatManager.enqueueMessage).not.toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith({ success: true });
        });

        it("skips sending when offlineSendMode is do-not-send and stream is offline", async () => {
            const handler = getRouteHandler("operations/send-chat-message", "POST");
            kickIntegration.kick.channelManager.getChannel.mockResolvedValue({ stream: { isLive: false } });

            const req = { body: { message: "Hello", chatter: "Streamer", offlineSendMode: "do-not-send" } };
            const res = buildRes();

            await handler(req, res);

            expect(kickIntegration.kick.chatManager.enqueueMessage).not.toHaveBeenCalled();
            expect(res.json).toHaveBeenCalledWith({ success: true });
        });

        it("sends chat message when offlineSendMode is chat-feed-only and stream is live", async () => {
            const handler = getRouteHandler("operations/send-chat-message", "POST");
            kickIntegration.kick.channelManager.getChannel.mockResolvedValue({ stream: { isLive: true } });

            const req = { body: { message: "Hello", chatter: "Streamer", offlineSendMode: "chat-feed-only" } };
            const res = buildRes();

            await handler(req, res);

            expect(kickIntegration.kick.chatManager.enqueueMessage).toHaveBeenCalledWith("Hello", "Streamer", undefined);
            expect(res.json).toHaveBeenCalledWith({ success: true });
        });
    });

    describe("operations/get-user-display-name", () => {
        it("rejects missing username query param", async () => {
            const handler = getRouteHandler("operations/get-user-display-name", "GET");
            const req = { query: {} };
            const res = buildRes();

            await handler(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ displayName: null, error: "Missing or invalid username query parameter" });
        });

        it("returns display name for existing user", async () => {
            const handler = getRouteHandler("operations/get-user-display-name", "GET");
            const req = { query: { username: "testuser" } };
            const res = buildRes();

            await handler(req, res);

            expect(kickIntegration.kick.userManager.getViewerByUsername).toHaveBeenCalledWith("testuser");
            expect(res.json).toHaveBeenCalledWith({ displayName: "Display Name" });
        });

        it("returns null display name when user not found", async () => {
            const handler = getRouteHandler("operations/get-user-display-name", "GET");
            kickIntegration.kick.userManager.getViewerByUsername.mockResolvedValue(null);

            const req = { query: { username: "missing" } };
            const res = buildRes();

            await handler(req, res);

            expect(res.json).toHaveBeenCalledWith({ displayName: null });
        });
    });

    describe("unregisterRoutes", () => {
        it("unregisters custom routes", () => {
            unregisterRoutes();

            const httpServer = firebot.modules.httpServer as jest.Mocked<typeof firebot.modules.httpServer>;
            expect(httpServer.unregisterCustomRoute).toHaveBeenCalledWith(
                IntegrationConstants.INTEGRATION_URI,
                "operations/send-chat-message",
                "POST"
            );
            expect(httpServer.unregisterCustomRoute).toHaveBeenCalledWith(
                IntegrationConstants.INTEGRATION_URI,
                "operations/get-user-display-name",
                "GET"
            );
        });
    });
});

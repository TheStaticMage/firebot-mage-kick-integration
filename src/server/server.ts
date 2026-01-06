import { SendChatMessageRequest } from "@thestaticmage/mage-platform-lib-client";
import { IntegrationConstants } from "../constants";
import { KickIntegration } from "../integration-singleton";
import { firebot, logger } from "../main";

export function registerRoutes(kickIntegration: KickIntegration) {
    const { httpServer } = firebot.modules;

    httpServer.registerCustomRoute(
        IntegrationConstants.INTEGRATION_URI,
        "operations/send-chat-message",
        "POST",
        async (req, res) => {
            try {
                const { message, chatter, offlineSendMode } = req.body as SendChatMessageRequest;
                if (!message) {
                    res.status(400).json({ success: false, error: "Missing message" });
                    return;
                }
                if (chatter !== "Streamer" && chatter !== "Bot") {
                    res.status(400).json({ success: false, error: "Invalid chatter value" });
                    return;
                }

                const broadcaster = kickIntegration.kick.broadcaster;
                if (!broadcaster) {
                    logger.error("send-chat-message: Broadcaster not connected");
                    res.status(503).json({ success: false, error: "Broadcaster not connected" });
                    return;
                }

                const resolvedOfflineSendMode = offlineSendMode || "send-anyway";
                if (resolvedOfflineSendMode !== "send-anyway") {
                    let isLive = true;
                    try {
                        const channel = await kickIntegration.kick.channelManager.getChannel();
                        isLive = channel?.stream?.isLive ?? true;
                    } catch (error) {
                        logger.warn(`send-chat-message: Failed to check stream status: ${error}`);
                    }

                    if (!isLive) {
                        if (resolvedOfflineSendMode === "chat-feed-only") {
                            const { frontendCommunicator } = firebot.modules;
                            const reason = "Stream offline";
                            frontendCommunicator.send("chatUpdate", {
                                fbEvent: "ChatAlert",
                                message: `[Not sent (Kick): ${reason}] ${message}`
                            });
                            res.json({ success: true });
                            return;
                        }

                        if (resolvedOfflineSendMode === "do-not-send") {
                            logger.debug("send-chat-message: Stream is offline and offlineSendMode is do-not-send. Skipping.");
                            res.json({ success: true });
                            return;
                        }
                    }
                }

                kickIntegration.kick.chatManager.enqueueMessage(message, chatter, undefined);
                res.json({ success: true });
            } catch (error) {
                logger.error(`send-chat-message operation failed: ${error}`);
                res.status(500).json({ success: false, error: String(error) });
            }
        }
    );

    httpServer.registerCustomRoute(
        IntegrationConstants.INTEGRATION_URI,
        "operations/get-user-display-name",
        "GET",
        async (req, res) => {
            try {
                const username = req.query.username;
                if (!username || typeof username !== "string") {
                    res.status(400).json({ displayName: null, error: "Missing or invalid username query parameter" });
                    return;
                }

                const viewer = await kickIntegration.kick.userManager.getViewerByUsername(username);
                const displayName = viewer?.displayName || null;
                res.json({ displayName });
            } catch (error) {
                logger.error(`get-user-display-name operation failed: ${error}`);
                res.status(500).json({ displayName: null, error: String(error) });
            }
        }
    );

    logger.debug("Platform-lib REST API operation handlers registered successfully.");
}

export function unregisterRoutes() {
    const { httpServer } = firebot.modules;

    httpServer.unregisterCustomRoute(
        IntegrationConstants.INTEGRATION_URI,
        "operations/send-chat-message",
        "POST"
    );

    httpServer.unregisterCustomRoute(
        IntegrationConstants.INTEGRATION_URI,
        "operations/get-user-display-name",
        "GET"
    );

    logger.debug("Platform-lib REST API operation handlers unregistered successfully.");
}

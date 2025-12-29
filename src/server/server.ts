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
                const { message, chatter } = req.body;
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

                await kickIntegration.kick.chatManager.sendKickChatMessage(message, chatter, undefined);
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

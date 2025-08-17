import { Effects } from "@crowbartools/firebot-custom-scripts-types/types/effects";
import { IntegrationConstants } from "../constants";
import { logger } from "../main";
import { Kick } from "./kick";
import { platformVariable } from "../variables/platform";

export class ChatManager {
    private kick: Kick;
    private viewerArrivedCache = new Set<string>();

    constructor(kick: Kick) {
        this.kick = kick;
    }

    async sendKickChatMessage(msg: string, chatter: "Streamer" | "Bot"): Promise<boolean> {
        const segments: string[] = [];
        const maxLen = 500;
        while (msg.length > 0) {
            if (msg.length <= maxLen) {
                segments.push(msg);
                break;
            }
            // Try to split at the last space before maxLen
            let splitIdx = msg.lastIndexOf(' ', maxLen);
            if (splitIdx === -1 || splitIdx < maxLen * 0.5) {
                // No reasonable space found, hard split
                splitIdx = maxLen;
            }
            segments.push(msg.slice(0, splitIdx));
            msg = msg.slice(splitIdx).trimStart();
        }
        for (const segment of segments) {
            await this.sendChatMessage(segment, chatter || "Streamer");
        }
        return true;
    }

    private async sendChatMessage(message: string, chatter: "Streamer" | "Bot"): Promise<void> {
        if (!this.kick.broadcaster) {
            logger.error(`[${IntegrationConstants.INTEGRATION_ID}] Cannot send chat message, broadcaster info not available.`);
            return;
        }

        const payload = {
            content: message,
            type: chatter === "Streamer" ? "user" : "bot",
            // eslint-disable-next-line camelcase
            broadcaster_user_id: this.kick.broadcaster.userId
        };

        try {
            await this.kick.httpCallWithTimeout('/public/v1/chat', "POST", JSON.stringify(payload));
            logger.debug(`[${IntegrationConstants.INTEGRATION_ID}] Successfully sent chat message as ${chatter}`);
        } catch (error) {
            logger.error(`[${IntegrationConstants.INTEGRATION_ID}] Failed to send chat message: ${error}`);
        }
    }

    checkViewerArrived(userId: string): boolean {
        if (this.viewerArrivedCache.has(userId)) {
            return false;
        }
        this.viewerArrivedCache.add(userId);
        return true;
    }

    static getPlatformFromTrigger(trigger: Effects.Trigger): string {
        try {
            return platformVariable.evaluator(trigger) || "unknown";
        } catch (error) {
            logger.error(`[${IntegrationConstants.INTEGRATION_ID}] Error determining platform from trigger: ${error}`);
            return "unknown";
        }
    }
}

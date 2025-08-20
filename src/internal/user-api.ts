import { firebot, logger } from "../main";
import { Kick } from "./kick";
import { KickUserManager } from "./user-manager";
import { unkickifyUsername } from "./util";

interface UserBanRequest {
    username: string;
    shouldBeBanned: boolean;
}

export class KickUserApi {
    private kick: Kick;

    constructor(kick: Kick) {
        this.kick = kick;
    }

    start(): void {
        // Listen to user ban request from the UI
        const { frontendCommunicator } = firebot.modules;
        frontendCommunicator.onAsync("update-user-banned-status", async (data: UserBanRequest) => {
            await this.banUserByUsername(data.username, 0, data.shouldBeBanned, 'Banned via Firebot');
        });
    }

    stop(): void {
        // Can't stop listening to frontend communicator events
        logger.debug("User API stopped.");
    }

    async banUserByUsername(username: string, duration: number, shouldBeBanned: boolean, reason = ''): Promise<boolean> {
        if (username.trim() === '') {
            logger.warn("banUserByUsername: No username provided.");
            return false;
        }

        if (unkickifyUsername(username) === username) {
            logger.warn(`banUserByUsername: Username provided that does not seem to be a kick user (${username}).`);
            return false;
        }

        const user = await this.kick.userManager.getViewerByUsername(username);
        if (!user) {
            logger.warn(`banUserByUsername: User not found (${username}).`);
            return false;
        }

        try {
            await this.banUnbanUser(user._id, duration, shouldBeBanned, reason);
            return true;
        } catch (error) {
            logger.error(`Error occurred while banning/unbanning user (${user.username}): ${error}`);
            return false;
        }
    }

    private async banUnbanUser(userId: number | string, duration: number, shouldBeBanned: boolean, reason = ''): Promise<void> {
        const broadcasterUserId = this.kick.broadcaster?.userId || 0;
        if (!broadcasterUserId) {
            throw new Error("banUser: Broadcaster user ID not available.");
        }

        const realUserId = KickUserManager.userIdToCleanNumber(userId);
        if (!realUserId) {
            throw new Error("banUser: Invalid user ID provided.");
        }

        if (realUserId === broadcasterUserId) {
            throw new Error("banUser: Cannot ban broadcaster.");
        }

        const payload: Record<string, any> = {
            // eslint-disable-next-line camelcase
            broadcaster_user_id: broadcasterUserId,
            // eslint-disable-next-line camelcase
            user_id: realUserId
        };
        if (shouldBeBanned) {
            const operation = duration > 0 ? "timeout" : "ban";
            if (duration > 0) {
                payload.duration = duration;
            }
            if (reason) {
                payload.reason = reason;
            }

            logger.debug(`banUser: Sending ${operation} request: ${JSON.stringify(payload)}`);
            await this.kick.httpCallWithTimeout('/public/v1/moderation/bans', "POST", JSON.stringify(payload));
            logger.info(`banUser: User ${operation} successful (userId=${realUserId}, duration=${duration}).`);
        } else {
            logger.debug(`banUser: Sending unban request: ${JSON.stringify(payload)}`);
            await this.kick.httpCallWithTimeout('/public/v1/moderation/bans', "DELETE", JSON.stringify(payload));
            logger.info(`banUser: User unban successful (userId=${realUserId}).`);
        }
    }
}

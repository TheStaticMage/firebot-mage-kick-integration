import { FirebotViewer } from "@crowbartools/firebot-custom-scripts-types/types/modules/viewer-database";
import { IntegrationConstants } from "../constants";
import { integration } from "../integration";
import { firebot, logger } from "../main";
import { KickUser } from "../shared/types";

export class KickUsers {
    private _users = new Map<string, FirebotViewer>();

    static kickifyUserId(userId: string): string {
        return userId.startsWith("k") ? userId : `k${userId}`;
    }

    static unkickifyUserId(userId: string): string {
        return userId.startsWith("k") ? userId.substring(1) : userId;
    }

    static kickifyUsername(username: string): string {
        return username.endsWith("@kick") ? username : `${username}@kick`;
    }

    static unkickifyUsername(username: string): string {
        return username.endsWith("@kick") ? username.substring(0, username.length - 5) : username;
    }

    async getViewer(viewerRequest: KickUser): Promise<FirebotViewer> {
        const userId = KickUsers.kickifyUserId(viewerRequest.userId);
        const username = KickUsers.kickifyUsername(viewerRequest.username);

        if (integration.areDangerousOpsEnabled()) {
            const { viewerDatabase } = firebot.modules;
            let viewer = await viewerDatabase.getViewerById(userId);
            if (viewer) {
                return viewer;
            }

            // CAUTION: This creates viewers in the database. The IDs will not
            // overlap because we hard-code the userId to start with "k" and add
            // "@kick" to the username. However, Firebot still assumes that all
            // users are Twitch users, and there are various places in the code that
            // will break if it comes upon this user.
            viewer = await viewerDatabase.createNewViewer(
                userId,
                username,
                viewerRequest.displayName || viewerRequest.username,
                viewerRequest.profilePicture || "",
                [],
                true
            );
            logger.debug(`[${IntegrationConstants.INTEGRATION_ID}] Created new user: id=${userId}, username=${username}`);
            return viewer;
        }

        const userInMap = this._users.get(userId);
        if (userInMap) {
            return userInMap;
        }

        const fakeViewer: FirebotViewer = {
            _id: userId,
            username: username,
            displayName: viewerRequest.displayName || KickUsers.unkickifyUsername(viewerRequest.username),
            profilePicUrl: viewerRequest.profilePicture || "",
            twitch: false,
            twitchRoles: [],
            online: false,
            onlineAt: 0,
            lastSeen: 0,
            joinDate: 0,
            minutesInChannel: 0,
            chatMessages: 0,
            disableAutoStatAccrual: false,
            disableActiveUserList: false,
            disableViewerList: false,
            metadata: {},
            currency: {},
            ranks: {}
        };
        this._users.set(userId, fakeViewer);
        return fakeViewer;
    }

    async getViewerById(userId: string): Promise<FirebotViewer> {
        const rawUserId = KickUsers.unkickifyUserId(userId);
        const viewerRequest: KickUser = {
            userId: KickUsers.kickifyUserId(rawUserId),
            username: KickUsers.kickifyUsername(rawUserId),
            displayName: rawUserId,
            profilePicture: "https://kick.com/favicon.ico", // Default profile picture
            isVerified: false, // Default value, can be updated later
            channelSlug: "" // No channel slug for generic viewers
            // no identity for generic viewers
        };
        return this.getViewer(viewerRequest);
    }

    async countChatMessage(rawViewerId: string, increment = 1): Promise<void> {
        const userId = KickUsers.kickifyUserId(rawViewerId);

        if (integration.areDangerousOpsEnabled()) {
            const { viewerDatabase } = firebot.modules;
            const viewer = await viewerDatabase.getViewerById(userId);
            if (viewer) {
                await viewerDatabase.updateViewerDataField(userId, "chatMessages", (viewer.chatMessages ?? 0) + increment);
                return;
            }
            logger.warn(`[${IntegrationConstants.INTEGRATION_ID}] Unable to count chat message for viewer ${userId} - viewer not found.`);
            return;
        }

        const userInMap = this._users.get(userId);
        if (userInMap) {
            userInMap.chatMessages = (userInMap.chatMessages ?? 0) + increment;
            this._users.set(userId, userInMap);
            return;
        }

        logger.warn(`[${IntegrationConstants.INTEGRATION_ID}] Unable to count chat message for viewer ${userId} - viewer not found in map.`);
    }
}

export const kickUsers = new KickUsers();

import { FirebotViewer } from "@crowbartools/firebot-custom-scripts-types/types/modules/viewer-database";
import { IntegrationConstants } from "../constants";
import { integration } from "../integration";
import { firebot, logger } from "../main";
import { BasicKickUser, KickUser } from "../shared/types";
import { Kick } from "./kick";
import { parseBasicKickUser } from "./webhook-handler/webhook-handler";
import { kickifyUserId, kickifyUsername, unkickifyUserId, unkickifyUsername } from "./util";

export class KickUserManager {
    private kick: Kick;
    private _users = new Map<string, FirebotViewer>();

    constructor(kick: Kick) {
        this.kick = kick;
    }

    async getBasicKickUser(userId = 0): Promise<BasicKickUser> {
        return new Promise((resolve, reject) => {
            const formVariables = new URLSearchParams();
            if (userId > 0) {
                formVariables.append("id", userId.toString());
            }

            const uri = `/public/v1/users${formVariables.toString().length > 0 ? `?${formVariables.toString()}` : ''}`;
            this.kick.httpCallWithTimeout(uri, "GET")
                .then((response) => {
                    if (!response || !response.data || response.data.length !== 1) {
                        logger.debug(`[${IntegrationConstants.INTEGRATION_ID}] Failed to retrieve user from Kick API response. ${JSON.stringify(response)}`);
                        reject(new Error("Failed to retrieve user from Kick API."));
                    }

                    const user = parseBasicKickUser(response.data[0]);
                    if (!user.userId) {
                        logger.debug(`[${IntegrationConstants.INTEGRATION_ID}] No user ID found in Kick API response.`);
                        reject(new Error("No user ID found in Kick API response."));
                    }

                    logger.debug(`[${IntegrationConstants.INTEGRATION_ID}] Successfully retrieved user: ${user.userId} (${user.name})`);
                    resolve(user);
                })
                .catch((error) => {
                    reject(error);
                });
        });
    }

    async getViewer(viewerRequest: KickUser): Promise<FirebotViewer> {
        const userId = kickifyUserId(viewerRequest.userId);
        const username = kickifyUsername(viewerRequest.username);

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
            displayName: viewerRequest.displayName || unkickifyUsername(viewerRequest.username),
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
        const rawUserId = unkickifyUserId(userId);
        const viewerRequest: KickUser = {
            userId: kickifyUserId(rawUserId),
            username: kickifyUsername(rawUserId),
            displayName: rawUserId,
            profilePicture: "https://kick.com/favicon.ico", // Default profile picture
            isVerified: false, // Default value, can be updated later
            channelSlug: "" // No channel slug for generic viewers
            // no identity for generic viewers
        };
        return this.getViewer(viewerRequest);
    }

    async countChatMessage(rawViewerId: string, increment = 1): Promise<void> {
        const userId = kickifyUserId(rawViewerId);

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

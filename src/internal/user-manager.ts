import { FirebotViewer } from "@crowbartools/firebot-custom-scripts-types/types/modules/viewer-database";
import Datastore from "@seald-io/nedb";
import { IntegrationConstants } from "../constants";
import { integration } from "../integration";
import { logger } from "../main";
import { BasicKickUser, KickUser } from "../shared/types";
import { getDataFilePath } from "../util/datafile";
import { Kick } from "./kick";
import { kickifyUserId, kickifyUsername, unkickifyUserId, unkickifyUsername } from "./util";
import { parseBasicKickUser } from "./webhook-handler/webhook-handler";

export class KickUserManager {
    private kick: Kick;
    private _db: Datastore | null = null;
    private _dbCompactionInterval = 30000;
    private _dbPath = "";

    constructor(kick: Kick) {
        this.kick = kick;
    }

    isViewerDBOn(): boolean {
        return !integration.areDangerousOpsEnabled();
    }

    async connectViewerDatabase(): Promise<void> {
        if (this.isViewerDBOn() !== true) {
            return;
        }

        this._dbPath = getDataFilePath("kick-users.db");

        logger.info(`[${IntegrationConstants.INTEGRATION_ID}] Trying to connect to Kick viewer database...`);
        try {
            this._db = new Datastore({ filename: this._dbPath });
            await this._db.loadDatabaseAsync();
        } catch (error) {
            if (error && typeof error === "object" && "message" in error) {
                logger.error(`[${IntegrationConstants.INTEGRATION_ID}] ViewerDB: Error Loading Database: ${(error as { message: string }).message}`);
            } else {
                logger.error(`[${IntegrationConstants.INTEGRATION_ID}] ViewerDB: Error Loading Database: ${String(error)}`);
            }
            logger.error(`[${IntegrationConstants.INTEGRATION_ID}] ViewerDB: Failed Database Path: ${this._dbPath}`);
            return;
        }

        // Setup our automatic compaction interval to shrink filesize.
        this._db.setAutocompactionInterval(this._dbCompactionInterval);
        setInterval(() => {
            logger.debug(`[${IntegrationConstants.INTEGRATION_ID}] ViewerDB: Compaction should be happening now. Compaction Interval: ${this._dbCompactionInterval}`);
        }, this._dbCompactionInterval);

        logger.info(`[${IntegrationConstants.INTEGRATION_ID}] ViewerDB: Viewer Database Loaded: ${this._dbPath}`);
    }

    disconnectViewerDatabase(): void {
        this._db = null;
        logger.info(`[${IntegrationConstants.INTEGRATION_ID}] ViewerDB: Database disconnected.`);
    }

    async createNewViewer(kickUser: KickUser, roles: string[] = [], isOnline = false): Promise<FirebotViewer | undefined> {
        if (this.isViewerDBOn() !== true) {
            // TODO: Redirect this call to "real" user DB
            throw new Error("This is unavailable because 'allow dangerous operations' is enabled.");
        }
        if (!this._db) {
            return;
        }

        const firebotViewer: FirebotViewer = {
            _id: unkickifyUserId(kickUser.userId.toString()),
            username: unkickifyUsername(kickUser.username),
            displayName: kickUser.displayName || unkickifyUsername(kickUser.username),
            profilePicUrl: kickUser.profilePicture || "",
            twitch: false,
            twitchRoles: roles, // Preserving this naming for now for consistency
            online: isOnline,
            onlineAt: isOnline ? Date.now() : 0,
            lastSeen: Date.now(),
            joinDate: Date.now(),
            minutesInChannel: 0,
            chatMessages: 0,
            disableAutoStatAccrual: false,
            disableActiveUserList: true, // Because this doesn't work
            disableViewerList: true, // Because this doesn't work
            metadata: {},
            currency: {},
            ranks: {}
        };

        try {
            await this._db.insertAsync(firebotViewer);
        } catch (error) {
            logger.error(`[${IntegrationConstants.INTEGRATION_ID}] ViewerDB: Error Creating Viewer: ${String(error)}`);
        }

        firebotViewer._id = kickifyUserId(firebotViewer._id);
        firebotViewer.username = kickifyUsername(firebotViewer.username);
        return firebotViewer;
    }

    async getViewerById(id: string): Promise<FirebotViewer | undefined> {
        if (this.isViewerDBOn() !== true) {
            // TODO: Redirect this call to "real" user DB
            throw new Error("This is unavailable because 'allow dangerous operations' is enabled.");
        }
        if (!this._db) {
            return;
        }

        try {
            const viewer = await this._db.findOneAsync<FirebotViewer>({ _id: id });
            if (viewer) {
                viewer._id = kickifyUserId(viewer._id);
                viewer.username = kickifyUsername(viewer.username);
            }
            return viewer;
        } catch (error) {
            logger.error(`[${IntegrationConstants.INTEGRATION_ID}] ViewerDB: Error Finding Viewer by ID: id=${id}, error=${String(error)}`);
            return undefined;
        }
    }

    async getViewerByUsername(username: string): Promise<FirebotViewer | undefined> {
        if (this.isViewerDBOn() !== true) {
            // TODO: Redirect this call to "real" user DB
            throw new Error("This is unavailable because 'allow dangerous operations' is enabled.");
        }
        if (!this._db) {
            return;
        }

        try {
            const searchTerm = new RegExp(`^${unkickifyUsername(username)}$`, 'i');
            const viewer = await this._db.findOneAsync<FirebotViewer>({ username: { $regex: searchTerm }, twitch: false });
            if (viewer) {
                viewer._id = kickifyUserId(viewer._id);
                viewer.username = kickifyUsername(viewer.username);
            }
            return viewer;
        } catch (error) {
            logger.error(`[${IntegrationConstants.INTEGRATION_ID}] ViewerDB: Error Finding Viewer by Username: username=${username}, error=${String(error)}`);
            return undefined;
        }
    }

    static userIdToCleanNumber(userId: string | number = ""): number {
        const cleanedId = KickUserManager.userIdToCleanString(userId);
        return cleanedId !== "" ? Number(cleanedId) : 0;
    }

    static userIdToCleanString(userId: string | number = ""): string {
        if (typeof userId === "number") {
            return userId > 0 ? userId.toString() : "";
        }

        const unkickifiedUserId = unkickifyUserId(userId);
        if (unkickifiedUserId.trim() !== "") {
            if (!/^\d+$/.test(unkickifiedUserId)) {
                throw new Error("userId string must be numeric.");
            }
            return unkickifiedUserId;
        }
        return "";
    }

    async lookupUserById(userId: string | number = ""): Promise<BasicKickUser> {
        return new Promise((resolve, reject) => {
            const formVariables = new URLSearchParams();
            const unkickifiedUserId = KickUserManager.userIdToCleanString(userId);
            if (unkickifiedUserId !== "") {
                formVariables.append("id", unkickifiedUserId);
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

    async incrementDbField(userId: string, fieldName: string): Promise<void> {
        if (this.isViewerDBOn() !== true) {
            // TODO: Redirect this call to "real" user DB
            throw new Error("This is unavailable because 'allow dangerous operations' is enabled.");
        }
        if (!this._db) {
            return;
        }

        try {
            const updateDoc: Record<string, number> = {};
            updateDoc[fieldName] = 1;

            const { affectedDocuments } = await this._db.updateAsync({ _id: unkickifyUserId(userId), disableAutoStatAccrual: { $ne: true } }, { $inc: updateDoc }, { returnUpdatedDocs: true });

            if (affectedDocuments != null) {
                logger.debug(`[${IntegrationConstants.INTEGRATION_ID}] Incremented DB field '${fieldName}' for user ${userId}. New value: ${(affectedDocuments as any)[fieldName]}`);
            } else {
                logger.warn(`[${IntegrationConstants.INTEGRATION_ID}] Failed to increment DB field '${fieldName}' for user ${userId}. No documents were affected.`);
            }
        } catch (error) {
            logger.error(`[${IntegrationConstants.INTEGRATION_ID}] Error incrementing DB field '${fieldName}' for user ${userId}: ${String(error)}`);
            return;
        }
    }
}

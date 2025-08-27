import { FirebotViewer } from "@crowbartools/firebot-custom-scripts-types/types/modules/viewer-database";
import Datastore from "@seald-io/nedb";
import { integration } from "../integration";
import { logger } from "../main";
import { BasicKickUser, KickUser } from "../shared/types";
import { getDataFilePath } from "../util/datafile";
import { IKick } from "./kick-interface";
import { kickifyUserId, kickifyUsername, unkickifyUserId, unkickifyUsername, userIdToCleanString } from "./util";
import { parseBasicKickUser } from "./webhook-handler/webhook-parsers";

export class KickUserManager {
    private kick: IKick;
    private _db: Datastore | null = null;
    private _dbCompactionInterval = 30000;
    private _dbPath = "";

    constructor(kick: IKick) {
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

        logger.info("Trying to connect to Kick viewer database...");
        try {
            this._db = new Datastore({ filename: this._dbPath });
            await this._db.loadDatabaseAsync();
        } catch (error) {
            if (error && typeof error === "object" && "message" in error) {
                logger.error(`ViewerDB: Error Loading Database: ${(error as { message: string }).message}`);
            } else {
                logger.error(`ViewerDB: Error Loading Database: ${String(error)}`);
            }
            logger.error(`ViewerDB: Failed Database Path: ${this._dbPath}`);
            return;
        }

        // Setup our automatic compaction interval to shrink filesize.
        this._db.setAutocompactionInterval(this._dbCompactionInterval);
        setInterval(() => {
            logger.debug(`ViewerDB: Compaction should be happening now. Compaction Interval: ${this._dbCompactionInterval}`);
        }, this._dbCompactionInterval);

        logger.info(`ViewerDB: Viewer Database Loaded: ${this._dbPath}`);
    }

    disconnectViewerDatabase(): void {
        this._db = null;
        logger.info("ViewerDB: Database disconnected.");
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
            logger.error(`ViewerDB: Error Creating Viewer: ${String(error)}`);
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
            logger.error(`ViewerDB: Error Finding Viewer by ID: id=${id}, error=${String(error)}`);
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
            logger.error(`ViewerDB: Error Finding Viewer by Username: username=${username}, error=${String(error)}`);
            return undefined;
        }
    }

    async lookupUserById(userId: string | number = ""): Promise<BasicKickUser> {
        return new Promise((resolve, reject) => {
            const formVariables = new URLSearchParams();
            const unkickifiedUserId = userIdToCleanString(userId);
            if (unkickifiedUserId !== "") {
                formVariables.append("id", unkickifiedUserId);
            }

            const uri = `/public/v1/users${formVariables.toString().length > 0 ? `?${formVariables.toString()}` : ''}`;
            this.kick.httpCallWithTimeout(uri, "GET")
                .then((response) => {
                    if (!response || !response.data || response.data.length !== 1) {
                        logger.debug(`Failed to retrieve user from Kick API response. ${JSON.stringify(response)}`);
                        reject(new Error("Failed to retrieve user from Kick API."));
                    }

                    const user = parseBasicKickUser(response.data[0]);
                    if (!user.userId) {
                        logger.debug("No user ID found in Kick API response.");
                        reject(new Error("No user ID found in Kick API response."));
                    }

                    logger.debug(`Successfully retrieved user: ${user.userId} (${user.name})`);
                    resolve(user);
                })
                .catch((error) => {
                    reject(error);
                });
        });
    }

    async syncViewerRoles(userId: string, roles: string[], rolesToDeleteIfNotPresent: string[] = []): Promise<void> {
        if (this.isViewerDBOn() !== true) {
            // TODO: Redirect this call to "real" user DB
            throw new Error("This is unavailable because 'allow dangerous operations' is enabled.");
        }
        if (!this._db) {
            return;
        }

        const rolesToDelete = rolesToDeleteIfNotPresent.filter(role => !roles.includes(role));
        logger.debug(`Syncing viewer roles for user ${userId}. Adding roles: ${roles}, Removing roles: ${rolesToDelete}`);

        try {
            await this._db.updateAsync({ _id: unkickifyUserId(userId) }, { $addToSet: { twitchRoles: { $each: roles } }, $pull: { twitchRoles: { $in: rolesToDelete } } });
        } catch (error) {
            logger.error(`Error adding viewer roles for user ${userId}: ${String(error)}`);
        }
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
                logger.debug(`Incremented DB field '${fieldName}' for user ${userId}. New value: ${(affectedDocuments as any)[fieldName]}`);
            } else {
                logger.warn(`Failed to increment DB field '${fieldName}' for user ${userId}. No documents were affected.`);
            }
        } catch (error) {
            logger.error(`Error incrementing DB field '${fieldName}' for user ${userId}: ${String(error)}`);
            return;
        }
    }
}

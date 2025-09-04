import { FirebotViewer } from "@crowbartools/firebot-custom-scripts-types/types/modules/viewer-database";
import Datastore from "@seald-io/nedb";
import { logger } from "../main";
import { BasicKickUser, KickGifter, KickSubscription, KickUser } from "../shared/types";
import { getDataFilePath } from "../util/datafile";
import { IKick } from "./kick-interface";
import { kickifyUserId, kickifyUsername, unkickifyUserId, unkickifyUsername, userIdToCleanString } from "./util";
import { parseBasicKickUser } from "./webhook-handler/webhook-parsers";

export class KickUserManager {
    private kick: IKick;
    protected _db: Datastore | null = null;
    private _dbCompactionInterval = 30000;
    private _dbPath = "";
    protected _giftDb: Datastore | null = null;
    private _giftDbCompactionInterval = 30000;
    private _giftDbPath = "";
    protected _subDb: Datastore | null = null;
    private _subDbCompactionInterval = 30000;
    private _subDbPath = "";

    constructor(kick: IKick) {
        this.kick = kick;
    }

    async connectViewerDatabase(): Promise<void> {
        this._dbPath = getDataFilePath("kick-users.db");
        this._db = await this.connectDatabase(this._dbPath, this._dbCompactionInterval);

        this._giftDbPath = getDataFilePath("kick-gift-users.db");
        this._giftDb = await this.connectDatabase(this._giftDbPath, this._giftDbCompactionInterval);

        this._subDbPath = getDataFilePath("kick-sub-users.db");
        this._subDb = await this.connectDatabase(this._subDbPath, this._subDbCompactionInterval);

        await this.purgeExpiredSubscribers();
        await this.purgeExpiredGiftSubs();
    }

    private async connectDatabase(dbPath: string, dbCompactionInterval: number): Promise<Datastore> {
        try {
            const db = new Datastore({ filename: dbPath });
            await db.loadDatabaseAsync();
            db.setAutocompactionInterval(dbCompactionInterval);
            logger.info(`connectDatabase: Database Loaded: ${dbPath}`);
            return db;
        } catch (error) {
            if (error && typeof error === "object" && "message" in error) {
                logger.error(`connectDatabase: Error Loading Database at ${dbPath}: ${(error as { message: string }).message}`);
            } else {
                logger.error(`connectDatabase: Error Loading Database at ${dbPath}: ${String(error)}`);
            }
            throw error;
        }
    }

    disconnectViewerDatabase(): void {
        this._db = null;
        this._giftDb = null;
        this._subDb = null;
    }

    async getOrCreateViewer(kickUser: KickUser, roles: string[] = [], isOnline = false): Promise<FirebotViewer | undefined> {
        if (!this._db) {
            throw new Error("Viewer database is not connected.");
        }

        if (unkickifyUserId(kickUser.userId.toString()) === '') {
            logger.warn(`getOrCreateViewer: Invalid userId for kickUser: ${JSON.stringify(kickUser)}`);
            return undefined;
        }

        const existingViewer = await this.getViewerById(kickUser.userId);
        if (existingViewer) {
            return existingViewer;
        }

        logger.debug(`getOrCreateViewer: Creating new viewer for kickUser: ${JSON.stringify(kickUser)}`);
        return await this.createNewViewer(kickUser, roles, isOnline);
    }

    private async createNewViewer(kickUser: KickUser, roles: string[] = [], isOnline = false): Promise<FirebotViewer | undefined> {
        if (!this._db) {
            throw new Error("Viewer database is not connected.");
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
            return undefined;
        }

        firebotViewer._id = kickifyUserId(firebotViewer._id);
        firebotViewer.username = kickifyUsername(firebotViewer.username);
        return firebotViewer;
    }

    async getViewerById(id: string): Promise<FirebotViewer | undefined> {
        if (!this._db) {
            throw new Error("Viewer database is not connected.");
        }

        if (unkickifyUserId(id) === '') {
            logger.warn(`getViewerById: Invalid userId!`);
            return undefined;
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
        if (!this._db) {
            throw new Error("Viewer database is not connected.");
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
        const formVariables = new URLSearchParams();
        const unkickifiedUserId = userIdToCleanString(userId);
        if (unkickifiedUserId !== "") {
            formVariables.append("id", unkickifiedUserId);
        }

        const uri = `/public/v1/users${formVariables.toString().length > 0 ? `?${formVariables.toString()}` : ''}`;
        const response = await this.kick.httpCallWithTimeout(uri, "GET");

        if (!response || !response.data || response.data.length !== 1) {
            logger.debug(`Failed to retrieve user from Kick API response. ${JSON.stringify(response)}`);
            throw new Error("Failed to retrieve user from Kick API.");
        }

        const user = parseBasicKickUser(response.data[0]);
        if (!user.userId) {
            logger.debug("No user ID found in Kick API response.");
            throw new Error("No user ID found in Kick API response.");
        }

        logger.debug(`Successfully retrieved user: ${user.userId} (${user.name})`);
        return user;
    }

    async syncViewerRoles(userId: string, roles: string[], rolesToDeleteIfNotPresent: string[] = []): Promise<void> {
        if (!this._db) {
            throw new Error("Viewer database is not connected.");
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
        if (!this._db) {
            throw new Error("Viewer database is not connected.");
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

    async getGifter(gifterId: string): Promise<KickGifter> {
        if (!this._giftDb) {
            throw new Error("Gifter database is not connected.");
        }

        const gifter = await this._giftDb.findOneAsync<KickGifterDBRecord>({ _id: unkickifyUserId(gifterId) });
        const now = new Date();
        if (!gifter) {
            return {
                userId: gifterId,
                gifts: [],
                totalSubs: 0
            };
        }
        const filteredGifts = gifter.gifts
            .filter(giftDb => new Date(giftDb.sub.expiresAt) > now)
            .map(giftDb => ({
                userId: giftDb._id,
                sub: giftDb.sub
            }));
        return {
            userId: gifter._id,
            gifts: filteredGifts,
            totalSubs: gifter.totalSubs
        };
    }

    async recordGift(gifterId: string, gifteeId: string, createdAt: Date, expiresAt: Date): Promise<void> {
        if (!this._giftDb) {
            throw new Error("Gifter database is not connected.");
        }

        const giftSub: KickGiftSubDBRecord = {
            _id: gifteeId,
            sub: { createdAt, expiresAt }
        };

        const currentGifter = await this._giftDb.findOneAsync<KickGifterDBRecord>({ _id: unkickifyUserId(gifterId) });
        if (currentGifter) {
            currentGifter.gifts.push(giftSub);
            await this._giftDb.updateAsync(
                { _id: unkickifyUserId(gifterId) },
                {
                    $set: { gifts: currentGifter.gifts },
                    $inc: { totalSubs: 1 }
                }
            );
        } else {
            await this._giftDb.insertAsync({ _id: unkickifyUserId(gifterId), gifts: [giftSub], totalSubs: 1 });
        }
    }

    async getSubscriber(userId: string): Promise<KickSubscription | null> {
        if (!this._subDb) {
            throw new Error("Subscriber database is not connected.");
        }

        const rec = await this._subDb.findOneAsync<KickSubscription>({ _id: unkickifyUserId(userId) });
        if (!rec) {
            return null;
        }
        const now = new Date();
        if (rec.expiresAt && new Date(rec.expiresAt) <= now) {
            return null;
        }
        return rec;
    }

    async recordSubscription(userId: string, createdAt: Date, expiresAt: Date): Promise<void> {
        if (!this._subDb) {
            throw new Error("Subscriber database is not connected.");
        }

        const currentSubscriber = await this._subDb.findOneAsync<KickSubscription>({ _id: unkickifyUserId(userId) });
        if (currentSubscriber) {
            if (expiresAt && currentSubscriber.expiresAt >= expiresAt) {
                logger.debug(`Not updating existing subscriber record for user ${userId}: Expiration date longer than requested.`);
                return;
            }

            logger.debug(`Updating existing subscriber record for user ${userId} to expiration date ${expiresAt}.`);
            currentSubscriber.expiresAt = expiresAt;
            await this._subDb.updateAsync({ _id: unkickifyUserId(userId) }, { $set: { expiresAt } });
            return;
        }

        const newSubscriber: KickSubscription = {
            createdAt,
            expiresAt
        };

        await this._subDb.insertAsync({ _id: unkickifyUserId(userId), ...newSubscriber });
    }


    private async purgeExpiredSubscribers(): Promise<void> {
        if (!this._subDb) {
            throw new Error("Subscriber database is not connected.");
        }
        const now = new Date();
        await this._subDb.removeAsync({ expiresAt: { $lte: now } }, { multi: true });
    }

    private async purgeExpiredGiftSubs(): Promise<void> {
        if (!this._giftDb) {
            throw new Error("Gift database is not connected.");
        }
        const now = new Date();
        const gifters = await this._giftDb.findAsync<KickGifterDBRecord>({});
        for (const gifter of gifters) {
            if (Array.isArray(gifter.gifts)) {
                const filteredGifts = gifter.gifts.filter((gift: any) => new Date(gift.sub.expiresAt) > now);
                if (filteredGifts.length !== gifter.gifts.length) {
                    await this._giftDb.updateAsync({ _id: gifter._id }, { $set: { gifts: filteredGifts } });
                }
                // If gifts is empty and totalSubs is 0, delete the record
                if (filteredGifts.length === 0 && gifter.totalSubs === 0) {
                    await this._giftDb.removeAsync({ _id: gifter._id }, {});
                }
            }
        }
    }
}

interface KickGifterDBRecord {
    _id: string,
    gifts: KickGiftSubDBRecord[], // All current gift subs
    totalSubs: number, // Total gift subs given
}

interface KickGiftSubDBRecord {
    _id: string,
    sub: KickSubscription
}

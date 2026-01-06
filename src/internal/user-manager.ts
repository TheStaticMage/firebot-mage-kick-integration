import Datastore from "@seald-io/nedb";
import {
    getOrCreateUser,
    getUserById,
    getUserByUsername,
    incrementChatMessages,
    PlatformUser,
    setUserRoles,
    updateLastSeen
} from "@thestaticmage/mage-platform-lib-client";
import { logger } from "../main";
import { BasicKickUser, KickGifter, KickSubscription, KickUser } from "../shared/types";
import { getDataFilePath } from "../util/datafile";
import { IKick } from "./kick-interface";
import { kickifyUserId, kickifyUsername, unkickifyUserId, userIdToCleanString } from "./util";
import { parseBasicKickUser } from "./webhook-handler/webhook-parsers";

export class KickUserManager {
    private kick: IKick;
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
        this._giftDb = null;
        this._subDb = null;
    }

    async getOrCreateViewer(kickUser: KickUser, roles: string[] = [], isOnline = false): Promise<PlatformUser | undefined> {
        if (unkickifyUserId(kickUser.userId.toString()) === '') {
            logger.warn(`getOrCreateViewer: Invalid userId for kickUser: ${JSON.stringify(kickUser)}`);
            return undefined;
        }

        const response = await getOrCreateUser({
            platform: "kick",
            userId: kickifyUserId(kickUser.userId.toString()),
            username: kickifyUsername(kickUser.username),
            displayName: kickUser.displayName,
            profilePicUrl: kickUser.profilePicture
        });

        if (!response.success || !response.user) {
            logger.error(`getOrCreateViewer: Failed to get or create user: ${response.error || "Unknown error"}`);
            return undefined;
        }

        if (roles.length > 0) {
            await this.setViewerRoles(response.user._id, roles);
        }

        if (isOnline) {
            await this.updateLastSeen(response.user._id);
        }

        return response.user;
    }

    async getViewerById(id?: string): Promise<PlatformUser | null> {
        if (!id || unkickifyUserId(id) === '') {
            logger.warn(`getViewerById: Invalid userId!`);
            return null;
        }

        const response = await getUserById({
            platform: "kick",
            userId: kickifyUserId(id)
        });

        if (!response.success || !response.user) {
            logger.error(`getViewerById: Failed to retrieve user: ${response.error || "Unknown error"}`);
            return null;
        }

        return response.user;
    }

    async getViewerByUsername(username?: string): Promise<PlatformUser | undefined> {
        const normalizedUsername = kickifyUsername(username);
        if (!normalizedUsername) {
            logger.warn(`getViewerByUsername: Invalid username.`);
            return undefined;
        }

        const response = await getUserByUsername({
            platform: "kick",
            username: normalizedUsername
        });

        if (!response.success || !response.user) {
            logger.error(`getViewerByUsername: Failed to retrieve user: ${response.error || "Unknown error"}`);
            return undefined;
        }

        return response.user;
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

    async setViewerRoles(userId: string, roles: string[]): Promise<void> {
        const response = await setUserRoles({
            platform: "kick",
            userId: kickifyUserId(userId),
            roles
        });

        if (!response.success) {
            logger.error(`Error setting viewer roles for user ${userId}: ${response.error || "Unknown error"}`);
        }
    }

    async incrementChatMessages(userId: string): Promise<void> {
        if (unkickifyUserId(userId) === '') {
            logger.warn(`incrementChatMessages: Invalid userId.`);
            return;
        }

        const response = await incrementChatMessages({
            platform: "kick",
            userId: kickifyUserId(userId),
            amount: 1
        });

        if (!response.success) {
            logger.error(`incrementChatMessages: Failed to increment chatMessages for user ${userId}: ${response.error || "Unknown error"}`);
        }
    }

    async updateLastSeen(userId: string): Promise<void> {
        if (unkickifyUserId(userId) === '') {
            logger.warn(`updateLastSeen: Invalid userId.`);
            return;
        }

        const response = await updateLastSeen({
            platform: "kick",
            userId: kickifyUserId(userId)
        });

        if (!response.success) {
            logger.error(`updateLastSeen: Failed to update lastSeen for user ${userId}: ${response.error || "Unknown error"}`);
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

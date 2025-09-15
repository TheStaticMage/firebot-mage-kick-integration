import { FirebotViewer } from '@crowbartools/firebot-custom-scripts-types/types/modules/viewer-database';
import NodeCache from 'node-cache';
import { firebot, logger } from "../main";
import { IKick } from './kick-interface';
import { kickifyUserId, kickifyUsername, unkickifyUserId, unkickifyUsername } from "./util";

export class RoleManager {
    private _kick: IKick;
    private _twitchUserCache: NodeCache = new NodeCache({ stdTTL: 30 }); // For per-user role checks
    private _twitchGlobalCache: NodeCache = new NodeCache({ stdTTL: 30 }); // For global lists like VIPs and moderators

    constructor(kick: IKick) {
        this._kick = kick;
    }

    // Twitch roles can be queried via the API. We keep a local cache to avoid
    // hammering the API too much, but a relatively short TTL so that the data
    // is reasonably fresh.
    async twitchUserHasRole(userNameOrId: string | number, roleId: string): Promise<boolean> {
        const { id, name } = this.parseTwitchUserNameOrId(userNameOrId);
        if (!id && !name) {
            return false;
        }

        if (roleId === "broadcaster") {
            if (!firebot.firebot.accounts.streamer.userId || !firebot.firebot.accounts.streamer.username) {
                logger.error(`twitchUserHasRole: Broadcaster information not available.`);
                return false;
            }

            const isBroadcaster = (firebot.firebot.accounts.streamer.userId === id || firebot.firebot.accounts.streamer.username.toLowerCase() === name?.toLowerCase());
            logger.debug(`twitchUserHasRole: Checking 'broadcaster' for user ${userNameOrId} (${id}/${name}), result=${isBroadcaster}`);
            return isBroadcaster;
        }

        if (roleId === "bot") {
            if (!firebot.firebot.accounts.bot.userId || !firebot.firebot.accounts.bot.username) {
                logger.error(`twitchUserHasRole: Bot information not available.`);
                return false;
            }

            const isBot = (firebot.firebot.accounts.bot.userId === id || firebot.firebot.accounts.bot.username.toLowerCase() === name?.toLowerCase());
            logger.debug(`twitchUserHasRole: Checking 'bot' for user ${userNameOrId} (${id}/${name}), result=${isBot}`);
            return isBot;
        }

        if (roleId.length !== 36) {
            const result = await this.twitchUserHasTwitchRole(id, name, roleId);
            logger.debug(`twitchUserHasRole: Checking Twitch role ${roleId} for user ${userNameOrId} (${id}/${name}), result=${result}`);
            return result;
        }

        if (id) {
            return this.userHasCustomRole(id, roleId);
        }

        try {
            const { twitchApi } = firebot.modules;
            if (!name) {
                logger.error(`twitchUserHasRole: Username is undefined, cannot fetch user by name.`);
                return false;
            }
            const user = await twitchApi.users.getUserByName(name);
            return this.userHasCustomRole(user.id, roleId);
        } catch (error) {
            logger.error(`twitchUserHasRole: Error fetching user ID for ${name}: ${error}`);
            return false;
        }
    }

    // Kick roles cannot be queried via the API, so we are dependent on
    // observing the most recent badges that were sent with the chat message. We
    // can also check our subscriber database to guess whether a user is a
    // subscriber or not.
    async kickUserHasRole(userNameOrId: string | number, roleId: string): Promise<boolean> {
        let { id, name } = this.parseKickUserNameOrId(userNameOrId);
        if (!id && !name) {
            return false;
        }

        let viewer: FirebotViewer | undefined = undefined;
        if (id) {
            logger.debug(`kickUserHasRole: Looking up Kick viewer by user ID: ${id}`);
            viewer = await this._kick.userManager.getViewerById(id);
        } else if (name) {
            logger.debug(`kickUserHasRole: Looking up Kick viewer by username: ${name}`);
            viewer = await this._kick.userManager.getViewerByUsername(name);
        }
        if (viewer) {
            id = kickifyUserId(viewer._id);
            name = kickifyUsername(viewer.username);
        }

        if (roleId.length === 36) {
            if (!id) {
                logger.error(`kickUserHasRole: Cannot look up custom role ${roleId} without user ID for user ${userNameOrId}`);
                return false;
            }
            return this.userHasCustomRole(id, roleId);
        }

        if (roleId === "broadcaster") {
            if (!this._kick.broadcaster) {
                logger.error(`kickUserHasRole: Broadcaster information not available.`);
                return false;
            }

            const isBroadcaster = (unkickifyUserId(id) === unkickifyUserId(this._kick.broadcaster.userId) || unkickifyUsername(name).toLowerCase() === unkickifyUsername(this._kick.broadcaster.name).toLowerCase());
            logger.debug(`kickUserHasRole: Checking 'broadcaster' for user ${userNameOrId} (${id}/${name}), result=${isBroadcaster}`);
            return isBroadcaster;
        }

        if (roleId === "bot") {
            if (!this._kick.bot) {
                logger.error(`kickUserHasRole: Bot information not available.`);
                return false;
            }

            const isBot = (unkickifyUserId(id) === unkickifyUserId(this._kick.bot.userId) || unkickifyUsername(name).toLowerCase() === unkickifyUsername(this._kick.bot.name).toLowerCase());
            logger.debug(`kickUserHasRole: Checking 'bot' for user ${userNameOrId} (${id}/${name}), result=${isBot}`);
            return isBot;
        }

        if (!viewer) {
            logger.warn(`kickUserHasRole: No Kick viewer found for: ${userNameOrId}`);
            return false;
        }

        const result = viewer.twitchRoles.includes(String(roleId));
        logger.debug(`kickUserHasRole: Checking Kick role ${roleId} for user ${userNameOrId} (${id}/${name}), result=${result} (roles: ${viewer.twitchRoles.join(", ")})`);
        return result;
    }

    async userHasRole(platform: string, userNameOrId: string | number, roleId: string): Promise<boolean> {
        if (platform !== "twitch" && platform !== "kick") {
            if (typeof userNameOrId === "string" && isNaN(Number(unkickifyUserId(userNameOrId))) && unkickifyUsername(userNameOrId) !== userNameOrId) {
                platform = "kick";
            } else if (typeof userNameOrId === "string" && !isNaN(Number(unkickifyUserId(userNameOrId))) && unkickifyUserId(userNameOrId) !== userNameOrId) {
                platform = "kick";
            } else {
                platform = "twitch";
            }
        }

        if (platform === "kick") {
            return this.kickUserHasRole(userNameOrId, roleId);
        }
        return this.twitchUserHasRole(userNameOrId, roleId);
    }

    private userHasCustomRole(userId: string, roleId: string): boolean {
        try {
            const { customRolesManager } = firebot.modules;
            const hasRole = customRolesManager.userIsInRole(userId, [], [roleId]);
            logger.debug(`userHasCustomRole: Checking custom role ${roleId} for user ${userId} (result=${hasRole})`);
            return hasRole;
        } catch (error) {
            logger.error(`userHasCustomRole: Error checking custom role ${roleId} for user ${userId}: ${error}`);
            return false;
        }
    }

    private async twitchUserHasTwitchRole(id: string | undefined, name: string | undefined, roleId: string): Promise<boolean> {
        switch (roleId) {
            case "broadcaster": {
                return (firebot.firebot.accounts.streamer.userId === id || firebot.firebot.accounts.streamer.username.toLowerCase() === name?.toLowerCase());
            }
            case "bot": {
                return (firebot.firebot.accounts.bot.userId === id || firebot.firebot.accounts.bot.username.toLowerCase() === name?.toLowerCase());
            }
            case "sub": {
                return this.isTwitchSub(id, name);
            }
            case "vip": {
                return this.isTwitchVip(id, name);
            }
            case "mod": {
                return this.isTwitchModerator(id, name);
            }
            default: {
                logger.warn(`twitchUserHasTwitchRole: Unknown Twitch roleId provided: ${roleId}`);
                return false;
            }
        }
    }

    private async isTwitchSub(id: string | undefined, name: string | undefined): Promise<boolean> {
        let cacheKey: string;
        if (id) {
            cacheKey = `twitchsub:id:${id}`;
        } else if (name) {
            cacheKey = `twitchsub:name:${name.toLowerCase()}`;
        } else {
            logger.warn(`isTwitchSub: No valid id or name provided to check for sub status`);
            return false;
        }

        if (this._twitchUserCache.has(cacheKey)) {
            return this._twitchUserCache.get(cacheKey) ?? false;
        }

        const { twitchApi } = firebot.modules;
        if (name && !id) {
            try {
                const startTime = performance.now();
                const user = await twitchApi.users.getUserByName(name);
                id = user.id;
                logger.debug(`isTwitchSub: Fetched user ID for ${name} in ${(performance.now() - startTime).toFixed(2)} ms`);
            } catch (error) {
                logger.error(`isTwitchSub: Error fetching user ID for ${name}: ${error}`);
                return false;
            }
        }

        if (!id) {
            logger.warn(`isTwitchSub: No user ID available to check for sub status`);
            return false;
        }

        const streamerId = firebot.firebot.accounts.streamer.userId;
        try {
            const startTime = performance.now();
            const subInfo = await twitchApi.getClient().subscriptions.getSubscriptionForUser(streamerId, id);
            const isSub = subInfo !== null;
            this._twitchUserCache.set(cacheKey, isSub);
            logger.debug(`isTwitchSub: Checked subscription status for user ${id} in ${(performance.now() - startTime).toFixed(2)} ms`);
            return isSub;
        } catch (error) {
            logger.error(`isTwitchSub: Error checking subscription status for user ${id}: ${error}`);
            return false;
        }
    }

    private async isTwitchVip(id: string | undefined, name: string | undefined): Promise<boolean> {
        if (typeof id === "string" && id.trim().length > 0) {
            await this.loadTwitchVips();
            const vips = this._twitchGlobalCache.get('vips');
            return Array.isArray(vips) ? vips.includes(`id:${id}`) : false;
        }

        if (typeof name === "string" && name.trim().length > 0) {
            await this.loadTwitchVips();
            const vips = this._twitchGlobalCache.get('vips');
            return Array.isArray(vips) ? vips.includes(`name:${name.toLowerCase()}`) : false;
        }

        logger.warn(`isTwitchVip: No valid id or name provided to check for VIP status`);
        return false;
    }

    private async isTwitchModerator(id: string | undefined, name: string | undefined): Promise<boolean> {
        if (typeof id === "string" && id.trim().length > 0) {
            await this.loadTwitchModerators();
            const moderators = this._twitchGlobalCache.get('moderators');
            return Array.isArray(moderators) ? moderators.includes(`id:${id}`) : false;
        }

        if (typeof name === "string" && name.trim().length > 0) {
            await this.loadTwitchModerators();
            const moderators = this._twitchGlobalCache.get('moderators');
            return Array.isArray(moderators) ? moderators.includes(`name:${name.toLowerCase()}`) : false;
        }

        logger.warn(`isTwitchModerator: No valid id or name provided to check for moderator status`);
        return false;
    }

    private async loadTwitchModerators(): Promise<void> {
        if (!this._twitchGlobalCache.has('moderators')) {
            const startTime = performance.now();
            const { twitchApi } = firebot.modules;
            const moderators = await twitchApi.moderation.getModerators();
            this._twitchGlobalCache.set('moderators', [
                ...moderators.map(mod => `id:${mod.userId}`),
                ...moderators.map(mod => `name:${mod.userName.toLowerCase()}`)
            ]);
            logger.debug(`Loaded ${moderators.length} moderators from Twitch API. Took ${(performance.now() - startTime).toFixed(2)} ms.`);
        }
    }

    private async loadTwitchVips(): Promise<void> {
        if (!this._twitchGlobalCache.has('vips')) {
            const startTime = performance.now();
            const { twitchApi } = firebot.modules;
            const vips = await twitchApi.channels.getVips();
            this._twitchGlobalCache.set('vips', [
                ...vips.map(vip => `id:${vip.id}`),
                ...vips.map(vip => `name:${vip.name.toLowerCase()}`)
            ]);
            logger.debug(`Loaded ${vips.length} VIPs from Twitch API. Took ${(performance.now() - startTime).toFixed(2)} ms.`);
        }
    }

    private parseTwitchUserNameOrId(userNameOrId: string | number): { id: string | undefined, name: string | undefined } {
        let id: string | undefined;
        let name: string | undefined;

        if (typeof userNameOrId === "string" && isNaN(Number(userNameOrId))) {
            name = userNameOrId;
            id = undefined;
        } else if (typeof userNameOrId === "string" && !isNaN(Number(userNameOrId))) {
            id = userNameOrId;
            name = undefined;
        } else if (typeof userNameOrId === "number") {
            id = String(userNameOrId);
            name = undefined;
        } else {
            logger.warn(`parseTwitchUserNameOrId: Invalid userNameOrId provided: ${userNameOrId}`);
        }

        return { id, name };
    }

    private parseKickUserNameOrId(userNameOrId: string | number): { id: string | undefined, name: string | undefined } {
        let id: string | undefined;
        let name: string | undefined;

        if (typeof userNameOrId === "string" && isNaN(Number(unkickifyUserId(userNameOrId)))) {
            name = kickifyUsername(userNameOrId);
            id = undefined;
        } else if (typeof userNameOrId === "string" && !isNaN(Number(unkickifyUserId(userNameOrId)))) {
            id = kickifyUserId(userNameOrId);
            name = undefined;
        } else if (typeof userNameOrId === "number") {
            id = kickifyUserId(String(userNameOrId));
            name = undefined;
        } else {
            logger.warn(`parseKickUserNameOrId: Invalid userNameOrId provided: ${userNameOrId}`);
        }

        return { id, name };
    }
}

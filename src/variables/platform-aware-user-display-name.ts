import { Effects } from "@crowbartools/firebot-custom-scripts-types/types/effects";
import { ReplaceVariable } from '@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager';
import { unkickifyUsername } from "../internal/util";
import { integration } from "../integration";
import { firebot, logger } from "../main";
import { platformVariable } from "./platform";
import { TwitchApi } from "@crowbartools/firebot-custom-scripts-types/types/modules/twitch-api";
import { ViewerDatabase } from "@crowbartools/firebot-custom-scripts-types/types/modules/viewer-database";
import { KickUserManager } from "../internal/user-manager";

export class PlatformAwareUserDisplayNameVariable {
    replaceVariable: ReplaceVariable = {
        definition: {
            handle: "platformAwareUserDisplayName",
            description: "Outputs the formatted display name from the associated event/command/redeem. Works for both Twitch and Kick. Use this instead of $userDisplayName.",
            examples: [
                {
                    usage: "platformAwareUserDisplayName",
                    description: "The formatted name of the user who triggered the event/command/redeem."
                },
                {
                    usage: "platformAwareUserDisplayName[username]",
                    description: "The formatted display name for the provided username."
                }
            ],
            categories: ["common"],
            possibleDataOutput: ["text"]
        },
        evaluator: async (trigger: Effects.Trigger, username: string | null = null) => {
            return await this.evaluate(trigger, username);
        }
    };

    private _kickUserManager: KickUserManager | null;
    private _twitchApi: TwitchApi | null;
    private _viewerDatabase: ViewerDatabase | null;

    constructor(injectTwitchApi: TwitchApi | null = null, injectViewerDatabase: ViewerDatabase | null = null, injectKickUserManager: KickUserManager | null = null) {
        this._twitchApi = injectTwitchApi;
        this._viewerDatabase = injectViewerDatabase;
        this._kickUserManager = injectKickUserManager;
    }

    async evaluate(trigger: Effects.Trigger, username: string | null = null): Promise<string> {
        // This uses the Twitch logic unless the event is demonstrably from
        // Kick, for maximum compatibility.
        const platform = this.getPlatform(trigger);
        if (platform === "kick" || (username && unkickifyUsername(username) !== username)) {
            return this.evaluateForKick(trigger, username);
        }
        return this.evaluateForTwitch(trigger, username);
    }

    private fallbackUserDisplayName(trigger: Effects.Trigger): string | null {
        if (typeof trigger.metadata?.eventData?.userDisplayName === 'string' && trigger.metadata?.eventData?.userDisplayName.trim() !== "") {
            return trigger.metadata.eventData.userDisplayName;
        }

        if (typeof trigger.metadata?.chatMessage?.displayName === 'string' && trigger.metadata?.chatMessage?.displayName.trim() !== "") {
            return trigger.metadata.chatMessage.displayName;
        }

        if (typeof trigger.metadata?.userDisplayName === 'string' && trigger.metadata?.userDisplayName.trim() !== "") {
            return trigger.metadata.userDisplayName;
        }

        return null;
    }

    private fallbackUsername(trigger: Effects.Trigger): string | null {
        if (typeof trigger.metadata?.eventData?.username === 'string' && trigger.metadata?.eventData?.username.trim() !== "") {
            return trigger.metadata.eventData.username;
        }

        if (typeof trigger.metadata?.chatMessage?.username === 'string' && trigger.metadata?.chatMessage?.username.trim() !== "") {
            return trigger.metadata.chatMessage.username;
        }

        if (typeof trigger.metadata?.username === 'string' && trigger.metadata?.username.trim() !== "") {
            return trigger.metadata.username;
        }

        return null;
    }

    private async evaluateForKick(trigger: Effects.Trigger, username: string | null): Promise<string> {
        if (username == null) {
            const realUsername = this.fallbackUsername(trigger);
            if (!realUsername) {
                return "[No username available]";
            }
            username = realUsername;
        }

        const viewer = await this.getKickUserManager().getViewerByUsername(username);
        if (viewer != null && viewer.displayName) {
            return viewer.displayName;
        }

        const fallback = this.fallbackUserDisplayName(trigger);
        if (fallback) {
            return fallback;
        }

        return unkickifyUsername(username); // Fallback to the username if no display name is found
    }

    private async evaluateForTwitch(trigger: Effects.Trigger, username: string | null): Promise<string> {
        // Re-implements the logic from Firebot's `userDisplayName` variable
        // implementation. I don't particularly like parts of this
        // implementation, like not referencing the display name metadata if the
        // username does not resolve, but we are keeping things consistent for
        // now.
        if (username == null) {
            const fallback = this.fallbackUserDisplayName(trigger);
            if (fallback) {
                return fallback;
            }

            const realUsername = this.fallbackUsername(trigger);
            if (!realUsername) {
                return "[No username available]";
            }
            username = realUsername;
        }

        const viewer = await this.getViewerDatabase().getViewerByUsername(username);
        if (viewer != null) {
            return viewer.displayName;
        }

        try {
            const user = await this.getTwitchApi().users.getUserByName(username);
            if (user != null) {
                return user.displayName;
            }
            return "[No user found]";
        } catch (error) {
            logger.debug(`Unable to find user with name "${username}"`, error);
            return "[Error]";
        }
    }

    private getPlatform(trigger: Effects.Trigger): string {
        return platformVariable.evaluator(trigger);
    }

    private getKickUserManager(): KickUserManager {
        if (this._kickUserManager) {
            return this._kickUserManager;
        }
        return integration.kick.userManager;
    }

    private getTwitchApi(): TwitchApi {
        if (this._twitchApi) {
            return this._twitchApi;
        }

        const { twitchApi } = firebot.modules;
        return twitchApi;
    }

    private getViewerDatabase(): ViewerDatabase {
        if (this._viewerDatabase) {
            return this._viewerDatabase;
        }

        const { viewerDatabase } = firebot.modules;
        return viewerDatabase;
    }
}

export const platformAwareUserDisplayNameVariable = new PlatformAwareUserDisplayNameVariable();

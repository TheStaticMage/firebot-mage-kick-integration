import { Effects } from "@crowbartools/firebot-custom-scripts-types/types/effects";
import { ReplaceVariable } from '@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager';
import { KickUsers } from "../internal/user";

export const kickUserDisplayNameVariable: ReplaceVariable = {
    definition: {
        handle: "kickUserDisplayName",
        description: "Outputs the user display name from the associated command or event, or the specified Kick user as applicable.",
        examples: [
            {
                usage: "kickUserDisplayName[username]",
                description: "The formatted display name for the given username."
            }
        ],
        categories: ["common"],
        possibleDataOutput: ["text"]
    },
    evaluator: (trigger: Effects.Trigger, username: string | null = null) => {
        if (username == null || username.trim() === "") {
            const userDisplayName = trigger.metadata?.eventData?.userDisplayName ?? trigger.metadata?.userDisplayName;
            if (userDisplayName != null) {
                return userDisplayName;
            }
            const eventUsername = trigger.metadata?.eventData?.username;
            const metadataUsername = trigger.metadata?.username;
            username = typeof eventUsername === "string" ? eventUsername
                : typeof metadataUsername === "string" ? metadataUsername : null;
            if (username == null) {
                return "[No username available]";
            }
        }

        return KickUsers.unkickifyUsername(username);
    }
};

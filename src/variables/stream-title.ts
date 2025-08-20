import { ReplaceVariable } from '@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager';
import { integration } from '../integration';
import { logger } from '../main';

export const kickStreamTitleVariable : ReplaceVariable = {
    definition: {
        handle: "kickStreamTitle",
        usage: "kickStreamTitle",
        description: "Gets the current stream title for your channel or another channel on Kick.",
        examples: [
            {
                usage: "kickStreamTitle[$target]",
                description: "When in a command, gets the stream title for the target channel."
            },
            {
                usage: "kickStreamTitle[$user]",
                description: "Gets the stream title for associated user (Ie who triggered command, pressed button, etc)."
            },
            {
                usage: "kickStreamTitle[ebiggz]",
                description: "Gets the stream title for a specific channel."
            }
        ],
        categories: ["common"],
        possibleDataOutput: ["text"]
    },
    evaluator: async (trigger, username) => {
        try {
            const channel = await integration.kick.channelManager.getChannel(username);
            if (!channel) {
                logger.debug(`No channel found for username: ${username}`);
                return "[No channel found]";
            }

            return channel.streamTitle || "";
        } catch (error) {
            logger.error(`Error retrieving stream title for username ${username}: ${error}`);
            return "[No channel found]";
        }
    }
};

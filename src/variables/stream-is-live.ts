import { ReplaceVariable } from '@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager';
import { integration } from '../integration';
import { logger } from '../main';

export const kickStreamIsLiveVariable: ReplaceVariable = {
    definition: {
        handle: "kickStreamIsLive",
        usage: "kickStreamIsLive",
        description: "Checks if the current stream is live for your channel or another channel on Kick.",
        examples: [
            {
                usage: "kickStreamIsLive[$target]",
                description: "When in a command, checks if the stream is live for the target channel."
            },
            {
                usage: "kickStreamIsLive[$user]",
                description: "Checks if the stream is live for associated user (Ie who triggered command, pressed button, etc)."
            },
            {
                usage: "kickStreamIsLive[ebiggz]",
                description: "Checks if the stream is live for a specific channel."
            }
        ],
        categories: ["common"],
        possibleDataOutput: ["bool"]
    },
    evaluator: async (trigger, username) => {
        try {
            const channel = await integration.kick.channelManager.getChannel(username);
            if (!channel) {
                logger.debug(`No channel found for username: ${username}`);
                return false;
            }

            return channel.stream.isLive || false;
        } catch (error) {
            logger.error(`Error retrieving stream status for username ${username}: ${error}`);
            return false;
        }
    }
};

import { ReplaceVariable } from '@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager';
import { integration } from '../integration';
import { logger } from '../main';

export const kickChannelIdVariable: ReplaceVariable = {
    definition: {
        handle: "kickChannelId",
        description: "Gets the channel ID of the selected channel on Kick (or your channel if no channel is specified).",
        examples: [
            {
                usage: "kickChannelId[$target]",
                description: "When in a command, gets the channel ID for the target user."
            },
            {
                usage: "kickChannelId[$user]",
                description: "Gets the channel ID for associated user (i.e. who triggered command, pressed button, etc)."
            },
            {
                usage: "kickChannelId[ChannelOne]",
                description: "Gets the channel ID for a specific channel."
            }
        ],
        categories: ["common"],
        possibleDataOutput: ["number"]
    },
    evaluator: async (trigger, username) => {
        try {
            const channel = await integration.kick.channelManager.getChannel(username);
            if (!channel) {
                logger.debug(`No channel found for username: ${username}`);
                return 0;
            }

            return channel.broadcasterUserId || 0;
        } catch (error) {
            logger.error(`Error retrieving channel ID for username ${username}: ${error}`);
            return 0;
        }
    }
};

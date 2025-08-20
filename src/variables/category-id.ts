import { ReplaceVariable } from '@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager';
import { integration } from '../integration';
import { logger } from '../main';

export const kickCategoryIdVariable: ReplaceVariable = {
    definition: {
        handle: "kickCategoryId",
        aliases: ["kickGameId"],
        description: "Gets the current category/game ID set for your channel or the selected channel on Kick",
        examples: [
            {
                usage: "kickCategoryId[$target]",
                description: "When in a command, gets the category/game ID set for the target user."
            },
            {
                usage: "kickCategoryId[$user]",
                description: "Gets the category/game ID set for associated user (i.e. who triggered command, pressed button, etc)."
            },
            {
                usage: "kickCategoryId[ChannelOne]",
                description: "Gets the category/game ID set for a specific channel."
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

            return channel.category.id || 0;
        } catch (error) {
            logger.error(`Error retrieving category for username ${username}: ${error}`);
            return 0;
        }
    }
};

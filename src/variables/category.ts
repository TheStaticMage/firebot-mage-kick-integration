import { ReplaceVariable } from '@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager';
import { integration } from '../integration';
import { IntegrationConstants } from '../constants';
import { logger } from '../main';

export const kickCategoryVariable: ReplaceVariable = {
    definition: {
        handle: "kickCategory",
        aliases: ["kickGame"],
        description: "Gets the current category/game for your channel or the selected channel on Kick",
        examples: [
            {
                usage: "kickCategory[$target]",
                description: "When in a command, gets the category/game set for the target user."
            },
            {
                usage: "kickCategory[$user]",
                description: "Gets the category/game set for associated user (i.e. who triggered command, pressed button, etc)."
            },
            {
                usage: "kickCategory[ChannelOne]",
                description: "Gets the category/game set for a specific channel."
            }
        ],
        categories: ["common"],
        possibleDataOutput: ["text"]
    },
    evaluator: async (trigger, username) => {
        try {
            const channel = await integration.kick.channelManager.getChannel(username);
            if (!channel) {
                logger.debug(`[${IntegrationConstants.INTEGRATION_ID}] No channel found for username: ${username}`);
                return "";
            }

            return channel.category.name || "";
        } catch (error) {
            logger.error(`[${IntegrationConstants.INTEGRATION_ID}] Error retrieving category for username ${username}: ${error}`);
            return "";
        }
    }
};

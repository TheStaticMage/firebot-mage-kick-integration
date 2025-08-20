import { ReplaceVariable } from '@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager';
import { integration } from '../integration';
import { logger } from '../main';

export const kickCategoryImageUrlVariable: ReplaceVariable = {
    definition: {
        handle: "kickCategoryImageUrl",
        usage: "kickCategoryImageUrl",
        description: "Gets the url for the image url for your channel or the selected channel on Kick",
        examples: [
            {
                usage: "kickCategoryImageUrl[$target]",
                description: "When in a command, gets the image url of the last streamed category for the target channel."
            },
            {
                usage: "kickCategoryImageUrl[$user]",
                description: "Gets the image url of the last streamed category for associated user (Ie who triggered command, pressed button, etc)."
            },
            {
                usage: "kickCategoryImageUrl[ebiggz]",
                description: "Gets the image url of the last streamed category for a specific channel."
            }
        ],
        categories: ["common"],
        possibleDataOutput: ["text"]
    },
    evaluator: async (_, username) => {
        try {
            const channel = await integration.kick.channelManager.getChannel(username);
            if (!channel) {
                logger.debug(`No channel found for username: ${username}`);
                return "[No Category Image Found]";
            }

            return channel.category.thumbnail || "[No Category Image Found]";
        } catch (error) {
            logger.error(`Error retrieving category image URL for username ${username}: ${error}`);
            return "[No Category Image Found]";
        }
    }
};

import { ReplaceVariable } from '@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager';
import { integration } from '../integration';
import { logger } from '../main';

export const kickCurrentViewerCountVariable: ReplaceVariable = {
    definition: {
        handle: "kickCurrentViewerCount",
        description: "Get the number of people viewing your channel or the selected channel on Kick",
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

            return channel.stream.viewerCount || 0;
        } catch (error) {
            logger.error(`Error retrieving viewer count for username ${username}: ${error}`);
            return 0;
        }
    }
};

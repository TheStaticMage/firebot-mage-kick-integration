import { ReplaceVariable } from '@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager';
import { integration } from '../integration';
import { logger } from '../main';

export const kickUptimeVariable : ReplaceVariable = {
    definition: {
        handle: "kickUptime",
        usage: "kickUptime",
        description: "Gets the current uptime for your channel or another channel on Kick. (Reported in seconds.)",
        examples: [
            {
                usage: "kickUptime[$target]",
                description: "When in a command, gets the uptime for the target channel."
            },
            {
                usage: "kickUptime[$user]",
                description: "Gets the uptime for associated user (Ie who triggered command, pressed button, etc)."
            },
            {
                usage: "kickUptime[ebiggz]",
                description: "Gets the uptime for a specific channel."
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

            if (!channel.stream.startTime) {
                logger.debug(`No start time found for channel: ${username}`);
                return 0;
            }

            const currentTime = new Date();
            const uptimeInSeconds = Math.floor((currentTime.getTime() - channel.stream.startTime.getTime()) / 1000);

            return uptimeInSeconds;
        } catch (error) {
            logger.error(`Error retrieving uptime for username ${username}: ${error}`);
            return 0;
        }
    }
};

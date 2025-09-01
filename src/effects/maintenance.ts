import { Firebot } from "@crowbartools/firebot-custom-scripts-types";
import { integration } from "../integration";
import { logger } from "../main";
import { IntegrationConstants } from "../constants";

export const maintenanceEffect: Firebot.EffectType<{
    action: 'Reset Webhook Subscriptions' | undefined;
}> = {
    definition: {
        id: `${IntegrationConstants.INTEGRATION_ID}:maintenance`,
        name: "Maintenance",
        description: "Perform maintenance tasks related to the Kick integration.",
        icon: "fad fa-tools",
        categories: ["common"],
        dependencies: []
    },
    optionsTemplate: `
        <eos-container header="Read Me First" pad-top="true">
            <p class="muted">This effect allows you to perform maintenance tasks on the Kick integration.</p>
            <p class="muted">You should ONLY trigger these tasks if you have a specific reason to do so according to the documentation, or advised to do so by someone with good knowledge of the integration.</p>
            <p class="muted">Please ensure you understand the implications of these actions before proceeding.</p>
        </eos-container>
        <eos-container header="Action" pad-top="true">
            <div class="btn-group">
                <button type="button" class="btn btn-default dropdown-toggle" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                    <span class="list-effect-type">{{effect.action ? effect.action : 'Pick one'}}</span> <span class="caret"></span>
                </button>
                <ul class="dropdown-menu">
                    <li ng-click="effect.action = 'Reset Webhook Subscriptions'">
                        <a href>Reset Webhook Subscriptions</a>
                    </li>
                </ul>
            </div>
        </eos-container>
    `,
    optionsController: () => {
        // None
    },
    optionsValidator: (effect) => {
        const errors = [];
        if (effect.action == null || effect.action === undefined) {
            errors.push("Please choose a maintenance action.");
        }
        return errors;
    },
    getDefaultLabel(effect) {
        switch (effect.action) {
            case "Reset Webhook Subscriptions":
                return "Reset Webhook Subscriptions";
            default:
                return "Unknown Maintenance Action";
        }
    },
    onTriggerEvent: async (event) => {
        const { effect } = event;

        if (effect.action === "Reset Webhook Subscriptions") {
            // Disconnect integration
            try {
                logger.info("Reset webhook subscriptions: Disconnecting Kick integration");
                await integration.disconnect();
                logger.info("Reset webhook subscriptions: Integration disconnected");
            } catch (error) {
                logger.error(`Reset webhook subscriptions: Failed to disconnect integration: ${error}`);
                integration.sendChatFeedErrorNotification(`Resetting webhook subscriptions has failed because the integration could not be disconnected. Please check the connection status.`);
                return {
                    success: false,
                    error: error
                };
            }

            // Pause for 500 ms before proceeding
            await new Promise(resolve => setTimeout(resolve, 500));

            // Send API calls to delete webhook subscriptions
            try {
                logger.info("Reset webhook subscriptions: Resetting Webhook Subscriptions");
                await integration.kick.webhookSubscriptionManager.resetWebhookSubscriptions();
                logger.info("Reset webhook subscriptions: Webhook subscriptions reset");
            } catch (error) {
                logger.error(`Reset webhook subscriptions: Failed to reset webhook subscriptions: ${error}`);
                integration.sendChatFeedErrorNotification(`Resetting webhook subscriptions has failed, likely due to problems connecting to the Kick API. You may want to try again later.`);
            }

            // Reconnect integration (which will re-create any subscriptions)
            try {
                logger.info("Reset webhook subscriptions: Reconnecting Kick integration");
                await integration.connect();
                logger.info("Reset webhook subscriptions: Integration connected");
            } catch (error) {
                logger.error(`Reset webhook subscriptions: Failed to connect integration: ${error}`);

                try {
                    await integration.disconnect();
                } catch (disconnectError) {
                    logger.error(`Reset webhook subscriptions: Failed to disconnect integration: ${disconnectError}`);
                }

                integration.sendChatFeedErrorNotification(`The integration has been disconnected. Please check the connection status and reconnect as needed.`);
                return {
                    success: false,
                    error: error
                };
            }

            logger.info("Reset webhook subscriptions: Successfully reset webhook subscriptions and reconnected integration.");
            integration.sendChatFeedErrorNotification(`Webhook subscriptions have been reset and the integration was reconnected successfully.`);
            return {
                success: true
            };
        }

        return {
            success: false,
            error: `Unknown maintenance action: ${JSON.stringify(effect.action)}`
        };
    }
};

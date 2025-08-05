import { Firebot } from "@crowbartools/firebot-custom-scripts-types";
import { integration } from "../integration";
import { IntegrationConstants } from "../constants";
import { logger } from "../main";

export const streamGameEffect: Firebot.EffectType<{
    gameId: string;
}> = {
    definition: {
        id: "mage-firebot-integration:streamgame",
        name: "Set Stream Category (Kick)",
        description: "Set the stream category/game on Kick.",
        icon: "fad fa-gamepad",
        categories: ["common"]
    },
    optionsTemplate: `
        <eos-container header="Category ID" pad-top="true">
            <input ng-model="effect.gameId" class="form-control" type="text" placeholder="Enter category/game ID" replace-variables>
        </eos-container>
    `,
    optionsController: () => {
        // None
    },
    optionsValidator: (effect) => {
        const errors = [];
        if (
            effect.gameId == null ||
            typeof effect.gameId !== "string" ||
            !/^\d+$/.test(effect.gameId) ||
            Number(effect.gameId) <= 0
        ) {
            errors.push("Please input a valid numeric ID for a category/game.");
        }
        return errors;
    },
    getDefaultLabel: (effect) => {
        if (effect.gameId) {
            return `Set Stream Category to ID: ${effect.gameId}`;
        }
        return "";
    },
    onTriggerEvent: async (event) => {
        const { effect } = event;
        const category = effect.gameId;

        // Validate the category ID
        if (!/^\d+$/.test(category) || Number(category) <= 0) {
            throw new Error("Invalid category ID provided.");
        }

        // Set the stream category using the integration
        type categoryPayload = {
            category_id: number;
        }

        const payload: categoryPayload = {
            // eslint-disable-next-line camelcase
            category_id: Number(category)
        };

        logger.debug(`[${IntegrationConstants.INTEGRATION_ID}] Setting stream category via payload: ${JSON.stringify(payload)}`);

        await integration.kick.httpCallWithTimeout(
            "/public/v1/channels",
            "PATCH",
            JSON.stringify(payload)
        );

        return true;
    }
};

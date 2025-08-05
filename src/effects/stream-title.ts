import { Firebot } from "@crowbartools/firebot-custom-scripts-types";
import { integration } from "../integration";
import { IntegrationConstants } from "../constants";
import { logger } from "../main";

export const streamTitleEffect: Firebot.EffectType<{
    title: string;
}> = {
    definition: {
        id: "mage-firebot-integration:streamtitle",
        name: "Set Stream Title (Kick)",
        description: "Set the title of the stream on Kick.",
        icon: "fad fa-comment-dots",
        categories: ["common"]
    },
    optionsTemplate: `
        <eos-container header="New Title" pad-top="true">
            <input ng-model="effect.title" class="form-control" type="text" placeholder="Enter text" replace-variables menu-position="below">
            <p ng-show="trigger == 'command'" class="muted" style="font-size:11px;margin-top:6px;"><b>ProTip:</b> Use <b>$arg[all]</b> to include every word after the command !trigger.</p>
        </eos-container>
    `,
    optionsController: () => {
        // None
    },
    optionsValidator: (effect) => {
        const errors = [];
        if (effect.title == null) {
            errors.push("Please input the title you'd like to use for the stream.");
        }
        return errors;
    },
    onTriggerEvent: async (event) => {
        const { effect } = event;

        // Set the stream title using the integration
        const payload = {
            // eslint-disable-next-line camelcase
            stream_title: effect.title
        };

        logger.debug(`[${IntegrationConstants.INTEGRATION_ID}] Setting stream title via payload: ${JSON.stringify(payload)}`);

        await integration.kick.httpCallWithTimeout(
            "/public/v1/channels",
            "PATCH",
            JSON.stringify(payload)
        );

        return true;
    }
};

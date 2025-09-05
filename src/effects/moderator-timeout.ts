import { Firebot } from "@crowbartools/firebot-custom-scripts-types";
import { integration } from "../integration";
import { logger } from "../main";
import { IntegrationConstants } from "../constants";

export const moderatorTimeoutEffect: Firebot.EffectType<{
    username: string;
    time: string | number;
    reason: string;
}> = {
    definition: {
        id: `${IntegrationConstants.INTEGRATION_ID}:modTimeout`,
        name: "Timeout (Kick)",
        description: "Timeout a user on Kick.",
        icon: "fad fa-user-clock",
        categories: ["common"],
        dependencies: []
    },
    optionsTemplate: `
        <eos-container header="Target" pad-top="true">
            <div class="input-group">
                <span class="input-group-addon" id="username-type">Username</span>
                <input ng-model="effect.username" type="text" class="form-control" id="list-username-setting" aria-describedby="list-username-type" replace-variables menu-position="below">
            </div>
        </eos-container>
        <eos-container header="Time" pad-top="true">
            <p class="muted">Due to API limitations, the permitted range is 60-604800 seconds (1 minute-7 days). The seconds you specify here will be rounded to the nearest minute.</p>
            <div class="input-group">
                <span class="input-group-addon" id="time-type">Time (Seconds)</span>
                <input ng-model="effect.time" type="text" class="form-control" id="list-username-setting" aria-describedby="list-time-type" placeholder="Seconds" replace-variables="number">
            </div>
        </eos-container>
        <eos-container header="Reason" pad-top="true">
            <p class="muted">Optional reason why this user is being timed out</p>
            <div class="input-group">
                <span class="input-group-addon" id="username-type">Reason</span>
                <input ng-model="effect.reason" type="text" class="form-control" id="list-reason-setting" aria-describedby="list-reason-type" replace-variables>
            </div>
        </eos-container>
    `,
    optionsController: () => {
        // None
    },
    optionsValidator: (effect) => {
        const errors = [];
        if (effect.username == null || effect.username === "") {
            errors.push("Please enter a username.");
        }
        if (effect.time == null || effect.time === "") {
            // We can't check for a number here or do numeric comparisons
            // because the value could be a replace variable.
            errors.push("Please enter an amount of time.");
        }
        return errors;
    },
    getDefaultLabel(effect) {
        return `${effect.time} sec timeout for ${effect.username}`;
    },
    onTriggerEvent: async (event) => {
        // Here the time should be a number since all variables should have been
        // resolved.
        const timeAsNumber = Number(event.effect.time);
        if (isNaN(timeAsNumber)) {
            logger.error(`Invalid timeout time provided: ${event.effect.time}`);
            return false;
        }

        // Range to the Kick API is 1-10080 minutes (7 days)
        const duration = Math.max(1, Math.min(10080, Math.round(timeAsNumber / 60)));
        const isTimedOut = await integration.kick.userApi.banUserByUsername(event.effect.username, duration, true, event.effect.reason || "Timed out via Firebot");
        if (isTimedOut) {
            logger.debug(`${event.effect.username} was timed out via the Timeout effect (duration=${duration} minutes).`);
        } else {
            logger.error(`${event.effect.username} was unable to be timed out via the Timeout effect (duration=${duration} minutes).`);
            return false;
        }
        return true;
    }
};

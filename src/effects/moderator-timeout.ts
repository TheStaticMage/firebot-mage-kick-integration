import { Firebot } from "@crowbartools/firebot-custom-scripts-types";
import { integration } from "../integration";
import { logger } from "../main";
import { IntegrationConstants } from "../constants";

export const moderatorTimeoutEffect: Firebot.EffectType<{
    username: string;
    time: number;
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
            <p class="muted">Due to API limitations, the minimum timeout duration is 1 minute, and the time you specify here will be rounded to the nearest minute.</p>
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
        if (effect.username == null && effect.username !== "") {
            errors.push("Please enter a username.");
        }
        if (effect.time == null && (effect.time !== "" || effect.time < 0)) {
            errors.push("Please enter an amount of time.");
        }
        return errors;
    },
    getDefaultLabel(effect) {
        return `${effect.time} sec timeout for ${effect.username}`;
    },
    onTriggerEvent: async (event) => {
        const duration = Math.round(event.effect.time / 60);
        if (duration < 1 || duration > 10080) {
            logger.error(`Invalid timeout duration: ${duration}`);
            return false;
        }

        const isTimedOut = await integration.kick.userApi.banUserByUsername(event.effect.username, duration, true, event.effect.reason || "Timed out via Firebot");
        if (isTimedOut) {
            logger.debug(`${event.effect.username} was timed out via the Timeout effect.`);
        } else {
            logger.error(`${event.effect.username} was unable to be timed out via the Timeout effect.`);
            return false;
        }
        return true;
    }
};

import { Firebot } from "@crowbartools/firebot-custom-scripts-types";
import { integration } from "../integration";
import { logger } from "../main";
import { IntegrationConstants } from "../constants";

export const moderatorBanEffect: Firebot.EffectType<{
    action: string;
    username: string;
    reason: string;
}> = {
    definition: {
        id: `${IntegrationConstants.INTEGRATION_ID}:modban`,
        name: "Ban (Kick)",
        description: "Ban or unban a user on Kick.",
        icon: "fad fa-ban",
        categories: ["common"],
        dependencies: []
    },
    optionsTemplate: `
        <eos-container header="Action" pad-top="true">
            <div class="btn-group">
                <button type="button" class="btn btn-default dropdown-toggle" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                    <span class="list-effect-type">{{effect.action ? effect.action : 'Pick one'}}</span> <span class="caret"></span>
                </button>
                <ul class="dropdown-menu celebrate-effect-dropdown">
                    <li ng-click="effect.action = 'Ban'">
                        <a href>Ban</a>
                    </li>
                    <li ng-click="effect.action = 'Unban'">
                        <a href>Unban</a>
                    </li>
                </ul>
            </div>
        </eos-container>
        <eos-container header="Target" pad-top="true" ng-show="effect.action != null">
            <div class="input-group">
                <span class="input-group-addon" id="username-type">Username</span>
                <input ng-model="effect.username" type="text" class="form-control" id="list-username-setting" aria-describedby="list-username-type" replace-variables>
            </div>
        </eos-container>
        <eos-container header="Reason" pad-top="true" ng-show="effect.action === 'Ban'">
            <p class="muted">Optional reason why this user is being banned</p>
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
        if (effect.action == null) {
            errors.push("Please choose a ban action.");
        }
        if (effect.username == null && effect.username !== "") {
            errors.push("Please put in a username.");
        }
        return errors;
    },
    getDefaultLabel(effect) {
        return `${effect.action} ${effect.username}`;
    },
    onTriggerEvent: async (event) => {
        if (event.effect.action === "Ban") {
            const isBanned = await integration.kick.userApi.banUserByUsername(event.effect.username, 0, true, event.effect.reason || "Banned via Firebot");
            if (isBanned) {
                logger.debug(`${event.effect.username} was banned via the Ban effect.`);
            } else {
                logger.error(`${event.effect.username} was unable to be banned via the Ban effect.`);
                return false;
            }
        }

        if (event.effect.action === "Unban") {
            const isUnbanned = await integration.kick.userApi.banUserByUsername(event.effect.username, 0, false);
            if (isUnbanned) {
                logger.debug(`${event.effect.username} was unbanned via the Unban effect.`);
            } else {
                logger.error(`${event.effect.username} was unable to be unbanned via the Unban effect.`);
                return false;
            }
        }
        return true;
    }
};

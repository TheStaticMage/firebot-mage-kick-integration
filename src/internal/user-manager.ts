import { IntegrationConstants } from "../constants";
import { logger } from "../main";
import { BasicKickUser } from "../shared/types";
import { Kick } from "./kick";
import { parseBasicKickUser } from "./parser/parser";

export class KickUserManager {
    private kick: Kick;

    constructor(kick: Kick) {
        this.kick = kick;
    }

    async getUser(userId = 0): Promise<BasicKickUser> {
        return new Promise((resolve, reject) => {
            const formVariables = new URLSearchParams();
            if (userId > 0) {
                formVariables.append("id", userId.toString());
            }

            const uri = `/public/v1/users${formVariables.toString().length > 0 ? `?${formVariables.toString()}` : ''}`;
            this.kick.httpCallWithTimeout(uri, "GET")
                .then((response) => {
                    if (!response || !response.data || response.data.length !== 1) {
                        logger.debug(`[${IntegrationConstants.INTEGRATION_ID}] Failed to retrieve user from Kick API response. ${JSON.stringify(response)}`);
                        reject(new Error("Failed to retrieve user from Kick API."));
                    }

                    const user = parseBasicKickUser(response.data[0]);
                    if (!user.userId) {
                        logger.debug(`[${IntegrationConstants.INTEGRATION_ID}] No user ID found in Kick API response.`);
                        reject(new Error("No user ID found in Kick API response."));
                    }

                    logger.debug(`[${IntegrationConstants.INTEGRATION_ID}] Successfully retrieved user: ${user.userId} (${user.name})`);
                    resolve(user);
                })
                .catch((error) => {
                    reject(error);
                });
        });
    }
}

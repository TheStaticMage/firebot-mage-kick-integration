import { Firebot, RunRequest } from '@crowbartools/firebot-custom-scripts-types';
import { Logger } from '@crowbartools/firebot-custom-scripts-types/types/modules/logger';
import { IntegrationConstants } from './constants';
import { definition, integration } from './integration';
import { checkPlatformLibCompatibility } from './platform-lib-checker';

export let firebot: RunRequest<any>;
export let logger: LogWrapper;

export const scriptVersion = '0.7.0';

const script: Firebot.CustomScript = {
    getScriptManifest: () => {
        return {
            name: 'Kick Integration',
            description: 'Integration with certain events for the Kick platform.',
            author: 'The Static Mage',
            version: scriptVersion,
            startupOnly: true,
            firebotVersion: '5'
        };
    },
    getDefaultParameters: () => {
        return {};
    },
    run: async (runRequest: RunRequest<any>) => {
        firebot = runRequest;
        logger = new LogWrapper(runRequest.modules.logger);
        logger.info(`Mage Kick Integration v${scriptVersion} initializing...`);

        // Check for platform-lib compatibility
        const compatibilityCheck = await checkPlatformLibCompatibility(
            runRequest,
            logger
        );

        if (!compatibilityCheck.success) {
            const { frontendCommunicator } = runRequest.modules;
            frontendCommunicator.send("error", `Kick Integration: ${compatibilityCheck.errorMessage}`);
            logger.error(`Platform-lib compatibility check failed: ${compatibilityCheck.errorMessage}`);
            return;
        }

        const { integrationManager } = runRequest.modules;
        integrationManager.registerIntegration({ definition, integration });
    }
};

export default script;

export class LogWrapper {
    private _logger: Logger;

    constructor(inLogger: Logger) {
        this._logger = inLogger;
    }

    info(message: string) {
        this._logger.info(`[${IntegrationConstants.INTEGRATION_ID}] ${message}`);
    }

    error(message: string) {
        this._logger.error(`[${IntegrationConstants.INTEGRATION_ID}] ${message}`);
    }

    debug(message: string) {
        this._logger.debug(`[${IntegrationConstants.INTEGRATION_ID}] ${message}`);
    }

    warn(message: string) {
        this._logger.warn(`[${IntegrationConstants.INTEGRATION_ID}] ${message}`);
    }
}

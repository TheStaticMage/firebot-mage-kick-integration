import { Firebot, RunRequest } from '@crowbartools/firebot-custom-scripts-types';
import { Logger } from '@crowbartools/firebot-custom-scripts-types/types/modules/logger';
import { satisfies } from 'semver';
import { IntegrationConstants } from './constants';
import { definition, integration } from './integration';

export let firebot: RunRequest<any>;
export let logger: LogWrapper;

export const scriptVersion = '0.9.1';

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
    run: (runRequest: RunRequest<any>) => {
        firebot = runRequest;
        logger = new LogWrapper(runRequest.modules.logger);

        // Check Firebot version compatibility
        const fbVersion = firebot.firebot.version;
        logger.debug(`Detected Firebot version: ${fbVersion}`);
        if (!satisfies(fbVersion, ">= 5.65.0-0", { includePrerelease: true })) {
            logger.error(`${IntegrationConstants.INTEGRATION_ID} requires Firebot version 5.65.0 or higher (including prereleases). Detected version: ${fbVersion}. Please update Firebot to use this plugin.`);
            return;
        }

        logger.info(`Mage Kick Integration v${scriptVersion} initializing...`);

        const { integrationManager } = runRequest.modules;
        integrationManager.registerIntegration({ definition, integration });
    }
};

export default script;

class LogWrapper {
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

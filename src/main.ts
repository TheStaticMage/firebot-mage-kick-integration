import { Firebot, RunRequest } from '@crowbartools/firebot-custom-scripts-types';
import { Logger } from '@crowbartools/firebot-custom-scripts-types/types/modules/logger';
import { definition, integration } from './integration';

export let firebot: RunRequest<any>;
export let logger: Logger;

const scriptVersion = '0.1.0';

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
        logger = runRequest.modules.logger;

        const { integrationManager } = runRequest.modules;
        integrationManager.registerIntegration({ definition, integration });
    }
};

export default script;

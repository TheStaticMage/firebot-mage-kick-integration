import { AngularJsFactory, UIExtension } from "@crowbartools/firebot-custom-scripts-types/types/modules/ui-extension-manager";
import { IntegrationConstants } from "../constants";
import { firebot, logger } from "../main";
import { ReflectedEvent } from "../shared/types";
import { requireVersion } from "./version";

const kickReflectorService: AngularJsFactory = {
    name: "kickReflectorService",
    function: (backendCommunicator: any) => {
        // IntegrationConstants not available in here, so hardcoding
        backendCommunicator.onAsync(`mage-kick-integration:reflect-async`, async (data: ReflectedEvent) => {
            if (data == null || !data.eventName?.length) {
                return;
            }
            if (data.async) {
                return backendCommunicator.fireEventAsync(data.eventName, data.eventData);
            }
            return backendCommunicator.fireEventSync(data.eventName, data.eventData);
        });

        return {};
    }
};

export const reflectorExtension: UIExtension = {
    id: `${IntegrationConstants.INTEGRATION_ID}-reflector`,
    providers: {
        factories: [kickReflectorService]
    }
};

export async function reflectEvent<T>(eventName: string, eventData: any, isAsync = true): Promise<T> {
    // Needs commit d4352b4
    requireVersion("5.65");

    const payload: ReflectedEvent = {
        async: isAsync,
        eventName,
        eventData
    };
    logger.debug(`Sending reflect event to frontend: eventName=${eventName}, isAsync=${isAsync}`);

    const { frontendCommunicator } = firebot.modules;
    const timeoutMs = 1000;
    return await Promise.race([
        frontendCommunicator.fireEventAsync<any>(`${IntegrationConstants.INTEGRATION_ID}:reflect-async`, payload),
        new Promise<never>((_, reject) => setTimeout(() => {
            reject(new Error("Reflect event timeout"));
        }, timeoutMs))
    ]) as T;
}

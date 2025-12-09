import { kickExtension } from "./kick";

export function registerUIExtensions(firebot: any): void {
    const { uiExtensionManager } = firebot.modules;
    if (uiExtensionManager) {
        uiExtensionManager.registerUIExtension(kickExtension);
    }
}

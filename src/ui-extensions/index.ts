import { kickAccountsExtension } from "./kick-accounts";

export function registerUIExtensions(firebot: any): void {
    const { uiExtensionManager } = firebot.modules;
    if (uiExtensionManager) {
        uiExtensionManager.registerUIExtension(kickAccountsExtension);
    }
}

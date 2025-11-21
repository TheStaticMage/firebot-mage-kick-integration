import { RunRequest } from "@crowbartools/firebot-custom-scripts-types";
import { getStartupScripts, checkSemanticVersion, loadScriptVersion } from "@thestaticmage/mage-platform-lib-client";
import { LogWrapper } from "./main";
import { IntegrationConstants } from "./constants";

/**
 * Checks if platform-lib startup script is installed and meets minimum version requirement.
 *
 * @param runRequest - Firebot RunRequest with modules and scriptDataDir
 * @param logger - Logger instance for debug output
 * @returns Object with success status and error message if check fails
 */
export async function checkPlatformLibCompatibility(
    runRequest: RunRequest<any>,
    logger: LogWrapper
): Promise<{ success: boolean; errorMessage?: string }> {
    const { modules, scriptDataDir } = runRequest;
    try {
        logger.debug("Checking for platform-lib startup script...");

        const startupScripts = await getStartupScripts(modules, logger, 5000);

        // Look for platform-lib startup script by name and ID
        // Following the same pattern as integration-detector.ts
        const platformLib = startupScripts.find(
            script =>
                script.name?.toLowerCase() === "platform library" ||
                script.scriptName?.toLowerCase() === "firebot-mage-platform-lib.js" ||
                script.id?.toLowerCase() === "firebot-mage-platform-lib"
        );

        if (!platformLib) {
            return {
                success: false,
                errorMessage:
                    "Platform Library startup script is not installed. Please install https://github.com/TheStaticMage/firebot-mage-platform-lib before using the Kick Integration."
            };
        }

        logger.debug(`Found platform-lib: ${platformLib.name}`);

        // Load version from the startup script bundle
        const version = loadScriptVersion("firebot-mage-platform-lib.js", scriptDataDir, modules, logger);

        if (!version) {
            return {
                success: false,
                errorMessage: "Platform Library version could not be determined. Please install https://github.com/TheStaticMage/firebot-mage-platform-lib before using the Kick Integration."
            };
        }

        // Check version compatibility
        const isCompatible = checkSemanticVersion(
            version,
            IntegrationConstants.PLATFORM_LIB_VERSION_CONSTRAINT
        );

        if (!isCompatible) {
            return {
                success: false,
                errorMessage: `Platform Library version ${version} is not compatible. Kick Integration requires version ${IntegrationConstants.PLATFORM_LIB_MIN_VERSION} or higher. Please install a compatible version of https://github.com/TheStaticMage/firebot-mage-platform-lib before using the Kick Integration.`
            };
        }

        logger.debug(`Platform-lib v${version} is compatible`);

        return { success: true };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Error checking platform-lib compatibility: ${errorMessage}`);

        return {
            success: false,
            errorMessage: `Error checking Platform Library: ${errorMessage}`
        };
    }
}

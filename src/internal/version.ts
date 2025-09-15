import { firebot } from "../main";

export function requireVersion(versionNumber: string): void {
    if (!firebot || !firebot.firebot || !firebot.firebot.version) {
        throw new Error("Firebot version information is not available.");
    }

    const firebotVersion = firebot.firebot.version;
    const firebotParts = firebotVersion.split('.');
    const majorVersion = parseInt(firebotParts[0], 10);
    const minorVersion = parseInt(firebotParts[1] || '0', 10);
    const patchVersion = parseInt(firebotParts[2] || '0', 10);

    const reqParts = versionNumber.split('.');
    const reqMajor = parseInt(reqParts[0], 10);
    const reqMinor = parseInt(reqParts[1] || '0', 10);
    const reqPatch = reqParts.length >= 3 ? parseInt(reqParts[2] || '0', 10) : undefined;

    // Check major version
    if (majorVersion < reqMajor) {
        throw new Error(`Firebot version must be >= ${versionNumber} to use this feature (got ${firebotVersion}).`);
    }
    if (majorVersion > reqMajor) {
        return; // Higher major version is always sufficient
    }

    // Major versions are equal, check minor version
    if (minorVersion < reqMinor) {
        throw new Error(`Firebot version must be >= ${versionNumber} to use this feature (got ${firebotVersion}).`);
    }
    if (minorVersion > reqMinor) {
        return; // Higher minor version is sufficient
    }

    // Major and minor versions are equal, check patch version if specified
    if (reqPatch !== undefined && patchVersion < reqPatch) {
        throw new Error(`Firebot version must be >= ${versionNumber} to use this feature (got ${firebotVersion}).`);
    }
}

import { KickConnection } from "../shared/types";

export function isConnectionReady(connection: KickConnection): boolean {
    return !!connection.refreshToken && connection.ready;
}

export function updateConnectionReadyStatus(
    connection: KickConnection,
    refreshSuccess: boolean
): void {
    connection.ready = refreshSuccess;
}

export function getConnectionStatusMessage(connection: KickConnection, isIntegrationConnected = true): string {
    if (!isIntegrationConnected) {
        return "Integration disconnected";
    }

    if (!connection.ready) {
        if (!connection.refreshToken) {
            return "Authorization required";
        }
        return "Awaiting connection";
    }

    const missingScopes = connection.missingScopes || [];
    if (missingScopes.length > 0) {
        return "Partial - Missing permissions";
    }

    if (connection.tokenExpiresAt) {
        const expiresAt = new Date(connection.tokenExpiresAt);
        const year = expiresAt.getFullYear();
        const month = String(expiresAt.getMonth() + 1).padStart(2, "0");
        const day = String(expiresAt.getDate()).padStart(2, "0");
        const hours = String(expiresAt.getHours()).padStart(2, "0");
        const minutes = String(expiresAt.getMinutes()).padStart(2, "0");
        const seconds = String(expiresAt.getSeconds()).padStart(2, "0");
        const dateTimeStr = `${year}-${month}-${day} at ${hours}:${minutes}:${seconds}`;
        return `Ready - Token expires ${dateTimeStr}`;
    }

    return "Ready";
}

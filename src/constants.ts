export const IntegrationConstants = {
    INTEGRATION_ID: "mage-kick-integration",
    INTEGRATION_NAME: "MageKickIntegration",
    INTEGRATION_DESCRIPTION: "A preliminary, experimental, and generally not-recommended Kick integration for Firebot.",
    INTEGRATION_URI: "firebot-mage-kick-integration",
    KICK_API_SERVER: "https://api.kick.com",
    KICK_AUTH_SERVER: "https://id.kick.com",
    SCOPES: [
        "user:read",
        "channel:read",
        "channel:write",
        "chat:write",
        "events:subscribe",
        "moderation:ban"
    ]
} as const;

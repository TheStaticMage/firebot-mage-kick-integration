export const IntegrationConstants = {
    INTEGRATION_ID: "mage-kick-integration",
    INTEGRATION_NAME: "MageKickIntegration",
    INTEGRATION_DESCRIPTION: "A preliminary, experimental, and generally not-recommended Kick integration for Firebot.",
    INTEGRATION_URI: "firebot-mage-kick-integration",
    KICK_API_SERVER: "https://api.kick.com",
    KICK_AUTH_SERVER: "https://id.kick.com",
    PUSHER_APP_KEY: "32cbd69e4b950bf97679",
    STREAMER_SCOPES: [
        "user:read",
        "channel:read",
        "channel:write",
        "chat:write",
        "events:subscribe",
        "moderation:ban"
    ],
    BOT_SCOPES: [
        "user:read",
        "chat:write"
    ]
} as const;

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
    ],
    KICK_BADGE_URLS: {
        // Currently Kick does not have URLs for the badges as they are embedded SVG
        // files. We're just going to fall back to the Twitch badges for now.
        // https://discord.com/channels/1341256548323692586/1341264509511143424/1401335108635459685
        "broadcaster": "https://static-cdn.jtvnw.net/badges/v1/5527c58c-fb7d-422d-b71b-f309dcb85cc1/1",
        "moderator": "https://static-cdn.jtvnw.net/badges/v1/3267646d-33f0-4b17-b3df-f923a41db1d0/1"
    } as Record<string, string>
} as const;

# Firebot Kick Integration

## Disclaimer and Warning

**THIS PROJECT IS NOT ASSOCIATED WITH FIREBOT OR KICK.COM AND IS NOT ENDORSED OR SUPPORTED BY THEIR DEVELOPERS OR ANYONE ELSE.**

**ALL DATA STRUCTURES AND EVENTS IN THIS INTEGRATION -- EVEN THOSE THAT SEEM TO MAP CLEANLY -- ARE TOTAL HACKS. ALL EVENTS ARE IMPLEMENTED ... HACKILY. THIS INTEGRATION CONTAINS FORWARD-INCOMPATIBLE WORKAROUNDS AND DUE TO ITS CONTENT IT SHOULD NOT BE USED BY ANYONE.**

Use caution: this integration uses forward-incompatible workarounds and should be treated as experimental.

- Firebot is designed for a single streaming platform (Twitch), and many core assumptions and functionality are tightly coupled to this design. As a result, full compatibility with Kick is not achievable under the current architecture.

- While I've tried to clearly separate Kick user data from Firebot's built-in databases, there's a risk of data leakage or corruption. This could impair or disable your Firebot instance entirely. Always maintain reliable backups.

- Kick's public API is currently limited and incomplete. Only a small set of events is supported. (Note: Some bots use private APIs, but I purposefully avoided that route to reduce brittleness.)

- This integration depends upon Kick's undocumented "pusher" WebSocket service, but that could break without warning.

Additional considerations:

- Full functionality requires a webhook proxy server to relay Kick webhooks to Firebot. I've provided instructions for [deploying such a server with Render](/server).

- For partial functionality without a webhook proxy server, you can register your own Kick app and input its client ID and secret into Firebot. Some events (notably follows) are unavailable without the proxy.

- Firebot only responds to events once a Kick notification is received. Kick webhook delivery can be delayed by seconds or even minutes.

## Introduction

This [Firebot](https://firebot.app) integration provides events and effects for the [kick.com](https://kick.com) streaming platform.

Currently supported:

- Accounts:
  - Chat as the streamer or as a separate bot account
- Chat integration:
  - Kick messages appear in Firebot's chat feed (Dashboard), displaying Kick usernames and supporting emotes.
  - Ban user from the context menu in the chat feed.
- Commands:
  - Standard commands mostly work, including restriction logic (with a custom Platform restriction).
- Conditions:
  - Platform
- Effects:
  - Chat message (Kick)
  - Chat message (Platform aware)
  - Set stream game
  - Set stream title
  - Trigger Custom Channel Reward Handler
- Events:
  - Channel data updated
  - Channel points redeemed
  - Chat message
  - Follow
  - Host (raid)
  - Stream started
  - Stream ended
  - Viewer arrived
  - Viewer banned
  - Viewer timed out
- Filters:
  - Platform
  - Viewer count (hosts)
- Variables:
  - `$hostViewerCount` (also returns viewer count for Twitch raids)
  - `$kickCategory` (`$kickCategory`) for your channel or another channel
  - `$kickCategoryId` (`$kickGameId`) for your channel or another channel
  - `$kickCategoryImageUrl` for your channel or another channel
  - `$kickChatMessage`
  - `$kickChannelId` for your channel or another channel
  - `$kickCurrentViewerCount` for your channel or another channel
  - `$kickModerator` (for bans/timeouts)
  - `$kickModReason` (for bans/timeouts)
  - `$kickRewardId` (for redeems)
  - `$kickRewardMessage` (for redeems)
  - `$kickRewardName` (for redeems)
  - `$kickStreamer`
  - `$kickStreamerId`
  - `$kickStreamIsLive` for your channel or another channel
  - `$kickStreamTitle` for your channel or another channel
  - `$kickTimeoutDuration` (in seconds)
  - `$kickUptime` for your channel or another channel
  - `$kickUserDisplayName`
  - `$platform`
  - `$platformAwareUserDisplayName`

Planned but not yet supported:

- Subscription-related events (renewals, gifts, first time subs)
- Live stream metadata updates (e.g., game/title change)
- Events when a user is unbanned or untimed-out
- Effects to ban, unban, timeout, and untimeout users
- Chat roles

Limitations due to Kick:

- Many user actions (e.g., custom rewards, raids, unbans) don't trigger webhooks. Some are only available via "pusher" WebSocket. Others are not provided at all. The integration can only support events that Kick provides.
- Kick delivers profile image URLs that only resolve from kick.com, so these images may not display correctly elsewhere.
- Kick's public API is lacking basic chat management options (e.g. delete message, clear chat), so we cannot implement these in Firebot's chat feed.
- There is currently no API for fetching the viewer list, which prevents watch-time tracking and currency accrual.
- Channel point redeems on Kick cannot be managed via API (creation, approval, rejection), nor can they be disabled or paused. This means that Firebot cannot control them.
- Configuration of the "pusher" websocket requires your channel ID and chatroom ID, which are different from your user ID. The process to determine these can be tedious. Thankfully, you'll only need to do this once.

Limitations due to Firebot:

- Firebot's viewer database uses Twitch user IDs as primary keys and assumes every user is from Twitch. This rigid design prevents full platform independence.
- Rate limiting (cooldowns) for commands and redeems doesn't work natively. Consider using the [Firebot Rate Limiter](https://github.com/TheStaticMage/firebot-rate-limiter) if needed.
- Many built-in Firebot variables and effects are hard-coded to be available only to specific Twitch events. Therefore, this integration introduces Kick-specific variables like `$kickModerator`. Alternatively, you can trigger equivalent Twitch events if your effects are platform-aware.

## Installation

This integration is experimental and aimed at users comfortable with technical setup. I will reconsider broader release once:

1. Kick offers a public WebSocket API, and
2. Firebot evolves for cleaner multi-platform support.

[Installation instructions](/doc/installation.md) are available if you're feeling adventurous.

## Support

**Again: This project is not associated with or supported by Firebot or Kick.com.**

There is no official support available. Using this may jeopardize Firebot's stability or future upgrades. Always maintain reliable backups.

## Contributions

Contributions are welcome via [Pull Requests](https://github.com/TheStaticMage/firebot-mage-kick-integration/pulls). I _strongly suggest_ that you contact me before making significant changes, because I'd feel really bad if you spent a lot of time working on something that is not consistent with my vision for the project. Please refer to the [Contribution Guidelines](/.github/contributing.md) for specifics.

Join our Discord community in [The Static Family](https://discord.gg/hzDYKzG9Zp) and head to the `#firebot-mage-kick-integration` channel to discuss.

Please note:

- I will not accept contributions relying on Kick's "private API." I'd rather just encourage you to stream on Twitch than provide fragile workarounds if you depend on certain functionality.
- I will not accept contributions requiring Firebot modifications that haven't been upstream-approved. I run Firebot on the `v5` branch, so changes that are merged there (or are in developer-approved pull requests) are acceptable.
- If you don't agree with this approach, feel free to fork the project and develop it your way.

## License

This project is released under the [GNU General Public License version 3](/LICENSE).

Some code in this project is based on (or copied from) [Firebot](https://github.com/crowbartools/firebot), which is licensed under the GNU GPL 3 as well. Since the source code is distributed here and links back to Firebot, this project complies with the license.

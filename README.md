# Firebot Kick Integration

## Disclaimer and Warning

**THIS PROJECT IS NOT ASSOCIATED WITH FIREBOT OR KICK.COM AND IS NOT ENDORSED OR SUPPORTED BY THEIR DEVELOPERS OR ANYONE ELSE.**

**ALL DATA STRUCTURES AND EVENTS IN THIS INTEGRATION -- EVEN THOSE THAT SEEM TO MAP CLEANLY -- ARE TOTAL HACKS. ALL EVENTS ARE IMPLEMENTED ... HACKILY. THIS INTEGRATION CONTAINS FORWARD-INCOMPATIBLE WORKAROUNDS AND DUE TO ITS CONTENT IT SHOULD NOT BE USED BY ANYONE.**

Use caution: this integration uses forward-incompatible workarounds and should be treated as experimental.

- Firebot is designed for a single streaming platform (Twitch), and many core assumptions and functionality are tightly coupled to this design. As a result, full compatibility with Kick is not achievable under the current architecture.

- While I've tried to clearly separate Kick user data from Firebot's built-in databases, there's a risk of data leakage or corruption. This could impair or disable your Firebot instance entirely. Always maintain reliable backups.

- Kick's public API is currently limited and incomplete. Only a small set of events is supported. (Note: Some bots use private APIs, but I purposefully avoided that route to reduce brittleness.)

- Some features of this integration depends upon Kick's undocumented "pusher" WebSocket service, but that could break without warning.

Additional considerations:

- Full functionality requires a webhook proxy server to relay Kick webhooks to Firebot. I've provided instructions for [deploying such a server with Render](/server).

- For partial functionality without a webhook proxy server, you can register your own Kick app and input its client ID and secret into Firebot. Some events (notably follows) are unavailable without the proxy. This project prioritizes feature development with the documented public API.

- Firebot only responds to events once a Kick notification is received. Kick webhook delivery can be delayed by seconds or even minutes.

## Introduction

This [Firebot](https://firebot.app) integration provides chat feed integration, events and effects for the [kick.com](https://kick.com) streaming platform. This allows you to handle events in Firebot from the Kick platform, such as chat messages, commands, follows, subscriptions, and the like. This also provides effects to send messages to Kick, change the title or category of your stream, and ban and unban users (planned).

### Effects

| Effect | Supported | Notes |
| ------ | --------- | ----- |
| Ban/Unban viewer | :white_check_mark: | |
| Chat (send message) | :white_check_mark: | Can chat as streamer or second "bot" account |
| Stream category change | :white_check_mark: | |
| Stream title change | :white_check_mark: | |
| Timeout viewer | :white_check_mark: | Unban the viewer to un-timeout |

### Events

| Event | With Webhook Proxy | No Webhook Proxy | Notes |
| ----- | ------------------ | ---------------- | ----- |
| Channel data updated | :white_check_mark: | :white_check_mark: | Based on refreshing stream info from Kick API |
| Channel points redeemed | :white_check_mark: &#42; | :white_check_mark: &#42; | |
| Chat message (incoming) | :white_check_mark: | :white_check_mark: &#42; |  |
| Follow | :white_check_mark: | :x: | Requires webhook proxy |
| Host (raid) (incoming) | :white_check_mark: &#42; | :white_check_mark: &#42; | |
| Host (raid) (outgoing) | :white_check_mark: &#42; | :white_check_mark: &#42; | |
| Message deleted | Planned | Planned | |
| Stream category (game) updated | :white_check_mark: | ? | Not yet evaluated for use without webhook proxy |
| Stream ended | :white_check_mark: | Planned |  |
| Stream started | :white_check_mark: | Planned |  |
| Stream title updated | :white_check_mark: | ? | Not yet evaluated for use without webhook proxy |
| Sub | :white_check_mark: | Planned | |
| Sub (Community Gifted) | :white_check_mark: | ? | Not yet evaluated for use without webhook proxy |
| Sub (Gifted) | :white_check_mark: | ? | Not yet evaluated for use without webhook proxy |
| Viewer arrived | :white_check_mark: | :white_check_mark: &#42; |  |
| Viewer banned | :white_check_mark: | Planned | |
| Viewer timed out | :white_check_mark: | Planned | |
| Viewer unbanned | :white_check_mark: &#42; | :white_check_mark: &#42; | Also handles un-timeout |

&#42; = Depends on undocumented "Pusher" functionality

### Limitations due to Kick

- Many user actions (e.g., custom rewards, raids, unbans) don't trigger webhooks. The integration can only support events that Kick provides.
- Kick delivers profile image URLs that only resolve from kick.com, so these images may not display correctly elsewhere.
- Kick's public API is lacking basic chat management options (e.g. delete message, clear chat), so we cannot implement these in Firebot's chat feed.
- There is currently no API for fetching the viewer list, which prevents watch-time tracking and currency accrual.
- There is currently no API to list your followers, subscribers, VIPs, moderators, etc. This limits what can be practically achieved with roles.
- Channel point redeems on Kick cannot be managed via API (creation, approval, rejection), nor can they be disabled or paused. This means that Firebot cannot control them.
- Kick does not provide programmatic definitions of chat badges (or even publish these as plain image files). We've hard-coded in the current definitions in the Firebot chat feed. If those change on Kick, you'll still see the old badges in the Firebot chat feed until the integration is updated.
- Configuration of the "pusher" websocket requires your channel ID and chatroom ID, which are different from your user ID. The process to determine these can be tedious. Thankfully, you'll only need to do this once.

### Limitations due to Firebot

- Firebot's viewer database uses Twitch user IDs as primary keys and assumes every user is from Twitch. This rigid design prevents many features that depend on storing information about users (e.g. currency, metadata).
- Rate limiting (cooldowns) for commands and redeems doesn't work natively. Consider using the [Firebot Rate Limiter](https://github.com/TheStaticMage/firebot-rate-limiter) if needed.
- Many built-in Firebot variables, filters and effects are hard-coded to be available only to specific Twitch events. This means that variables you'd expect to work just won't for the Kick events (e.g. `$moderator` is not available for ban events and `$chatMessage` will not contain the Kick chat message). We do have some workarounds in the form of Kick-specific variables like `$kickModerator` and the ability to trigger the Twitch-equivalent events when Kick events are received.
- Slash commands in the Firebot chat (e.g. `/clear`) only apply to Twitch. (There aren't Kick API endpoints for most of these anyway.)

## Installation

This integration is experimental and aimed at users comfortable with technical setup. I will reconsider broader release and support once:

1. Kick offers a public WebSocket connection option, and
2. Kick's public REST API is substantially more complete, and
3. Firebot evolves for cleaner multi-platform support.

[Installation instructions](/doc/installation.md) are available if you're feeling adventurous.

[Upgrading instructions](/doc/upgrading.md) are available if you felt adventurous in the past and are still feeling adventurous.

## Support

**Again: This project is not associated with or supported by Firebot or Kick.com.**

There is no official support available. Using this may jeopardize Firebot's stability or future upgrades. Always maintain reliable backups.

## Contributions

Contributions are welcome via [Pull Requests](https://github.com/TheStaticMage/firebot-mage-kick-integration/pulls). I _strongly suggest_ that you contact me before making significant changes, because I'd feel really bad if you spent a lot of time working on something that is not consistent with my vision for the project. Please refer to the [Contribution Guidelines](/.github/contributing.md) for specifics.

Join our Discord community in [The Static Family](https://discord.gg/hzDYKzG9Zp) and head to the `#firebot-mage-kick-integration` channel to discuss.

Please note:

- I will not accept contributions relying on Kick's "private API." I'd rather just encourage you to stream on Twitch than provide fragile workarounds if you depend on certain functionality.
- I will not accept contributions requiring Firebot modifications that haven't been upstream-approved. I run a customized version of Firebot based on the `v5` branch, so changes that are merged there (or are in developer-approved pull requests) are acceptable.
- If you don't agree with this approach, feel free to fork the project and develop it your way.

## License

This project is released under the [GNU General Public License version 3](/LICENSE).

Some code in this project is based on (or copied from) [Firebot](https://github.com/crowbartools/firebot), which is licensed under the GNU GPL 3 as well. Since the source code is distributed here and links back to Firebot, this project complies with the license.

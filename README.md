# Firebot Kick Integration

## Disclaimer and Warning

**THIS PROJECT IS NOT ASSOCIATED WITH FIREBOT OR KICK.COM AND IS NOT ENDORSED OR SUPPORTED BY THEIR DEVELOPERS OR ANYONE ELSE.**

**ALL DATA STRUCTURES AND EVENTS IN THIS INTEGRATION -- EVEN THOSE THAT SEEM TO MAP CLEANLY -- ARE TOTAL HACKS. ALL EVENTS ARE IMPLEMENTED ... HACKILY. THIS INTEGRATION CONTAINS FORWARD-INCOMPATIBLE WORKAROUNDS AND DUE TO ITS CONTENT IT SHOULD NOT BE USED BY ANYONE.**

Use caution: this integration uses forward-incompatible workarounds and should be treated as experimental.

- Firebot is designed for a single streaming platform (Twitch), and many core assumptions and functionality are tightly coupled to this design. As a result, full compatibility with Kick is not achievable under the current architecture.

- While I've tried to clearly separate Kick user data from Firebot's built-in databases, there's a risk of data leakage or corruption. This could impair or disable your Firebot instance entirely. Always maintain reliable backups.

- Kick's public API is currently limited and incomplete. Only a small set of events is supported. (Note: Some bots use private APIs, but I purposefully avoided that route to reduce brittleness.)

- Some features of this integration depends upon Kick's undocumented "pusher" WebSocket service, but that could break without warning.

- Firebot only responds to events once a Kick notification is received. From time to time, Kick webhook delivery has proven to be unreliable, with notifications delayed by seconds or even minutes or sometimes dropped entirely.

## Introduction

This [Firebot](https://firebot.app) integration provides chat feed integration, events and effects for the [kick.com](https://kick.com) streaming platform. This allows you to handle events in Firebot from the Kick platform, such as chat messages, follows, subscriptions, hosts, and more. This also provides effects to send messages to Kick, change the title or category of your stream, and ban and unban users.

## Version Requirements

- **Versions 0.10.0 and higher** require Firebot 5.65 and a compatible version of [firebot-mage-platform-lib](https://github.com/TheStaticMage/firebot-mage-platform-lib/)
- **Version 0.7.0 and higher** require Firebot 5.65

### Effects

_Effects are calls to the Kick API made by Firebot as a result of event handlers, preset effect lists, quick actions, and the like._

| Effect | Supported | Min. Version | Notes |
| ------ | --------- | ----- | ----- |
| Ban/Unban viewer | :white_check_mark: | | |
| Channel reward: Enable / disable | :white_check_mark: | 0.9.0 | |
| Channel reward: Manage / unmanage | :white_check_mark: | 0.9.0 | Also cost, queue, enabled/disabled |
| Chat (send message) | :white_check_mark: | | Can chat as streamer or second "bot" account |
| Delete message | :white_check_mark: | 0.8.0 | |
| Stream category change | :white_check_mark: | | |
| Stream title change | :white_check_mark: | | |
| Timeout viewer | :white_check_mark: | | Unban the viewer to un-timeout |

Note: The integration currently has effects for all of the operations available via Kick's Public API. Any effects "missing" from this list cannot be added unless and until the Kick API is expanded with more functionality. See [Limitations due to Kick](#limitations-due-to-kick).

### Events

| Event | Supported? | Min. Version | Notes |
| ----- | ---------- | ----- | ----- |
| Channel data updated | :white_check_mark: | | Periodic refresh of info from public Kick API |
| Channel points redeemed | :white_check_mark: | 0.9.0 | |
| Chat account age restriction | Possible | | No public API support |
| Chat cleared | Possible | | No public API support |
| Chat emote only mode on/off | Possible | | No public API support |
| Chat followers only mode on/off | Possible | | No public API support |
| Chat message (incoming) | :white_check_mark: | | |
| Chat slow mode on/off | Possible | | No public API support |
| Chat sub only mode on/off | Possible | | No public API support |
| Follow | :white_check_mark: | | |
| Goal created | Possible | | No public API support |
| Goal ended | ? | | No public API support, have not evaluated |
| Goal progress | ? | | No public API support, have not evaluated |
| Goal updated | Possible | | No public API support |
| Host (raid) (incoming) | :white_check_mark: | | Uses "pusher" due to no public API support |
| Host (raid) (outgoing) | :white_check_mark: | | Uses "pusher" due to no public API support |
| Kicks (like bits) | :white_check_mark: | | |
| Message deleted | :white_check_mark: | 0.8.0 | |
| Message pinned | Possible | | No public API support |
| Message un-pinned | Possible | | No public API support |
| Stream category (game) updated | :white_check_mark: | | |
| Stream ended | :white_check_mark: | | |
| Stream started | :white_check_mark: | | |
| Stream title updated | :white_check_mark: | | |
| Sub | :white_check_mark: | | |
| Sub (Community Gifted) | :white_check_mark: | | |
| Sub (Gifted) | :white_check_mark: | | |
| Viewer arrived | :white_check_mark: | | |
| Viewer banned | :white_check_mark: | | |
| Viewer timed out | :white_check_mark: | | |
| Viewer unbanned | :white_check_mark: | | Uses "pusher" due to no public API support; also handles un-timeout |

"Possible" indicates that based on documentation and/or actual testing, the Kick API or Pusher websocket sends a webhook or websocket message that the author believes can be used to trigger a Firebot event. However, since the author is unlikely to use this event himself, it is not currently prioritized for implementation. Feel free to reach out in Discord or a GitHub issue if you need something.

### Firebot features

| Feature | Support Status | Min. Version | Notes |
| ------- | -------------- | ----- | ----- |
| Channel point rewards: Create/manage | :white_check_mark: | 0.9.0 | Accessible properties limited |
| Channel point rewards: Enable/disable | :white_check_mark: | 0.9.0 | Enable/disable only |
| Channel point rewards: Redemption triggers effects | :white_check_mark: | 0.9.0 | Full support |
| Chat feed: Ban user (on Kick message) | :white_check_mark: | | Works via context menu and `/ban` command |
| Chat feed: Delete Kick messages | :white_check_mark: | 0.8.0 | Works! |
| Chat feed: Display Kick messages | :white_check_mark: | | Works! Shows badges and emotes too |
| Chat feed: Timeout user | :white_check_mark: | | Works via context menu and `/timeout` command |
| Chat feed: Unban user | :white_check_mark: | | Works via `/unban` and `/untimeout` commands |
| Chat feed: User profile | :x: | | Firebot assumes all users are Twitch users &#x1F525; |
| Chat feed: All other context menu items | :x: | | Various limitations &#x1F1F0; &#x1F525; |
| Commands | :white_check_mark: | | Cooldowns do not work &#x1F525; |
| Currency | :x: | | Firebot assumes all users are Twitch users &#x1F525; |
| Currency: Watch time | :x: | | No viewer list API endpoint on Kick &#x1F1F0; |
| Moderation: Banned words / URLs | ? | | Maybe possible now that Kick API supports deleting messages? |
| Ranks | :x: | | Pointless without proper currency support |
| Roles | :white_check_mark: | | Twitch role filters emulated in platform-aware filter |
| Viewer database | :x: | | Firebot assumes all users are Twitch users &#x1F525; |

&#x1F1F0; = Denotes that the feature cannot be fully supported due to [Kick limitations](#limitations-due-to-kick)

&#x1F525; = Denotes that the feature cannot be fully supported due to [Firebot limitations](#limitations-due-to-firebot)

### Limitations due to Kick

- Many user actions (e.g. raids, unbans) don't trigger webhooks. The integration can only support events that Kick provides.
- Kick delivers profile image URLs that only resolve from kick.com, so these images may not display correctly elsewhere.
- Kick's public API is lacking basic chat management options (e.g. delete message, clear chat), so we cannot implement these in Firebot's chat feed.
- There is currently no API for fetching the viewer list, which prevents watch-time tracking and currency accrual.
- There is currently no API to list your followers, subscribers, VIPs, moderators, etc. This limits what can be practically achieved with roles.
- Channel point redemptions can now be managed programmatically via API, but there is no API support for approving or rejecting rewards.
- Channel point redemption properties are limited: name, description, cost, queued, and enabled/disabled. There's no ability to set icons.
- Kick does not provide programmatic definitions of chat badges (or even publish these as plain image files). We've hard-coded in the current definitions in the Firebot chat feed. If those change on Kick, you'll still see the old badges in the Firebot chat feed until the integration is updated.
- Configuration of the "pusher" websocket requires your channel ID and chatroom ID, which are different from your user ID. The process to determine these can be tedious. Thankfully, you'll only need to do this once.

### Limitations due to Firebot

- Firebot's viewer database uses Twitch user IDs as primary keys and assumes every user is from Twitch. This rigid design prevents many features that depend on storing information about users (e.g. currency, metadata).
- Rate limiting (cooldowns) for commands and redeems doesn't work natively. Consider using the [Firebot Rate Limiter](https://github.com/TheStaticMage/firebot-rate-limiter) if needed.
- Firebot 5.64 and earlier do not allow standard variables like `$moderator` and `$chatMessage` to work with Kick events. Use Kick-specific aliases instead (e.g. `$kickModerator`, `$kickChatMessage`). Firebot 5.65 and higher with version 0.7.0 or higher of the integration provides full variable support for Kick events.
- Slash commands in the Firebot chat (e.g. `/clear`) only apply to Twitch. (There aren't Kick API endpoints for most of these anyway.)
- You won't be able to add a Kick user to a custom role via the Firebot GUI, because Firebot does a Twitch lookup on whatever you type. It is, however, possible to have events add Kick users to custom roles. You can remove Kick users from custom roles through the GUI.

## Installation

This integration is experimental and aimed at users comfortable with technical setup. I will reconsider broader release and support once:

1. Kick offers a public WebSocket connection option, and
2. Kick's public REST API is substantially more complete, and
3. Firebot evolves for cleaner multi-platform support.

[Installation instructions](/doc/installation.md) are available if you're feeling adventurous.

[Upgrading instructions](/doc/upgrading.md) are available if you felt adventurous in the past and are still feeling adventurous.

[Configuration instructions](/doc/configuration.md) are available if ... well, you get the point.

## Support

**Again: This project is not associated with or supported by Firebot or Kick.com.**

There is no official support available. Using this may jeopardize Firebot's stability or future upgrades. Always maintain reliable backups.

[Troubleshooting guide](/doc/troubleshooting.md)

## Contributions

Contributions are welcome via [Pull Requests](https://github.com/TheStaticMage/firebot-mage-kick-integration/pulls). I _strongly suggest_ that you contact me before making significant changes, because I'd feel really bad if you spent a lot of time working on something that is not consistent with my vision for the project. Please refer to the [Contribution Guidelines](/.github/contributing.md) for specifics.

Join our Discord community in [The Static Family](https://discord.gg/hzDYKzG9Zp) and head to the `#firebot-mage-kick-integration` channel to discuss.

Please note:

- I will not accept contributions relying on Kick's "private API." I'd rather just encourage you to stream on Twitch than provide fragile workarounds if you depend on certain functionality.
- I will not accept contributions requiring Firebot modifications that haven't been upstream-approved. I run a customized version of Firebot based on the `v5` branch, so changes that are merged there (or are in developer-approved pull requests) are acceptable.
- At this point Firebot 5.65 is a minimum version for all new development.
- If you don't agree with this approach, feel free to fork the project and develop it your way.

## License

This project is released under the [GNU General Public License version 3](/LICENSE).

Some code in this project is based on (or copied from) [Firebot](https://github.com/crowbartools/firebot), which is licensed under the GNU GPL 3 as well. Since the source code is distributed here and links back to Firebot, this project complies with the license.

# Firebot Kick Integration

## Disclaimer and Warning

**ALL DATA STRUCTURES AND EVENTS IN THIS INTEGRATION -- EVEN THOSE THAT SEEM TO MAP CLEANLY -- ARE TOTAL HACKS. ALL EVENTS ARE IMPLEMENTED ... HACKILY. THIS INTEGRATION CONTAINS FORWARD-INCOMPATIBLE WORKAROUNDS AND DUE TO ITS CONTENT IT SHOULD NOT BE USED BY ANYONE.**

**THIS IS NOT ASSOCIATED WITH FIREBOT AND IS NOT ENDORSED OR SUPPORTED BY THEIR DEVELOPERS OR ANYONE ELSE.**

Seriously though:

- The current design of Firebot is to support exactly one streaming platform (Twitch). There are assumptions in the deepest parts of the code that reflect this. There is a lot of Firebot functionality that can only be partially implemented or not implemented at all due to these limitations. (There are stated plans for Firebot to support multiple platforms in their version 6 release, but there's no published timeframe for this release that I am aware of.)

- Although I have done my best to keep the Kick user data distinguished from the built-in Firebot user databases, it's still possible that Kick user information could "leak" into Firebot's data structures. If this happens, it could cause Firebot to malfunction or stop working entirely. It may or may not be possible to clean up any such corruption. Therefore, you should make sure that your backups are working and that you're saving lots and lots of backups in case this kind of corruption were to occur.

- The current state of Kick's public API is ... incomplete (and that's putting it charitably). Their public API supports [only a small set of events](https://docs.kick.com/events/event-types) and is missing even the most basic functionality. This integration uses the "pusher" websocket to capture additional events, but this is not officially documented and could stop working at any time. (Note that some bots that integrate Kick now rely on a "private API" that only work by pretending they are legitimate web browsers to sneak around Kick's web application firewall. That's even more prone to breakage or removal, so I do not intend to use these "private" APIs in this project.)

- For full functionality (including to receive "follow" events), this requires an [webhook proxy server](/server) to receive webhooks that must be sent to a server on the internet. I have written such a server and provide instructions to deploy it on Render. If you don't want to set up such a server yourself, there is also an option to create a Kick app and enter its ID and secret into Firebot, which will enable some events. However, certain events (notably follows) are only sent by webhook, and are therefore only available if you use a webhook proxy.

- Firebot does not know that something happened until it receives a notification from Kick. Unfortunately, webhooks from Kick (especially for chat messages) tend to be delayed by seconds or minutes quite frequently. Until Kick improves the reliability of their webhooks, you (and every other user of any other bot or website) may experience this lag.

## Introduction

This [Firebot](https://firebot.app) integration provides events and effects for the [kick.com](https://kick.com) streaming platform.

Currently supported:

- Kick messages are added to Firebot chat feed (Dashboard)
  - Emote display work correctly
  - It displays Kick username as author of message
  - It displays Kick icon as the user's profile image
- Commands
  - Commands generally work
  - Restrictions for commands generally work
  - A custom restriction is shipped with this integration (platform)
- Conditions
  - Platform
- Effects
  - Chat message (Kick)
  - Chat message (Platform aware)
  - Set stream game
  - Set stream title
  - Trigger Custom Channel Reward Handler
- Events
  - Channel data updated
  - Channel points redeemed
  - Chat message
  - Follow
  - Stream started
  - Stream ended
  - Viewer arrived
  - Viewer banned
  - Viewer timed out
- Filters
  - Platform filter
- Variables
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

Things that are not supported now but should be possible:

- Events for subs (renewal, gift, first time)
- Event for livestream metadata updated (i.e. game or title change)
- Events for unban and untimeout
- Ban user, unban user, time out user, un-time out user actions
- Some chat roles

Limitations due to Kick:

- Many actions on Kick do not generate webhooks and therefore cannot generate Firebot events. Some of these events are available via the "pusher" websocket, but these are undocumented so we do not have a full list at this time. Common things that you might expect to be supported but that currently aren't available via web hooks include channel rewards, hosts (raids), and users being unbanned or un-timed out.

- Kick user profile images are broken. This is because the Kick API returns URLs that cannot be accessed from anywhere other than the kick.com website. (Kick needs to fix this. Once they do, this integration can work properly.)

- Kick does not have an API endpoint to get the current viewer list or any other similar functionality to determine when users are present in your stream. That means there can be no accural of currency or tracking of watch time for Kick users.

- Kick channel point redeems cannot be created, deleted, approved, or rejected via the API. Therefore, it's not possible to have Firebot approve or reject awards via its API, to push existing custom rewards to Kick, or the like. In addition, Kick channel point redeems cannot be disabled or paused at all.

Limitations due to Firebot:

- Firebot's main viewer database uses the user id from Twitch as its primary key, and has assumptions throughout the entire program that any user in the viewer database is a user on Twitch. Until there is a fundamental design change in Firebot to support multiple platforms, this will always limit the functionality of this integration and may cause strange ripple effects throughout the program.

- Actions on chat feed messages (e.g. delete, ban user, etc.) will either do nothing or possibly error out when used on Kick messages. These are hard-coded within Firebot to assume the user or message is on Twitch.

- Cooldowns do not work because Firebot does not expose the "cooldown manager" to scripts. This means there are no cooldowns on channel point redeems, commands, etc. (You could use my [Firebot rate limiter](https://github.com/TheStaticMage/firebot-rate-limiter) instead.)

- Effects and variables defined by Firebot that pertain to events from Twitch are often hard-coded for only those events. This means, for example, that the `$moderator` variable is not available to the Kick integration, even though the event metadata is the same. For this reason, this integration adds variables like `$kickModerator` for your Kick event handlers. Alternatively, you can choose to trigger the equivalent Twitch events for each Kick event, provided that you update all of your effects to be platform-aware.

- The user experience for getting the Kick authorization URL is not great because there's not a feasible way (that I found) to present a modal with a clickable URL or have Firebot open a browser window from a script. Kick's authentication uses a mechanism that Firebot's built in oauth provider does not currently support and I do not want to distribute my bot's client secret to anyone running Firebot who wants to connect to it. Fortunately, you should only have to go through this once.

- Firebot deletes all configuration data for an integration when the integration is unlinked. If you unlink the integration and then exit Firebot without relinking, you'll lose your configuration (webhook URL and preferences). You'll need to reconfigure this under Settings &gt; Integrations. This integration includes a fix to re-write the current settings to the database upon re-linking to try to minimize the impact, and hopefully you won't need to repeatedly link and unlink the integration.

## Installation

This integration is not yet ready for general consumption and is intended for people who are technically familiar with Firebot. I will reconsider this decision when and if (a) Kick provides publicly available websocket access, and (b) changes in Firebot allow a cleaner integration. Spoiler: I think this will be a while.

If you are particularly brave: [Installation instructions](/doc/installation.md).

## Support

Once again:

**THIS IS NOT ASSOCIATED WITH FIREBOT AND IS NOT ENDORSED OR SUPPORTED BY THEIR DEVELOPERS OR ANYONE ELSE.**

As for support, there is none. In fact, you are risking current and future stability and upgradability of your Firebot setup if you install and use this.

## Contributions

Contributions are welcome via [Pull Requests](https://github.com/TheStaticMage/firebot-mage-kick-integration/pulls). I _strongly suggest_ that you contact me before making significant changes, because I'd feel really bad if you spent a lot of time working on something that is not consistent with my vision for the project. Please refer to the [Contribution Guidelines](/.github/contributing.md) for specifics.

If you would like to discuss this project with the author, join [The Static Family](https://discord.gg/hzDYKzG9Zp) Discord and head to the `#firebot-mage-kick-integration` channel.

Please note:

- I will not accept contributions that add functionality via Kick's "private API". I am the guy that wants to eat dinner at a steakhouse, finds the restaurant's online reservation system to be broken, and orders pizza instead out of principle. Kick is inexplicably making scant investments in their developer community despite being in catch-up mode. I will simply advise you to stream on Twitch rather than to help enable Kick's lack of investment via fragile workarounds.

- I am also not interested in contributions that require modifications to Firebot that have not been accepted by their developers. (I run Firebot on the [v5 branch](https://github.com/crowbartools/Firebot/tree/v5) so anything that is merged there, or in a Dev-approved pull request, is fair game.)

- The beauty of open source is that if you don't agree with my philosophy, you can create your own fork and develop it as you see fit.

## License

This project is released under the [GNU General Public License version 3](/LICENSE).

Some code in this project is based on (or copied from) [Firebot](https://github.com/crowbartools/firebot), which is licensed under the GNU GPL 3 as well. Since the source code is distributed here and links back to Firebot, this project complies with the license.

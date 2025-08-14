# Firebot Kick Integration

## Disclaimer and Warning

**ALL DATA STRUCTURES AND EVENTS IN THIS INTEGRATION -- EVEN THOSE THAT SEEM TO MAP CLEANLY -- ARE TOTAL HACKS. ALL EVENTS ARE IMPLEMENTED ... HACKILY. THIS INTEGRATION CONTAINS FORWARD-INCOMPATIBLE WORKAROUNDS AND DUE TO ITS CONTENT IT SHOULD NOT BE USED BY ANYONE.**

**THIS IS NOT ASSOCIATED WITH FIREBOT AND IS NOT ENDORSED OR SUPPORTED BY THEIR DEVELOPERS OR ANYONE ELSE.**

Seriously though:

- The current design of Firebot is to support exactly one streaming platform (the Purple one) and there are assumptions in the deepest parts of the code that reflect this. (There are stated plans to support multiple platforms in their version 6 release, but no published timeframe for this release that I am aware of.)

- By default, this integration does not store user data between sessions (e.g. currency, chat message counts). If you enable the "dangerous" option to store Kick users in the user database, this will almost certainly not be compatible with Firebot's eventual implementation of multi-platform support. At best this data will not be importable -- at worst, it will do enough damage that you won't be able to upgrade at all.

- The current state of Kick's public API is ... incomplete (and that's putting it charitably). Their public API supports [only a small set of events](https://docs.kick.com/events/event-types) and is missing basic functionality. Some bots that integrate Kick now rely on a "private API" that only work by pretending they are legitimate web browsers to sneak around Kick's web application firewall. I do not intend to use these "private" APIs in this project.

- This currently requires an [external server](/server) to receive webhooks that must be sent to a server on the internet. I have written a server and provide instructions to deploy my "webhook proxy" on Render. This server also supports more seamless authentication for the public API. (I may make this optional in the future by allowing each user to register their own Kick app and providing the client ID and secret in the configuration.)

## Introduction

This [Firebot](https://firebot.app) integration provides events and effects for the [kick.com](https://kick.com) streaming platform.

Currently supported:

- Kick messages added to Firebot chat feed (Dashboard)
  - Emote display works
  - Displays Kick username as author of message
  - Displays Kick icon as the user's profile image in the dashboard
- Commands
  - Commands generally work
  - Restrictions for commands generally work
  - A custom restriction is shipped with this integration (trigger platform)
- Events
  - Chat message
  - Follow
  - Stream started
  - Stream ended
  - Viewer arrived
  - Viewer banned
  - Viewer timed out
- Effects
  - Chat message (Kick)
  - Chat message (Platform aware)
  - Set stream game
  - Set stream title
- Variables
  - `$kickCategory` (`$kickCategory`) for your channel or another channel
  - `$kickCategoryId` (`$kickGameId`) for your channel or another channel
  - `$kickCategoryImageUrl` for your channel or another channel
  - `$kickChatMessage`
  - `$kickCurrentViewerCount` for your channel or another channel
  - `$kickModerator` (for bans)
  - `$kickModReason` (for bans)
  - `$kickStreamer`
  - `$kickStreamerId`
  - `$kickStreamIsLive` for your channel or another channel
  - `$kickStreamTitle` for your channel or another channel
  - `$kickTimeoutDuration` (in seconds)
  - `$kickUptime` for your channel or another channel
  - `$kickUserDisplayName`

Things that are not supported now but should be possible:

- Events for subs (renewal, gift, first time)
- Event for livestream metadata updated (i.e. game or title change)
- Events for unban and untimeout
- Ban user, unban user, time out user, un-time out user actions
- Channel point redeems (TBD)
- Some chat roles

Limitations due to Kick:

- Many actions on Kick do not generate webhooks and therefore cannot generate Firebot events. Some of these events are available via the "pusher" websocket, but these are undocumented so we do not have a full list at this time. Common things that you might expect to be supported but that currently aren't available via web hooks include channel rewards, hosts (raids), and users being unbanned or un-timed out.

- Kick user profile images are broken. This is because the Kick API returns URLs that cannot be accessed from anywhere other than the kick.com website. (Kick needs to fix this. Once they do, this integration can work properly.)

- Kick does not have an API endpoint to get the current viewer list or any other similar functionality to determine when users are present in your stream. That means there can be no accural of currency or tracking of watch time for Kick users.

Limitations due to Firebot:

- Firebot's viewer database uses the user id from the Purple site as its primary key, and has assumptions throughout the entire program that any user in the viewer database is a user on the Purple site. Until there is a fundamental design change in Firebot to support multiple platforms, this will always limit the functionality of this integration and may cause strange ripple effects throughout the program.

- Kick user data is not stored between Firebot sessions, making it rather pointless to track currency, chat messages, and the like. (It is possible to enable the "dangerous" option to store Kick user data in the user database, but this causes various incompatibilities throughout Firebot and as such it is strongly discouraged.)

- The user experience for getting the Kick authorization URL is not great because there's not a feasible way (that I found) to present a modal with a clickable URL or have Firebot open a browser window from a script. (Kick's authentication uses a mechanism that Firebot's built in oauth provider does not currently support and I do not want to distribute my bot's client secret to anyone running Firebot who wants to connect to it.)

- Actions on chat feed messages (e.g. delete, ban user, etc.) will either do nothing or possibly error out when used on Kick messages. These are hard-coded within Firebot to assume the user or message is on the Purple site.

- Cooldowns on commands do not work because Firebot does not expose the "cooldown manager" to scripts.

- Effects and variables defined by Firebot that pertain to events from the Purple site are often hard-coded for only those events. This means, for example, that the `$moderator` variable is not available to the Kick integration, even though the event metadata is the same. For this reason, this integration adds variables like `$kickModerator`. However, you'll need to have separate handlers for all of these.

- Firebot deletes all configuration data for an integration when the integration is unlinked. If you unlink the integration and then exit Firebot without relinking, you'll lose your configuration (webhook URL and preferences). You'll need to reconfigure this under Settings &gt; Integrations. (This integration includes a fix to re-write the current settings to the database upon re-linking to try to minimize the impact.)

## Installation

This integration is not yet ready for general consumption and is intended for people who are technically familiar with Firebot. I am not supplying user-friendly installation instructions at this time because of the complicated dependencies (notably, the [webhook proxy](/server)) and the numerous risks and limitations of this integration. I will reconsider this decision when and if (a) Kick provides publicly available websocket access, and (b) changes in Firebot allow a cleaner integration. Spoiler: I think this will be a while.

For those who know what they're doing: this works like any other Firebot startup script. (If you don't know what that means, you should definitely NOT be installing this.)

## Support

Once again:

**THIS IS NOT ASSOCIATED WITH FIREBOT AND IS NOT ENDORSED OR SUPPORTED BY THEIR DEVELOPERS OR ANYONE ELSE.**

As for support, there is none. In fact, you are risking current and future stability and upgradability of your Firebot setup if you install and use this.

## Contributions

I will not accept contributions that add functionality via Kick's "private API". I am the guy that wants to eat dinner at a steakhouse, finds the restaurant's online reservation system to be broken, and orders pizza instead out of principle. Kick is inexplicably making scant investments in their developer community despite being in catch-up mode. I would rather advise you to continue streaming on the Purple site than to help enable Kick's lack of investment via fragile workarounds.

I am also not interested in contributions that require modifications to Firebot that have not been accepted by their developers. I run Firebot on the [v5 branch](https://github.com/crowbartools/Firebot/tree/v5) so anything that is merged there, or in a Dev-approved pull request, is fair game.

Feel free to fork the project and add either of the above to your own fork if you're so inclined. The [license](/LICENSE) lets you do that!

If you'd like to submit other contributions, feel free to open a Pull Request.

If you would like to discuss this project with the author, join [The Static Family](https://discord.gg/hzDYKzG9Zp) Discord and head to the `#firebot-mage-kick-integration` channel.

## License

This project is released under the [GNU General Public License version 3](/LICENSE).

Some code in this project is based on (or copied from) [Firebot](https://github.com/crowbartools/firebot), which is licensed under the GNU GPL 3 as well. Since the source code is distributed here and links back to Firebot, this project complies with the license.

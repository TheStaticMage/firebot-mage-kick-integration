# Installation

## Disclaimer and Warning

**ALL DATA STRUCTURES AND EVENTS IN THIS INTEGRATION -- EVEN THOSE THAT SEEM TO MAP CLEANLY -- ARE TOTAL HACKS. ALL EVENTS ARE IMPLEMENTED ... HACKILY. THIS INTEGRATION CONTAINS FORWARD-INCOMPATIBLE WORKAROUNDS AND DUE TO ITS CONTENT IT SHOULD NOT BE USED BY ANYONE.**

**THIS IS NOT ASSOCIATED WITH FIREBOT AND IS NOT ENDORSED OR SUPPORTED BY THEIR DEVELOPERS OR ANYONE ELSE.**

## Version Requirements

- **Version 0.7.0 and higher** require Firebot 5.65
- **Version 0.6.2 and lower** require Firebot 5.64

If you have Firebot 5.64, use version 0.6.2 of this integration. If you have Firebot 5.65 or higher, use version 0.7.0 or higher.

## Kick Integration Setup

You have these choices for how this integration will receive events from Kick's servers. Choose exactly one.

- You can use someone else's **Webhook Proxy** (if you'll find someone who will let you). If someone else has set up a webhook proxy and added you as a user, you just need the URL to that proxy.

- You can run a **Webhook Proxy** yourself. This allows full functionality but is more complicated technically because you need to establish a server on the internet to receive webhooks from Kick. See [Webhook Proxy for Kick](/server/) if you are setting this up yourself.

- You can connect to Kick from Firebot without setting up a server on the internet to receive webhooks. This is much easier to do technically and will support most events including chat. However, the full Kick public API is not available, and in particular, "follow" events will not be triggered with this configuration. [Create a Kick app for local Firebot only](/doc/kick-app.md)

## Determining your channel and chatroom IDs

Kick assigns each user 3 IDs: a user ID, a channel ID, and a chat room ID. For whatever reason, all of these are different. Your user ID can be determined automatically by the integration when you log in. However, you need to determine your channel ID and chatroom ID while logged in to the website.

Here's how to do it:

1. Go to <https://kick.com> and log in.

2. Navigate to your channel (the chat needs to be visible).

3. Toggle on Developer Tools in your browser. This is often achieved via a hot key such as F12 or Control+Shift+I, by right-clicking somewhere on the page and choosing Inspect, or by selecting an option from one of your browser's menus. (Ask Google how to do this for your particular browser if you still need help.)

4. Select the Network tab in the developer tools.

5. There should now be an option for types (All, HTML, CSS, ...). On this list there should be one called `ws` or `websocket`. Select that one, and de-select any others.

6. Reload the page.

7. In the developer tools, there should now be a connection for the Domain `ws-us2.pusher.com`. Click on this connection.

8. This should bring up a frame where you can select what to view (Headers, Cookies, Request, Response, ...). Select `Response`.

9. You will now see a list of websocket events. At the beginning of the list, look for events that start with `{"event":"pusher:subscribe",...}`. Click through these events until you find each of the following:

    - `channel: "channel_########"`  <-- The numbers are your channel ID
    - `channel: "chatroom_########"` <-- The numbers are your chatroom ID

10. Write down these numbers because you will need them for your configuration. (Fortunately, these numbers do not seem to change over time. If you need to reconfigure the integration in the future, you should not need to repeat this process.)

## Installation: Integration

1. From the latest [Release](https://github.com/TheStaticMage/firebot-mage-kick-integration/releases), download `firebot-mage-kick-integration-<version>.js` into your Firebot scripts directory

    (File &gt; Open Data Folder, then select the "scripts" directory)

    :warning: Be sure you download the file from the releases page, not the source code of the GitHub repository!

2. Enable custom scripts in Firebot (Settings &gt; Scripts) if you have not already done so.

3. Go to Settings &gt; Scripts &gt; Manage Startup Scripts &gt; Add New Script and add the `firebot-mage-kick-integration-<version>.js` script.

    :bulb: For now, it is suggested to leave the script settings at their defaults. You can always come back to change these later.

4. Restart Firebot. (The script will _not_ be loaded until you actually restart Firebot.)

## Configuration: Integration

1. Navigate to Settings &gt; Integrations and look for the integration entitled **MageKickIntegration**.

2. Click the **Configure** button next to MageKickIntegration.

3. Configure the settings as follows:

    - **Connectivity Settings**

      - **Firebot URL**: This will be pre-populated to `http://localhost:7472` and this setting will be correct for most users. If this setting is different for you, it's because you specifically configured something different.

      - **Pusher App Key**: This does not change often and the integration contains the current key. If you experience websocket connection problems, you could revisit step 7 in the [Determining your channel and chatroom IDs](#determining-your-channel-and-chatroom-ids) section. The current app key will be the portion of the "File" entry before the `?`.

      - **Channel ID**: This was determined in the [Determining your channel and chatroom IDs](#determining-your-channel-and-chatroom-ids) section. It will be a number, like 12345678. (Do not include the `channel_` prefix from the websocket event.)

      - **Chatroom ID**: This was determined in the [Determining your channel and chatroom IDs](#determining-your-channel-and-chatroom-ids) section. It will be a number, like 12345678. (Do not include the `chatroom_` prefix from the websocket event.)

    - **Webhook Proxy Settings**

      - **Webhook Proxy URL**: This is the base URL for your [webhook proxy](/server). If you're using someone else's server, they should provide you with the URL. If you installed this on Render, the URL will look like: `https://your-render-service-name-here.onrender.com`.

        _Leave this setting blank if you are using a client ID and secret from your own Kick app._

    - **Kick App Settings**

      - **Client ID**: Copy the client ID from the [Kick app](/doc/kick-app.md) that you created. _Leave this setting blank if you are using a webhook proxy._

      - **Client Secret**: Copy the client secret from the [Kick app](/doc/kick-app.md) that you created.  _Leave this setting blank if you are using a webhook proxy._

    - **Accounts**

      _We will come back very soon and authorize the accounts. Just skip this for now while you review the rest of the settings._

    - **Chat Settings**

      - **Chat Feed**: If checked (default), chat messages on Kick will be added to the Firebot chat feed, shown when you click on DASHBOARD in Firebot. Don't worry, this will not forward these messages to Twitch, add them to any on-screen chat overlay, etc. The [Twitch Simulcasting FAQ](https://help.twitch.tv/s/article/simulcasting-guidelines?language=en_US) explicitly notes that it's fine for you to use a tool that combines Twitch and Kick activity for your own use so long as you do not show it on stream:

        > Can I use third-party tools that combine activity from other platforms or services such as chat if I am just using them for my personal usage?
        >
        > Yes, you are free to use tools that are for your personal use. The prohibition on third-party tools only applies to content presented to viewers either on or off Twitch.

      - **Send Your Chat Feed Messages to Kick**: If checked, messages that you type in the box at the bottom of Firebot's chat feed will also be sent to Kick. (Note that any messages you type in that box are automatically sent to Twitch, and there's no way to turn that off. Also, any "slash commands" (e.g. `/clear`) are only sent to Twitch.)

    - **Trigger Twitch Events**

        In short: with great power comes great responsibility. **If you do not know exactly what you are doing, or you are not careful about validating your effect lists for both platforms, then you should NOT use these options!**

        Checking any of these boxes will trigger the Firebot Twitch event corresponding to the Kick event. For example, if you check the box for "Chat Message" in this section, then whenever a message is posted in your Kick chat, both the "Chat Message (Kick)" and the "Chat Message (Twitch)" events will be triggered in Firebot. You could then put all of the logic in the "Chat Message (Twitch)" event and not need to duplicate all of that logic in the "Chat Message (Kick)" event.

        This can help reduce the amount of repetitive code if you are doing the same things in your Kick and Twitch handlers. In addition, you can check the `$platform` variable in any conditional effects: it will always be set to `kick` for events originating from Kick.

        Note that another way to do this is to define a preset effect list. For example, you could add a preset effect list for "Handle Chat Message" and call that preset effect list from both the "Chat Message (Kick)" and the "Chat Message (Twitch)" events. If you set things up that way, then you do not need to check the boxes in this section.

        :warning: **CAUTION**: If you intend to have a combined event handler, be sure that you have thoroughly reviewed the effects it triggers. For example:

        - Are you using the default "Chat" effect built into Firebot to send a response? This will always send the message to Twitch, even if you're trying to reply to a message posted on Kick! (You probably need to convert this to the "Chat (Platform Aware)" effect distributed with this integration.)

        - Are you adding or removing VIP or moderator status from a user, banning a user, timing out a user, etc., as a result of an event? If the event comes in via Kick, this may have unexpected results when the API calls are sent to Twitch because the User IDs will be different.

        - Are you using the "Chat Message" event to route messages to a chat overlay, such as with the [Mage Onscreen Chat](https://github.com/TheStaticMage/firebot-mage-onscreen-chat) overlay? If so, you might be running afoul of the Twitch terms of service by merging chat messages from multiple platforms on your stream.

        :warning: **CAUTION**: If you intend to have a combined event handler, be sure that you have thoroughly reviewed the variables being used. Here is a partial list of common gotchas:

        - The `$chatMessage` variable only works for Twitch chat messages. Use `$kickChatMessage` for Kick chat messages.

        - The `$raidViewerCount` variable only works for Twitch raids, so if you are handling a Kick host, this will evaluate to 0. (You can use `$hostViewerCount` for either platform instead.)

        - The `$userDisplayName` variable only queries Twitch users, so if it's a Kick user, you'll get `[Error]`. (You can use `$platformAwareUserDisplayName[$username]` for either platform instead.)

        Note: Triggering the equivalent Firebot Twitch events is _in addition to_ triggering the Kick events supplied by this integration. (The Kick variants of these events will always be triggered, whether or not you have the box checked to trigger the equivalent Twitch event.)

    - **Logging Settings**

        If you are developing or troubleshooting the integration, enabling additional logging events may help.

        These messages are logged at the "debug" level. For this to be useful, you also need to have debug logging enabled in the global settings for Firebot (Settings &lt; Advanced &lt; Enable Debug Mode and then restart Firebot).

    - **Advanced Settings**

        YOU SHOULD **NOT** ENABLE ANY OF THESE SETTINGS UNLESS YOU KNOW EXACTLY WHAT YOU ARE DOING.

        THE DEVELOPER OF THIS INTEGRATION DOES NOT EVEN HAVE THESE ENABLED ON HIS OWN PRODUCTION FIREBOT INSTANCE!

4. Click **Save** when you're done. (Save your settings before you proceed to the authentication steps.)

## Authentication of Streamer

**Prerequisite:** If you are using the webhook proxy, you must add an entry into the user data file in the format `uuid:username` (using a [UUIDv4](https://www.uuidgenerator.net/version4) and entering the username in lower case). If you are using someone else's webhook proxy, contact the server administrator with the username you wish to authorize as the streamer.

You will authenticate to Kick using your browser, which will grant a token to the application. This uses a technology called [OAuth](https://docs.kick.com/getting-started/generating-tokens-oauth2-flow) which ensures that your Kick password is never needed by the Firebot integration.

1. Log in to Kick as the streamer account in your browser.

2. In Firebot, click the **Kick Accounts** link to open the account authorization UI.

3. In the "Streamer Connection" section, click the **Authorize Streamer** button.

4. A modal dialog will appear with an authorization link and instructions.

5. Click the **Copy Link** button in the modal dialog to copy the authorization link to your clipboard.

6. Paste the authorization link into your browser's address bar and press Enter.

7. You will be redirected to a screen on Kick's website that prompts you to authorize the application. Click the **Allow Access** button.

8. If everything works as it should, you should see this message in your browser after a few seconds:

    > Kick integration authorized for streamer! You can close this tab.

   The modal dialog in Firebot will also automatically close when authorization is complete.

## Authentication of Bot

You may _optionally_ choose to have Firebot post chat messages as a separate Kick user, which we will call your "bot." (If you do not configure a separate bot user, chat messages will always be posted as the streamer.)

**Prerequisite:** If you are using the webhook proxy, you must add an entry into the user data file in the format `:username` (that is, a `:` followed by the username in lower case). If you are using someone else's webhook proxy, contact the server administrator with the username you wish to authorize as the bot.

1. Register a separate Kick account for your bot.

2. Log in to Kick as the bot account in your browser. **We recommend using an incognito or private window for this to avoid conflicts with your streamer account.**

3. Click the **Kick Accounts** link to open the account authorization UI.

4. In the "Bot Connection" section, click the **Authorize Bot** button.

5. A modal dialog will appear with an authorization link and instructions.

6. Click the **Copy Link** button in the modal dialog to copy the authorization link to your clipboard.

7. Paste the authorization link into your (incognito) browser window's address bar and press Enter.

8. You will be redirected to a screen on Kick's website that prompts you to authorize the application. Click the **Allow Access** button.

9. If everything works as it should, you should see this message in your browser after a few seconds:

    > Kick integration authorized for bot! You can close this tab.

   The modal dialog in Firebot will also automatically close when authorization is complete.

:bulb: We suggest to make your bot a moderator so it can post URLs and bypass any other restrictions. (Note: this bot account does not attempt to take any "moderator" actions in the channel through Firebot.) You can do this using one of these methods:

- Log in to Kick with the streamer's account and [add the moderator](https://dashboard.kick.com/channel/roles/moderator) under channel roles
- Log in to Kick with the streamer's account, go to your chat, and type `/mod BOTUSERNAME` (filling in the appropriate bot username, of course)

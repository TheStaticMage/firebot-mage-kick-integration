# Installation

## Disclaimer and Warning

**ALL DATA STRUCTURES AND EVENTS IN THIS INTEGRATION -- EVEN THOSE THAT SEEM TO MAP CLEANLY -- ARE TOTAL HACKS. ALL EVENTS ARE IMPLEMENTED ... HACKILY. THIS INTEGRATION CONTAINS FORWARD-INCOMPATIBLE WORKAROUNDS AND DUE TO ITS CONTENT IT SHOULD NOT BE USED BY ANYONE.**

**THIS IS NOT ASSOCIATED WITH FIREBOT AND IS NOT ENDORSED OR SUPPORTED BY THEIR DEVELOPERS OR ANYONE ELSE.**

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

    - **General Settings**

      - **Chat Feed**: If checked (default), chat messages on Kick will be added to the Firebot chat feed, shown when you click on DASHBOARD in Firebot. Don't worry, this will not forward these messages to Twitch, add them to any on-screen chat overlay, etc. The [Twitch Simulcasting FAQ](https://help.twitch.tv/s/article/simulcasting-guidelines?language=en_US) explicitly notes that it's fine for you to use a tool that combines Twitch and Kick activity for your own use so long as you do not show it on stream:

        > Can I use third-party tools that combine activity from other platforms or services such as chat if I am just using them for my personal usage?
        >
        > Yes, you are free to use tools that are for your personal use. The prohibition on third-party tools only applies to content presented to viewers either on or off Twitch.

    - **Trigger Twitch Events**

        In short: with great power comes great responsibility. **If you do not know exactly what you are doing, or you are not careful about validating your effect lists for both platforms, then you should NOT use these options!**

        Checking any of these boxes will trigger the Firebot Twitch event corresponding to the Kick event. For example, if you check the box for "Chat Message" in this section, then whenever a message is posted in your Kick chat, both the "Chat Message (Kick)" and the "Chat Message (Twitch)" events will be triggered in Firebot. You could then put all of the logic in the "Chat Message (Twitch)" event and not need to duplicate all of that logic in the "Chat Message (Kick)" event.

        This can help reduce the amount of repetitive code if you are doing the same things in your Kick and Twitch handlers. In addition, you can check the `$platform` variable in any conditional effects: it will always be set to `kick` for events originating from Kick.

        Note that another way to do this is to define a preset effect list. For example, you could add a preset effect list for "Handle Chat Message" and call that preset effect list from both the "Chat Message (Kick)" and the "Chat Message (Twitch)" events. If you set things up that way, then you do not need to check the boxes in this section.

        :warning: **CAUTION**: If you intend to have a combined event handler, be sure that you have thoroughly reviewed the effects it triggers. For example:

        - Are you using the default "Chat" effect built into Firebot to send a response? This will always send the message to Twitch, even if you're trying to reply to a message posted on Kick! (You probably need to convert this to the "Chat (Platform Aware)" effect distributed with this integration.)

        - Are you using `$userDisplayName[$username]`? The `$userDisplayName` variable only queries Twitch users, so if it's a Kick user, you'll get `[Error]`. (You should use `$platformAwareUserDisplayName[$username]` from this integration instead as it'll work for either.)

        - Are you adding or removing VIP or moderator status from a user, banning a user, timing out a user, etc., as a result of an event? If the event comes in via Kick, this may have unexpected results when the API calls are sent to Twitch because the User IDs will be different.

        - Are you using the "Chat Message" event to route messages to a chat overlay, such as with the [Mage Onscreen Chat](https://github.com/TheStaticMage/firebot-mage-onscreen-chat) overlay? If so, you might be running afoul of the Twitch terms of service by merging chat messages from multiple platforms on your stream.

        Note: Triggering the equivalent Firebot Twitch events is _in addition to_ triggering the Kick events supplied by this integration. (The Kick variants of these events will always be triggered, whether or not you have the box checked to trigger the equivalent Twitch event.)

    - **Logging Settings**

        If you are developing or troubleshooting the integration, enabling additional logging events may help.

        These messages are logged at the "debug" level. For this to be useful, you also need to have debug logging enabled in the global settings for Firebot (Settings &lt; Advanced &lt; Enable Debug Mode and then restart Firebot).

    - **Advanced Settings**

        YOU SHOULD **NOT** ENABLE ANY OF THESE SETTINGS UNLESS YOU KNOW EXACTLY WHAT YOU ARE DOING.

        THE DEVELOPER OF THIS INTEGRATION DOES NOT EVEN HAVE THESE ENABLED ON HIS OWN PRODUCTION FIREBOT INSTANCE!

4. Click **Save** when you're done.

## Authentication

You will authenticate to Kick using your browser, which will grant a token to the application. This uses a technology called [OAuth](https://docs.kick.com/getting-started/generating-tokens-oauth2-flow) which ensures that your Kick password is never needed by the Firebot integration.

1. Navigate to Settings &gt; Integrations and look for the integration entitled **MageKickIntegration**.

2. If there is a button called **Unlink** next to that integration, you have already authenticated. If you want to re-authenticate, you can click this button to disconnect and unlink.

3. Click the **Link** button.

4. This will pop open an info box with a URL. You can copy and paste that URL to your browser. Or you can click here for the default URL:

    [`http://localhost:7472/integrations/firebot-mage-kick-integration/link`](http://localhost:7472/integrations/firebot-mage-kick-integration/link)

    _The integration author apologizes for the awkwardness of this flow. Firebot does not currently expose sufficient resources to script authors to create a dialog box with a clickable link._

5. This will bring you to Kick's website. You may be prompted to log in if you have not already. The screen then prompts you to authorize the application. Click the **Allow Access** button.

6. If everything works as it should, you should see this message in your browser after a few seconds:

    > Kick integration connected successfully! You can close this tab.

    If you get that message, you can indeed close the tab.

7. Back in Firebot, if the Info dialog with the URL is still open, you may close it.

:bulb: When you are done setting up the authentication or if you change any of the settings related to authentication (webhook proxy URL, client ID, client secret), you may need to connect. You can do this via the "Connections" which are accessed in the lower left corner of the Firebot application.

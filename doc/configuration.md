# Configuration

Before you can use this integration, you need to perform the following setup:

1. Determine the Channel and Chatroom IDs for your Kick channel

2. Get the Webhook URL from Firebot

3. Create a Kick App

4. Enter the configuration into Firebot

5. Authenticate the streamer account

6. Optional: authenticate the bot account

7. Connect the integration

## 1) Determine your channel and chatroom IDs

_Note_: This is a one-time process, because these values do not change over time. If you have returned to these configuration instructions to update something else, you do _NOT_ need to repeat this process if you've already done it before.

1. Go to <https://kick.com> and log in.

2. Navigate to your channel (the chat needs to be visible).

3. Toggle on Developer Tools in your browser (F12 or Ctrl+Shift+I).

4. Select the **Network** tab.

5. Filter for **WS** (WebSocket) connections.

6. Reload the page.

7. Click on the connection to `ws-us2.pusher.com`.

8. Select the **Response** (or Messages) tab.

9. Look for the first few messages starting with `{"event":"pusher:subscribe",...}`. Find the ones containing:

    - `channel: "channel_########"`  <-- The numbers are your **Channel ID**
    - `channel: "chatroom_########"` <-- The numbers are your **Chatroom ID**

10. Write these numbers down (just the numbers, not the prefixes).

## 2) Get the Webhook URL from Firebot

1. Click **Kick** in the left menu bar.

2. On the Connections tab, look for the **Webhook Configuration** section and copy the **Webhook URL**. You will need this when creating your Kick App.

## 3) Create a Kick App

1. Go to <https://kick.com/> and log in as the streamer.

2. From the upper right, click your profile image &gt; Settings &gt; Developer.

3. Click **Create new**.

4. Fill out the parameters:

    - **Application Name**: `Firebot` (or `YourNameFirebot`)
    - **App Description**: `Firebot integration`
    - **Redirect URL**: `http://localhost:7472/integrations/firebot-mage-kick-integration/callback`
    - **Enable webhooks**: Checked
    - **Webhook URL**: Paste the Webhook URL you copied from Firebot
    - **Scopes Requested**: Check **ALL** scopes **EXCEPT** "Read stream key". (It is very important to select all the other scopes, otherwise the integration will not work correctly.)

5. Click **Create App**.

6. Copy the application parameters to a safe place (you will need to enter them into Firebot in the next section):

    - **Client ID**
    - **Client Secret**

## 4) Enter the configuration into Firebot

1. Navigate to Settings &gt; Integrations and look for **MageKickIntegration**.

2. Click **Configure**.

3. Configure the connectivity settings (from section 1):

    - **Firebot URL**: `http://localhost:7472` (default)
    - **Pusher App Key**: Leave as default value
    - **Channel ID**: Enter the Channel ID you found earlier
    - **Chatroom ID**: Enter the Chatroom ID you found earlier

4. Enter your Kick App credentials (from section 3):

    - **Kick App Settings**
      - **Client ID**: Enter the Client ID from your Kick App
      - **Client Secret**: Enter the Client Secret from your Kick App

5. Configure the optional chat settings:

    - **Chat Settings**
      - **Chat Feed**: Checked (recommended). Shows Kick chat in Firebot
      - **Send Your Chat Feed Messages to Kick**: Checked (optional)

    - **Trigger Twitch Events**
      - _It's strongly recommended to leave these unchecked during initial setup._

6. Click **Save**.

## 5) Authenticate the streamer account

1. Open a browser window and sign in to Kick as the streamer.

2. In Firebot, click **Kick** in the left menu, and go to the **Accounts** tab.

3. Click **Authorize Streamer**.

4. Copy the link into your browser.

5. Approve the app on Kick.

## 6) Optional: Authenticate the bot account

_If you want to have a separate "bot" account that posts messages on behalf of Firebot, follow this procedure. This is optional. You can come back and set this up later if you don't want to do so now._

1. Create a separate Kick account for your "bot" user. (This is a regular Kick account -- nothing special about it.)

2. Make the bot a moderator for your channel (technically optional, but highly recommended):

    - Log in to Kick with the streamer's account and [add the moderator](https://dashboard.kick.com/channel/roles/moderator) under channel roles
    - OR, log in to Kick with the streamer's account, go to your chat, and type `/mod BOTUSERNAME` (filling in the appropriate bot username, of course)

3. Open an incognito / private browsing window, go to <https://kick.com/> and log in as the bot user.

4. In Firebot, click **Kick** in the left menu, and go to the **Accounts** tab.

5. Click **Authorize Bot**.

6. Copy the link into your browser.

7. Approve the app on Kick.

_Note:_ Kick _pushes_ notifications (webhooks) out when activity occurs, like a follow or a message being posted in chat. A service operated by Crowbar Tools (the Firebot authors) runs on an internet server, listening for webhooks from Kick (and others) and makes that content available to your Firebot instance. This provides webhook receiving capabilities without forcing you to run a server yourself. However, operating these servers costs the Firebot authors actual money, so please consider chipping in with a [donation](https://opencollective.com/crowbartools) if you are able.

## 7) Connect the integration

After completing the above setup, you are now ready to connect Firebot to Kick. Click the "power button" in the lower left corner of Firebot to connect your integrations. (You may need to connect the Kick integration separately by mousing over the globe icon just to the right of the "power button" to find the Kick integration and then enable MageKickIntegration in the connection panel.)

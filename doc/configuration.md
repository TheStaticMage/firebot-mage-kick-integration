# Configuration

Before you can use this integration, you need to perform the following setup:

1. Create a Kick App

2. Determine the Channel and Chatroom IDs for your Kick channel

3. Enter the configuration into Firebot

4. Authenticate the streamer account

5. Optional: authenticate the bot account

6. Enter the Webhook URL into your Kick App configuration

## 1) Create a Kick App

1. Go to <https://kick.com/> and log in as the streamer.

2. From the upper right, click your profile image &gt; Settings &gt; Developer.

3. Click **Create new**.

4. Fill out the parameters:

    - **Application Name**: `Firebot` (or `YourNameFirebot`)
    - **App Description**: `Firebot integration`
    - **Redirect URL**: `http://localhost:7472/integrations/firebot-mage-kick-integration/auth/callback`
    - **Enable webhooks**: Unchecked
    - **Webhook URL**: Leave blank
    - **Scopes Requested**: Check **ALL** scopes **EXCEPT** "Read stream key". (It is very important to select all the other scopes, otherwise the integration will not work correctly.)

5. Click **Create App**.

6. Copy the application parameters to a safe place (you will need them to configure Firebot):

    - **Client ID**
    - **Client Secret**

## 2) Determine your channel and chatroom IDs

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

## 3) Enter the configuration into Firebot

1. Navigate to Settings &gt; Integrations and look for **MageKickIntegration**.

2. Click **Configure**.

3. Configure the settings:

    - **Connectivity Settings**
      - **Firebot URL**: `http://localhost:7472` (default)
      - **Pusher App Key**: Leave as default value
      - **Channel ID**: Enter the Channel ID you found earlier
      - **Chatroom ID**: Enter the Chatroom ID you found earlier

    - **Kick App Settings**
      - **Client ID**: Enter the Client ID from your Kick App
      - **Client Secret**: Enter the Client Secret from your Kick App

    - **Chat Settings**
      - **Chat Feed**: Checked (recommended). Shows Kick chat in Firebot
      - **Send Your Chat Feed Messages to Kick**: Checked (optional)

    - **Trigger Twitch Events**
      - _It's strongly recommended to leave these unchecked during initial setup._

4. Click **Save**.

## 4) Authenticate the streamer account

1. Open a browser window and sign in to Kick as the streamer.

2. In Firebot, click **Kick Accounts** in the left menu.

3. Click **Authorize Streamer**.

4. Copy the link into your browser.

5. Approve the app on Kick.

## 5) Optional: Authenticate the bot account

_If you want to have a separate "bot" account that posts messages on behalf of Firebot, follow this procedure. This is optional. You can come back and set this up later if you don't want to do so now._

1. Create a separate Kick account for your "bot" user. (This is a regular Kick account -- nothing special about it.)

2. Make the bot a moderator for your channel (technically optional, but highly recommended):

    - Log in to Kick with the streamer's account and [add the moderator](https://dashboard.kick.com/channel/roles/moderator) under channel roles
    - OR, log in to Kick with the streamer's account, go to your chat, and type `/mod BOTUSERNAME` (filling in the appropriate bot username, of course)

3. Open an incognito / private browsing window, go to <https://kick.com/> and log in as the bot user.

4. In Firebot, click **Kick Accounts** in the left menu.

5. Click **Authorize Bot**.

6. Copy the link into your browser.

7. Approve the app on Kick.

## 6) Enter the Webhook URL into your Kick App configuration

1. Go to <https://kick.com/> and log in as the streamer.

2. From the upper right, click your profile image &gt; Settings &gt; Developer.

3. Click **View** next to the Kick App you created for Firebot.

4. Click **Edit** to open the settings.

5. Check the box for **Enable webhooks**.

6. Switch over to Firebot and do these steps to get your webhook URL:

    - Click **Kick Accounts** in the left menu.
    - If "Webhook Configuration" appears, click the "Copy URL" button. (If this does not appear, restart Firebot and try again.)
    - Click the **Copy URL** button.

7. Switch back to your browser. Paste the URL into the box under "Enable webhooks."

8. Click **Save changes**.

_Note:_ Kick _pushes_ notifications (webhooks) out when activity occurs, like a follow or a message being posted in chat. A service operated by Crowbar Tools (the Firebot authors) runs on an internet server, listening for webhooks from Kick (and others) and makes that content available to your Firebot instance. This provides webhook receiving capabilities without forcing you to run a server yourself. However, operating these servers costs the Firebot authors actual money, so please consider chipping in with a [donation](https://opencollective.com/crowbartools) if you are able.

# Webhook Proxy for Kick

This is a webhook "proxy" for Kick. This accepts and validates webhooks from Kick, and then allows Firebot to get these via HTTP long polling. No websockets are used.

This design avoids the need for Firebot to know the client secret of your Kick app. That way, if you have any friends that you want to host this for, and they trust that you are not going to steal their tokens, you are able to do so.

## Features

- Provides a stable place on the internet where to receive Kick webhooks
- Firebot integration (at the [root of this repository](/)) seamlessly integrates
- One instance of the webhook proxy can serve multiple users
- Keeps the Kick app's client secret off the Firebot integration
- Individual user UUIDs are handled internally (no copy and paste)
- This app never sees the user's Kick password (OAuth 2.1 flow)
- Optional redis store preserves webhooks across application restart

## Limitations

- User management is clunky
- This app needs to know the users token to be involved in the authorization flow

## Installation

### Create a Kick app

1. Go to <https://kick.com/> and log in as necessary

2. From the upper right, click your profile image &gt; Settings &gt; Developer.

3. Click **Create new**

4. Fill out parameters:

    - Application Name: &gt;Your username&lt;Firebot (no spaces or special characters)
    - App Description: Receive events and make API calls from Firebot
    - Redirect URL: `https://your-render-service-name-here.onrender.com/auth/callback` <- See [Running this on Render](#running-on-render)
    - Enable webhooks: (Enable)
    - URL: `https://your-render-service-name-here.onrender.com/webhook` <- See [Running this on Render](#running-on-render)
    - Scopes Requested:
        - [x] Read user information (including email address)
        - [x] Update channel information
        - [x] Execute moderation actions for moderators
        - [ ] Read stream key
        - [x] Write to Chat feed
        - [x] Read channel information
        - [x] Subscribe to events (read chat feed, follows, subscribes, gifts)

5. Click **Create App**

6. Copy the application parameters:

    - Client ID
    - Client Secret

### Running on Render

I run my copy of this software on [render.com](https://render.com) with this setup:

- Settings
  - Instace type: Starter (0.5 CPU, 512 MB RAM)
  - Root Directory: `server`
  - Build command: `go build -tags netgo -ldflags '-s -w' -o app`
  - Start command: `./app` (Will show as `server/ $ ./app`)
- Environment:
  - `CLIENT_ID`: Your Kick client ID (see [Create a Kick app](#create-a-kick-app))
  - `CLIENT_SECRET`: Your Kick client secret (see [Create a Kick app](#create-a-kick-app))
  - `REDIS_URL`: If set up in Render, paste the Redis URL they provide
- Secret Files:
  - Filename: `users.txt`
  - Content:

    ```text
    00000000-0000-0000-0000-000000000000:yourkickusername
    :yourkickbotusername
    ```

    Note: Generate a real UUID at [uuidgenerator.net](https://www.uuidgenerator.net/) and fill in your actual Kick username.

    Note: If you want to "host" this service for others, create one line per user (with a unique UUID for each).

    Note: A "streamer" account has a UUID. A "bot" account has no UUID.

    Note: You should fork this repository and point Render at your fork. While it is possible to point Render directly at this repository, this means you are subject to my timelines on release and deployment, which could be in the middle of _your_ stream!

**Free tier advisory**: If you use the Render free tier, your service will spin down after a period of inactivity. Firebot's polling should be sufficient to keep your service alive while you're using it, but you might experience delayed or failed webhooks if Kick tries to deliver a webhook while your service is asleep. It will also take Firebot a while to connect at the start while your Render service wakes up -- be sure you leave at least a minute for Firebot to connect when you start it. Kick will also eventually disable any webhook endpoint where it repeatedly fails delivery, which is a possibility with the free tier.

## Support

Join [The Static Family](https://discord.gg/hzDYKzG9Zp) Discord and head to the `#firebot-mage-kick-integration` channel.

## License

This project is released under the [GNU General Public License version 3](/LICENSE).

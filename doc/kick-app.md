# Create a Kick app

## Local Firebot Only

If you are going to use Firebot without the [Webhook Proxy](/server/), follow these instructions:

1. Go to <https://kick.com/> and log in as necessary

2. From the upper right, click your profile image &gt; Settings &gt; Developer.

3. Click **Create new**

4. Fill out parameters:

    - Application Name: &gt;Your username&lt;Firebot (no spaces or special characters)
    - App Description: Firebot access to Kick API
    - Redirect URL: `http://localhost:7472/integrations/firebot-mage-kick-integration/auth/callback`
    - Enable webhooks: (Unchecked)
    - Scopes Requested: Check all except "Read stream key"

5. Click **Create App**

6. Copy the application parameters:

    - Client ID
    - Client Secret

## Convert from Local Firebot Only to Webhook Proxy

If you start with the Local Firebot Only configuration and later want to upgrade to the Webhook Proxy, you can simply reconfigure your existing Kick app. Just go into Kick and edit your existing app, and then configure accordingly. You do not need to create a new app.

[Create a Kick app for webhook proxy](/server/README.md#create-a-kick-app)

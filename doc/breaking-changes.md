# Breaking Changes

## 0.10.0

You must install version 0.0.1 (or higher) of [firebot-mage-platform-lib](https://github.com/TheStaticMage/firebot-mage-platform-lib/) for the Kick integration to function correctly. Going forward, you will need to update the Kick integration and firebot-mage-platform-lib at the same time.

## 0.9.0

:warning: **These are significant changes that will take most users at least 30 minutes of work to configure fully. Be sure you allocate sufficient time for setup and testing before installing this version of the plugin!**

### Webhook Proxy Retirement

The integration now relies on Firebot’s built-in Crowbar Tools webhook proxy for Kick events. This makes the integration equally functional for all users and does not require anyone to run a webhook proxy (except the Crowbar Tools team, who is doing so as a service to the community :heart:).

- If you were using a third-party proxy, you must create/configure a Kick App and point its webhook URL to the value provided in Firebot.
- Webhook delivery remains required for follows, subscriptions, and channel reward redemptions.

Action required:

If you have never done so, follow the [Configuration](/doc/configuration.md) instructions to create a Kick app. As part of the configuration instructions you will re-authorize your streamer and (optionally) bot accounts with your new Kick app. This plugin will automatically register the necessary webook with the Crowbar Tools API.

### Channel Rewards

Kick channel point reward redemptions now trigger Firebot channel rewards directly instead of firing the custom "Channel Reward Redemption" event and using the "Trigger Custom Channel Reward Handler" effect for title-based filtering. If you previously set up this pipeline to trigger Twitch redemptions from Kick, you will need to set this up again using the new method.

- The custom event, effect and filter for channel rewards have been removed. Kick rewards now behave like Twitch rewards with built-in restrictions and filters. (Note: cooldowns are still not supported due to Firebot limitations.)
- Replace variables for rewards now read from standard channel reward metadata (`rewardId`, `rewardName`, `messageText`, etc.) and include `platform` for filtering.

Action required:

1. Remove the "Channel Reward Redemption (Kick)" event if you previously added it. (This will show up as an unknown event type after loading the new version of the plugin.)
2. Log in to Kick and go to [your profile picture > **Creator Dashboard** > **Channel** > **Community** > **Channel Points**](https://dashboard.kick.com/channel/community/channel-points). Delete any redemptions you intend to manage via Firebot.
   **Important**: Firebot will create *new* rewards on Kick when you enable management. If you do not delete the existing rewards on Kick, you will end up with duplicates (one from your old setup, one from Firebot).
3. In Firebot, go to **Kick** > **Custom Rewards** and choose any rewards that you want Firebot to manage. Use the **...** to select *Start Managing in Kick*.
4. For each mapped reward, review the effect list. Certain Firebot variables that are specific to Twitch (like `$userDisplayName`) will not work correctly for Kick redemptions. You may need to use variables from this integration (like `$platformAwareUserDisplayName`) to support both platforms.
   Note: The `$username` variable will return the Firebot-standard `User@kick` format. If you have logic relying on the raw username (e.g. strict string equality checks), you may need to update it or use `$platformAwareUserDisplayName` instead.

Notes:

1. You can set Kick-specific settings for cost, skip redemption queue, and enabled/disabled. Other settings (background color, whether a message is required) are synced directly from Firebot and cannot be changed. Some settings (cooldowns, icons) cannot be set in Kick at all.
2. If you make changes to a managed reward in the Firebot Channel Rewards interface, you need to visit **Kick** > **Custom Rewards** and re-sync those rewards (or all rewards) to Kick.
3. The total number of channel point rewards allowed in Kick is 15 (substantially less than the 50 supported by Twitch). This is a Kick limitation that applies whether or not you're using Firebot.

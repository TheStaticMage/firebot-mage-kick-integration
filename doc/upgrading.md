# Upgrading Instructions

## Version Requirements

- **Version 0.7.0 and higher** require Firebot 5.65
- **Version 0.6.2 and lower** require Firebot 5.64

## Versioning Philosophy

- A **patch release** changes the last number (e.g. `0.0.3` -> `0.0.4`). These releases may fix bugs or add features, but your existing setup should continue to work just fine.

- A **minor release** changes the middle number (e.g. `0.0.4` -> `0.1.0`). These releases typically make considerable changes. Backward compatibility cannot be assured.

- A **major release** changes the first number (e.g. `0.1.5` -> `1.0.0`). I do not intend to release version 1.0.

## Breaking Change Alerts

:boom: **Version 0.9.0 no longer supports webhook proxy**: Upon upgrading to version 0.9.0 or higher, all users will be required to create a Kick App in their own account and configure a webhook URL. Instructions are provided here: [Configuration](/doc/configuration.md).

## Upgrade Procedure

1. Download the new version `firebot-mage-kick-integration-<version>.js` from the [Releases](https://github.com/TheStaticMage/firebot-mage-kick-integration/releases) page.

2. Go to Settings &gt; Scripts &gt; Manage Startup Scripts in Firebot.

3. Edit the existing script entry and select the new file.

4. Restart Firebot.

## Upgrade Notes

### :boom: MAJOR CHANGE :boom: Version 0.9.0: Removal of webhook proxy

This version introduces a major architectural change. **The Webhook Proxy is no longer supported.** Instead, this integration now uses Firebot's built-in "Crowbar Tools" webhook proxy system to receive webhooks from Kick.

If you were using someone else's webhook proxy before, you never created a Kick App. You will need to do so now.

Follow the [Configuration](/doc/configuration.md) instructions.

### Version 0.8.0

:boom: Adds the `moderation:chat_message:manage` scope. You must re-authorize the streamer account to use the Delete Message effect.

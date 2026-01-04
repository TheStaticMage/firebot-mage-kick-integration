# Upgrading Instructions

## Version Requirements

- **Versions 0.10.0 and higher** require Firebot 5.65 and [firebot-mage-platform-lib](https://github.com/TheStaticMage/firebot-mage-platform-lib/)
- **Versions 0.7.0 and higher** require Firebot 5.65

## Versioning Philosophy

- A **patch release** changes the last number (e.g. `0.0.3` -> `0.0.4`). These releases may fix bugs or add features, but your existing setup should continue to work just fine.

- A **minor release** changes the middle number (e.g. `0.0.4` -> `0.1.0`). These releases typically make considerable changes. Backward compatibility cannot be assured.

- A **major release** changes the first number (e.g. `0.1.5` -> `1.0.0`). I do not intend to release version 1.0.

## Upgrade Procedure

:warning: **Versions 0.10.0 and higher require a compatible version of firebot-mage-platform-lib**: See version compatibility in the version notes (or just grab the latest version of all components). Download from [firebot-mage-platform-lib](https://github.com/TheStaticMage/firebot-mage-platform-lib/).

:boom: **Version 0.9.0 has major architectural changes**: Users will need to reconfigure their Kick connectivity and channel rewards. See [Breaking Changes](/doc/breaking-changes.md) for details.

1. Download the new version `firebot-mage-kick-integration-<version>.js` from the [Releases](https://github.com/TheStaticMage/firebot-mage-kick-integration/releases) page.

2. Go to Settings &gt; Scripts &gt; Manage Startup Scripts in Firebot.

3. Edit the existing script entry and select the new file.

4. Restart Firebot.

## Upgrade Notes

### Version 0.10.1

Install version 0.0.2 or higher of [firebot-mage-platform-lib](https://github.com/TheStaticMage/firebot-mage-platform-lib/).

### Version 0.10.0

Install version 0.0.1 or higher of [firebot-mage-platform-lib](https://github.com/TheStaticMage/firebot-mage-platform-lib/).

### Version 0.9.0

See [Breaking Changes](/doc/breaking-changes.md) for details on major changes, including webhook proxy retirement and channel reward updates in 0.8.0.

### Version 0.8.0

:boom: Adds the `moderation:chat_message:manage` scope. You must re-authorize the streamer account to use the Delete Message effect.

### Version 0.7.0

Version 0.7.0 (and higher) require Firebot 5.65. Firebot <= 5.64 are no longer supported.

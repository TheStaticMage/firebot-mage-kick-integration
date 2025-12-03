# Troubleshooting

This guide lists common problems and quick fixes for the Kick integration.

## Missing Kick scopes

If you see an error about missing Kick token scopes or some effects fail to run, re-authorize the account.

1. Open the Kick Accounts screen in Firebot.
2. Click **Authorize Streamer** or **Authorize Bot** for the affected account.
3. Approve all requested permissions when the Kick consent screen appears.
4. Restart the integration.

After re-authorizing with all scopes, chat moderation and channel update effects should work again.

## Missing Kick scopes (even after re-authorizing)

If re-authorizing still shows missing scopes, make sure the Kick app actually grants them.

### Your own Kick app (or your own webhook proxy)

1. Sign in to Kick.
2. Click your profile image > **Settings**.
3. Open the **Developer** tab and click **View** on the app used for this integration.
4. Under **Scopes Requested**, all of the checkboxes _except_ **Read stream key**.
5. Click **Edit**, check any missing boxes, then **Save changes**.
6. Re-authorize the streamer and bot accounts in Firebot so the new scopes take effect.

### Using someone else's webhook proxy

Ask the proxy administrator to enable the scopes listed above, then re-authorize in Firebot.

## Invalid or expired refresh token

If you get repeated pop-up errors about invalid tokens, the refresh token may have expired.

1. Open the Kick Accounts screen.
2. Deauthorize the affected account.
3. Authorize it again and confirm the prompt.

The integration will reconnect automatically after a valid token is stored.

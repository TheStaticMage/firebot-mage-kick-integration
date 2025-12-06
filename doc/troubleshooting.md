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

1. Sign in to Kick.
2. Click your profile image > **Settings**.
3. Open the **Developer** tab and click **View** on the app used for this integration.
4. Under **Scopes Requested**, make sure that all of the checkboxes _except_ **Read stream key** are checked.

If not all of the boxes are checked, continue:

1. Click **Edit**, check any missing boxes, then **Save changes**.
2. Re-authorize the streamer and bot accounts in Firebot so the new scopes take effect.

_Note_: These steps must be performed _in this order_ to work. Authorizing in Firebot and then adding permissions to your app won't fix anything until you re-authorize.

# LINE Login, links, and notifications

The client-side foundation uses the existing Expo Router, `expo-auth-session`,
`expo-web-browser`, and Supabase Auth stack. No LINE secret or server key belongs
in the app bundle.

## Placeholder domain

`companion.example.com` is intentionally a placeholder. Replace it in
`app.json`, this document, the LINE Developers Console, and the association
files when the production domain is known. Rebuild both native apps after
changing `app.json`.

Supported routes:

- `companionapp://room`
- `companionapp://room?roomId=...`
- `https://companion.example.com/room`
- `https://companion.example.com/room?roomId=...`

The current room backend remains authoritative. A `roomId` query parameter is
preserved through login and delivered to the room route, but it does not bypass
active-room resume or server-side matchmaking.

## LINE Developers setup

1. Create a LINE Developers Provider for Companion.
2. Create a LINE Login Channel under that provider and enable the Web app type.
3. Request the `openid profile` scopes. Only request `email` after LINE has
   approved email access; configure Supabase to allow an absent email if needed.
4. Copy the read-only Supabase custom-provider callback URL into the LINE Login
   Channel's Callback URL list. It normally has the form
   `https://<project-ref>.supabase.co/auth/v1/callback`; use the exact value shown
   by the Supabase Dashboard.
5. Create a LINE Official Account, enable its Messaging API Channel under the
   same Provider, and use the LINE Login Channel's **Link a bot** setting to link
   the Official Account. This is required before login identities can support
   notification/account-linking workflows.

## Supabase Auth setup

In **Authentication > Providers**, create and enable a custom provider with the
identifier `custom:line`. Prefer OIDC auto-discovery if LINE exposes a discovery
document accepted by Supabase. Otherwise use manual OAuth2 configuration:

- Authorization URL: `https://access.line.me/oauth2/v2.1/authorize`
- Token URL: `https://api.line.me/oauth2/v2.1/token`
- UserInfo URL: `https://api.line.me/oauth2/v2.1/userinfo`
- Scopes: `openid profile` and optionally `email`
- Client ID: LINE Login Channel ID
- Client secret: LINE Login Channel Secret

Add the app callback URL generated for the `companionapp` scheme to Supabase
Authentication URL Configuration's redirect allow list. Keep the existing
Google and Apple provider configuration unchanged.

## Universal Links and Android App Links

The production HTTPS domain must host both files without redirects:

- `https://<domain>/.well-known/apple-app-site-association`
- `https://<domain>/.well-known/assetlinks.json`

The AASA file needs the Apple Team ID plus
`com.grace032630.companionapp`, and should allow `/room` and `/room/*`. The
Android file needs the final Android package name and SHA-256 fingerprints from
the Play signing certificate. Serve both with an appropriate JSON content type.

## LINE knock notifications

`requestLineKnockNotification(targetUserId, roomId)` only invokes the future
`line-knock-notification` Supabase Edge Function. That function is not included
yet. Before enabling the feature, it must:

1. authenticate the Supabase caller and validate room membership;
2. look up a previously linked LINE user ID on the server;
3. rate-limit and authorize the notification;
4. call the LINE Messaging API;
5. return a safe response without exposing LINE credentials.

Store the Messaging API Channel Secret and Channel Access Token only in
Supabase Edge Function secrets. Never use `EXPO_PUBLIC_` variables for them and
never commit them to the repository.

## References

- [Supabase custom OAuth/OIDC providers](https://supabase.com/docs/guides/auth/custom-oauth-providers)
- [Supabase Edge Function secrets](https://supabase.com/docs/guides/functions/secrets)
- [LINE Login integration](https://developers.line.biz/en/docs/line-login/integrate-line-login/)
- [LINE Login API](https://developers.line.biz/en/reference/line-login/)
- [LINE Messaging API setup](https://developers.line.biz/en/docs/messaging-api/getting-started/)
- [Expo iOS Universal Links](https://docs.expo.dev/linking/ios-universal-links/)
- [Expo Android App Links](https://docs.expo.dev/linking/android-app-links/)

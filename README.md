# Companion App

Expo Router and TypeScript app with Supabase authentication and persistent sessions.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and replace the placeholder values with your Supabase project URL and anon key:

   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

3. Start the Expo development server:

   ```bash
   npx expo start
   ```

## OAuth setup

- In Supabase Authentication, enable the Google provider and add its client credentials.
- Add the redirect URL produced by Expo's `makeRedirectUri()` to Supabase Authentication → URL Configuration → Redirect URLs. In Expo Go this is an `exp://...` development URL; development builds use the `companionapp://` scheme.
- Enable the Apple provider in Supabase before testing Sign in with Apple. Native builds are configured with the `expo-apple-authentication` plugin and the iOS Sign in with Apple entitlement.
- Google and Apple provider credentials belong in the Supabase dashboard. Never put provider secrets or a Supabase service-role key in this app.

## Checks

Run the TypeScript compiler without emitting files:

```bash
npm run typecheck
```

Google authentication uses Supabase OAuth. Apple authentication uses the native iOS identity token when it is available; non-iOS platforms remain safe and show a platform notice.

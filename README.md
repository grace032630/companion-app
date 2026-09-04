# Companion App

Minimal Expo Router and TypeScript foundation with Supabase authentication session persistence.

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

## Checks

Run the TypeScript compiler without emitting files:

```bash
npm run typecheck
```

The login screen is intentionally a placeholder. OAuth and other sign-in flows are not part of this initial foundation.

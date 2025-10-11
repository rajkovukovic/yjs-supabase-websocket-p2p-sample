# Authentication Setup Guide

This application uses Supabase Authentication with Google OAuth for user sign-in.

## Features

- ✅ Google OAuth Sign-In
- ✅ Beautiful login page with modern UI
- ✅ Protected routes (no redirects, inline auth check)
- ✅ User menu with avatar and sign-out
- ✅ Automatic session management
- ✅ Persistent authentication state

## Prerequisites

1. A Supabase project
2. Google Cloud Console project with OAuth 2.0 credentials

## Setup Instructions

### 1. Configure Google OAuth in Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. Configure the consent screen if you haven't already
6. Choose **Web application** as the application type
7. Add authorized redirect URIs:
   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```
   Replace `<your-project-ref>` with your Supabase project reference ID
8. Save and copy the **Client ID** and **Client Secret**

### 2. Configure Google OAuth in Supabase

1. Go to your [Supabase Dashboard](https://app.supabase.com/)
2. Navigate to **Authentication** → **Providers**
3. Find **Google** in the list of providers
4. Enable Google provider
5. Paste your **Client ID** and **Client Secret** from Google Cloud Console
6. Save the configuration

### 3. Update Environment Variables

Update your `.env.local` file with your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL="https://<your-project-ref>.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="<your-anon-key>"

# WebSocket URLs (existing)
NEXT_PUBLIC_HOCUSPOCUS_URL=wss://yjs-draw-hocuspocus.my-domain.com
NEXT_PUBLIC_SIGNALING_URL=wss://yjs-draw-signal.my-domain.com
NEXT_PUBLIC_WEBRTC_PASSWORD=your-secure-password
```

You can find these values in your Supabase project settings:
- Go to **Settings** → **API**
- Copy the **Project URL** and **anon/public** key

### 4. Test the Authentication

1. Start your development server:
   ```bash
   cd web
   pnpm dev
   ```

2. Navigate to `http://localhost:3000`
3. You should see the login page
4. Click "Continue with Google"
5. Complete the Google sign-in flow
6. You should be redirected back to the app and see the documents list

## How It Works

### Component Structure

```
AuthGuard (checks auth state)
  └─ LoginPage (shown if not authenticated)
  └─ Protected Content (shown if authenticated)
```

### Key Components

- **`useAuth`** hook: Manages authentication state and provides sign-in/sign-out methods
- **`AuthGuard`**: Wraps pages to enforce authentication
- **`LoginPage`**: Beautiful Google OAuth sign-in interface

### Pages with Authentication

All pages are now protected:
- `/` - Home page (documents list)
- `/document/[id]` - Document editor

## User Experience

### Login Flow
1. User visits any page
2. If not authenticated, sees beautiful login screen
3. Clicks "Continue with Google"
4. Completes Google OAuth flow
5. Returns to the app authenticated

### Authenticated Experience
- User avatar/info displayed in header
- Dropdown menu with sign-out option
- Seamless access to all features
- Persistent session across page refreshes

### Sign Out Flow
1. User clicks their avatar/name
2. Selects "Sign Out" from dropdown
3. Returns to login page (no redirect)

## Production Deployment

When deploying to production:

1. Update Google OAuth redirect URIs in Google Cloud Console to include your production domain:
   ```
   https://your-domain.com/auth/callback
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```

2. Update your production environment variables with the same Supabase credentials

3. Ensure your Supabase project is on a paid plan if you expect high traffic

## Troubleshooting

### "Invalid redirect URI" error
- Make sure the redirect URI in Google Cloud Console exactly matches your Supabase auth callback URL
- Include both development and production URLs

### "Missing Supabase environment variables" error
- Check that `.env.local` exists and contains the required variables
- Restart the development server after adding environment variables

### Google sign-in popup closes immediately
- Check browser console for errors
- Verify Google OAuth credentials are correct in Supabase dashboard
- Ensure cookies are enabled in your browser

### Session not persisting
- Check that your Supabase URL and anon key are correct
- Clear browser cookies and try again
- Verify Supabase project is active

## Security Notes

- The anon key is safe to expose in client-side code
- All authentication is handled securely by Supabase
- Row Level Security (RLS) should be enabled on your Supabase tables for data security
- User sessions are managed automatically by Supabase Auth

## Additional Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Supabase Auth with Next.js](https://supabase.com/docs/guides/auth/auth-helpers/nextjs)


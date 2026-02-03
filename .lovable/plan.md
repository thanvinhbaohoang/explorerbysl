
# Fix Google OAuth on Custom Domain (app.explorerbysl.com)

## Problem Identified

The Lovable Cloud managed OAuth (`@lovable.dev/cloud-auth-js`) is designed to work with Lovable domains (`*.lovable.app`, `*.lovableproject.com`). When using a custom domain like `app.explorerbysl.com`, the OAuth flow fails because:

1. User clicks "Sign in with Google" on `app.explorerbysl.com`
2. Lovable auth broker initiates OAuth with Google
3. Google completes auth and sends tokens back to the broker
4. Broker attempts to redirect/set session for your custom domain
5. Session is not properly established on the custom domain
6. User gets redirected back to `/auth` because `getSession()` returns null

---

## Solution Options

### Option A: Use Your Own Google OAuth Credentials (Recommended)

Configure Google OAuth directly in Lovable Cloud's Authentication Settings with your own credentials, which will work with custom domains.

**Steps:**
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create OAuth 2.0 credentials (Web application type)
3. Add authorized redirect URLs:
   - `https://ddaybkxhpvlpvgnphahp.supabase.co/auth/v1/callback`
4. Add authorized JavaScript origins:
   - `https://app.explorerbysl.com`
   - `https://haroldtest.lovable.app` (if you want both to work)
5. In Lovable Cloud Dashboard → Users → Authentication Settings → Google:
   - Enter your Client ID and Client Secret
6. Update the code to use standard Supabase OAuth instead of Lovable broker

### Option B: Keep Using Lovable Domain

Continue using `haroldtest.lovable.app` as your primary domain for authentication, and the managed OAuth will continue to work.

---

## Implementation Plan (Option A)

### Step 1: Update Auth.tsx to Use Direct Supabase OAuth

Replace the Lovable auth broker with standard Supabase OAuth for custom domain compatibility:

**File: `src/pages/Auth.tsx`**

```typescript
// Change from:
import { lovable } from "@/integrations/lovable";

// To using direct Supabase OAuth:
const handleGoogleLogin = async () => {
  setLoading(true);
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/customers`,
      },
    });

    if (error) {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    }
  } catch (error) {
    toast({
      title: "Login failed",
      description: "An unexpected error occurred",
      variant: "destructive",
    });
  } finally {
    setLoading(false);
  }
};
```

### Step 2: Configure Google OAuth in Lovable Cloud

1. Open Lovable Cloud Dashboard
2. Navigate to **Users → Authentication Settings → Sign In Methods → Google**
3. Add your Google Client ID and Client Secret
4. Save the configuration

### Step 3: Configure Google Cloud Console

In your Google Cloud project:

1. **Authorized JavaScript origins:**
   - `https://app.explorerbysl.com`
   - `https://haroldtest.lovable.app`

2. **Authorized redirect URIs:**
   - `https://ddaybkxhpvlpvgnphahp.supabase.co/auth/v1/callback`

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Auth.tsx` | Replace `lovable.auth.signInWithOAuth` with `supabase.auth.signInWithOAuth` |

---

## Important Notes

- The Lovable broker (`@lovable.dev/cloud-auth-js`) is excellent for preview environments but has limitations with custom domains
- Using your own Google OAuth credentials gives you full control over authorized domains
- Both the Lovable domain and custom domain can work simultaneously with proper Google Console configuration
- The session handling in `AuthContext.tsx` and `ProtectedRoute.tsx` will work correctly once OAuth is properly configured

---

## Alternative: Hybrid Approach

If you want to keep the Lovable broker for preview but use direct Supabase for custom domains:

```typescript
const handleGoogleLogin = async () => {
  const isLovableDomain = window.location.hostname.includes('lovable');
  
  if (isLovableDomain) {
    // Use Lovable managed OAuth for preview
    await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
  } else {
    // Use direct Supabase OAuth for custom domains
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/customers`,
      },
    });
  }
};
```

This gives you the best of both worlds - managed OAuth in preview and custom domain support for production.

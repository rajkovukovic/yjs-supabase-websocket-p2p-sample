/**
 * Centralized environment variable management with type safety and fallbacks
 * All environment variables should be accessed through this module instead of process.env
 */

/**
 * Resolve a same-origin relative URL (e.g. "/supabase" or "/hocuspocus") against the
 * current browser origin. Absolute URLs are returned unchanged. During SSR there is no
 * browser origin, so a localhost placeholder keeps client constructors valid.
 */
function resolveUrl(url: string | undefined, kind: 'http' | 'ws'): string | undefined {
  if (!url || !url.startsWith('/')) return url
  const origin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin
  return kind === 'ws' ? origin.replace(/^http/, 'ws') + url : origin + url
}

// Supabase configuration (required)
export const SUPABASE_URL = resolveUrl(process.env.NEXT_PUBLIC_SUPABASE_URL, 'http')!
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// WebSocket servers
export const HOCUSPOCUS_URL = resolveUrl(process.env.NEXT_PUBLIC_HOCUSPOCUS_URL, 'ws') || 'ws://localhost:1234'
export const Y_WEBRTC_SIGNALING_URL = resolveUrl(process.env.NEXT_PUBLIC_Y_WEBRTC_SIGNALING_URL, 'ws')  // Y-WebRTC signaling for P2P

// WebRTC configuration
export const WEBRTC_PASSWORD = process.env.NEXT_PUBLIC_WEBRTC_PASSWORD

// Optional email/password sign-in (for local Supabase / preview environments without Google OAuth)
export const ENABLE_EMAIL_LOGIN = process.env.NEXT_PUBLIC_ENABLE_EMAIL_LOGIN === 'true'


/**
 * Validate that all required environment variables are present
 * Call this early in the application lifecycle to catch missing env vars
 */
export function validateEnvironment() {
  try {
    // Check that required variables are present
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error('Missing required Supabase environment variables. Please check your .env.local file.')
    }
  } catch (error) {
    console.error('❌ Environment validation failed:', error)
    throw error
  }

  console.log('✅ Environment variables validated successfully')
}

/**
 * Centralized environment variable management with type safety and fallbacks
 * All environment variables should be accessed through this module instead of process.env
 */

// Supabase configuration (required)
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// WebSocket servers
export const HOCUSPOCUS_URL = process.env.NEXT_PUBLIC_HOCUSPOCUS_URL || 'ws://localhost:1234'
export const SIGNALING_URL = process.env.NEXT_PUBLIC_SIGNALING_URL

// WebRTC configuration
export const WEBRTC_PASSWORD = process.env.NEXT_PUBLIC_WEBRTC_PASSWORD


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
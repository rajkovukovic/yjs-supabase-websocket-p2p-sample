import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Get current directory in ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables from .env file in server directory
// This MUST be imported before any other modules that use env vars
dotenv.config({ path: join(__dirname, '.env') })

// Validate required environment variables
const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_KEY']
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName])

if (missingEnvVars.length > 0) {
  console.error('\n❌ Missing required environment variables:')
  missingEnvVars.forEach(varName => {
    console.error(`   - ${varName}`)
  })
  console.error('\nPlease ensure your .env file exists and contains all required variables.')
  console.error('Copy env.example to .env and fill in the values.\n')
  process.exit(1)
}

// Export config values
export const config = {
  supabase: {
    url: process.env.SUPABASE_URL!,
    serviceKey: process.env.SUPABASE_SERVICE_KEY!,
  },
  hocuspocus: {
    port: parseInt(process.env.HOCUSPOCUS_PORT || '1234'),
  },
  yWebrtcSignaling: {
    port: parseInt(process.env.Y_WEBRTC_SIGNALING_PORT || '4445'),
  },
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
  },
  nodeEnv: process.env.NODE_ENV || 'development',
  tables: {
    documents: process.env.TABLE_DOCUMENTS || 'documents',
    documentUpdates: process.env.TABLE_DOCUMENT_UPDATES || 'document_updates',
    documentSnapshots: process.env.TABLE_DOCUMENT_SNAPSHOTS || 'document_snapshots',
  },
}

console.log('✓ Environment variables loaded successfully')


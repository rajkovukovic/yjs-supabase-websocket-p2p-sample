# Bug Fix: Environment Variable Loading Issue

## Problem

When running `npm run dev`, the server threw an error:
```
Error: supabaseUrl is required.
```

Even though `SUPABASE_URL` was properly set in `./server/.env`.

## Root Cause

**ES Module Import Hoisting Issue**

In ES modules (ESM), all `import` statements are hoisted and executed **before** any other code in the file, including `dotenv.config()`. This meant:

1. `hocuspocus-server.ts` imported `extensions/supabase-db.ts`
2. `supabase-db.ts` tried to create Supabase client at module load time
3. At that point, environment variables hadn't been loaded yet
4. `process.env.SUPABASE_URL` was undefined → error

### Execution Order (Before Fix)
```
1. Import statements execute (hoisted)
   ↓
2. supabase-db.ts creates client with undefined env vars ❌
   ↓
3. dotenv.config() runs (too late!)
```

## Solution

Implemented a **three-part fix**:

### 1. Created Central Config Module (`config.ts`)

```typescript
import dotenv from 'dotenv'
// ... load .env file with explicit path

dotenv.config({ path: join(__dirname, '.env') })

// Validate required env vars
// Export config object
```

This module:
- Loads environment variables FIRST
- Validates all required vars are present
- Provides helpful error messages if missing
- Exports typed config object

### 2. Lazy Supabase Client Initialization

Changed from:
```typescript
// ❌ Eager initialization (too early)
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)
```

To:
```typescript
// ✅ Lazy initialization (when first used)
let supabase: SupabaseClient | null = null

function getSupabaseClient() {
  if (!supabase) {
    supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    )
  }
  return supabase
}
```

### 3. Import Order Matters

Updated both server files:
```typescript
// ✅ Import config FIRST
import { config } from './config.js'
// Then import other modules
import { Server } from '@hocuspocus/server'
import { SupabaseDatabase } from './extensions/supabase-db.js'
```

### Execution Order (After Fix)
```
1. Import config.ts (loads .env) ✓
   ↓
2. Import other modules ✓
   ↓
3. First database operation calls getSupabaseClient() ✓
   ↓
4. Supabase client created with valid env vars ✓
```

## Files Changed

### Created
- ✅ `config.ts` - Central configuration module

### Modified
- ✅ `hocuspocus-server.ts` - Import config first
- ✅ `signaling-server.ts` - Import config first  
- ✅ `extensions/supabase-db.ts` - Lazy client initialization

## Testing

After the fix:
```bash
cd server
npm run dev
```

**Result**: ✅ Both servers start successfully
- Hocuspocus: `ws://localhost:1234`
- Signaling: `ws://localhost:4444`

**Health Check**: ✅ Passes
```bash
curl http://localhost:4444/health
# {"status":"ok","service":"webrtc-signaling"}
```

## Key Takeaways

### ES Module Gotchas
1. **Imports are hoisted** - They execute before any other code
2. **Top-level code runs at import time** - Module-level variables initialize immediately
3. **dotenv must load before imports** - Or imports won't see the env vars

### Best Practices
1. ✅ Create a central config module
2. ✅ Load config first in all entry points
3. ✅ Use lazy initialization for external services
4. ✅ Validate env vars early with helpful errors
5. ✅ Use explicit paths for `.env` files

## Additional Improvements

The fix also added:
- ✅ Environment variable validation on startup
- ✅ Clear error messages for missing vars
- ✅ Typed config object for better DX
- ✅ Console confirmation when env loaded

## Prevention

To prevent this in future:
1. Always import config first
2. Never create clients at module level
3. Use lazy initialization for services
4. Test with missing env vars to verify error handling

## Verification Checklist

- ✅ Servers start without errors
- ✅ Environment variables load correctly
- ✅ Supabase client initializes on first use
- ✅ Health checks pass
- ✅ No linter errors
- ✅ Helpful error messages if env vars missing

---

**Status**: ✅ FIXED and TESTED


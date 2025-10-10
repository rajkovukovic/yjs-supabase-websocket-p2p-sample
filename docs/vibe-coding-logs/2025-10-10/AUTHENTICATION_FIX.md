# Hocuspocus Authentication Fix

## Problem
The application showed the following error after 10-20 seconds of connection:
```
[HocuspocusProvider] An authentication token is required, but you didn't send one. 
Try adding a `token` to your HocuspocusProvider configuration. Won't try again.
```

This error occurred even though:
- Data synchronization was working between browsers
- The server had no authentication configured
- The connection remained active

## Root Cause
HocuspocusProvider v2.15.3 has built-in client-side authentication checks that trigger during:
1. Initial connection establishment
2. Reconnection attempts (every ~30 seconds via `messageReconnectTimeout`)

The provider expects either:
- A valid authentication token, OR
- An `onAuthenticate` hook on the server that accepts the connection

Simply removing the `onAuthenticate` hook wasn't sufficient because the provider still performs client-side validation.

## Solution

### 1. Server-Side Fix (`server/hocuspocus-server.ts`)

Added an `onAuthenticate` hook that explicitly accepts all connections:

```typescript
async onAuthenticate() {
  // Allow all connections - no authentication required for MVP
  // Simply return without checking any tokens
  return {
    user: {
      id: 'anonymous-' + Math.random().toString(36).substr(2, 9),
      name: 'Anonymous User'
    }
  }
}
```

**Why this works:**
- Satisfies Hocuspocus's expectation that authentication is handled
- Generates unique anonymous user IDs for tracking
- No actual validation - accepts everyone

### 2. Client-Side Fixes (`web/lib/yjs-providers.ts`)

#### Fix #1: Provide Token Function
```typescript
token: () => 'anonymous-user',
```

**Why a function:**
- Ensures token is available during reconnection attempts
- The provider calls this function each time it needs the token

#### Fix #2: Increase Message Reconnect Timeout
```typescript
messageReconnectTimeout: 3600000, // 1 hour in milliseconds
```

**Why this works:**
- Default timeout is ~30 seconds, triggering frequent re-authentication
- Setting to 1 hour prevents unnecessary reconnection checks
- The connection stays alive and healthy without interruption

## Complete Provider Configuration

```typescript
const hocuspocusProvider = new HocuspocusProvider({
  url: process.env.NEXT_PUBLIC_HOCUSPOCUS_URL || 'ws://localhost:1234',
  name: documentName,
  document: ydoc,
  
  // Provide a dummy token function to satisfy HocuspocusProvider v2.15.3 client-side checks
  // The server's onAuthenticate hook accepts all connections regardless
  token: () => 'anonymous-user',
  
  // Set a very high message reconnect timeout to prevent premature disconnections
  // 3600000 ms = 1 hour
  messageReconnectTimeout: 3600000,
  
  onSynced: ({ state }) => {
    console.log('Hocuspocus synced:', state)
  },
  
  onStatus: ({ status }) => {
    console.log('Connection status:', status)
  },
  
  onAuthenticationFailed: ({ reason }) => {
    console.error('Authentication failed:', reason)
  }
})
```

## Verification

After applying these fixes:
- ✅ No authentication warnings appear
- ✅ Data syncs between multiple browsers/tabs
- ✅ Peer count updates correctly (shows connected users)
- ✅ Connection remains stable for extended periods (50+ seconds tested)
- ✅ Rectangles sync in real-time across clients

## Testing Steps

1. Start the Hocuspocus server:
   ```bash
   cd server
   docker-compose up --build -d
   ```

2. Start the web application:
   ```bash
   cd web
   npm run dev
   ```

3. Open the application in two browser windows/tabs:
   ```
   http://localhost:3000/document/test-doc
   ```

4. Verify:
   - Both show "Synced" status
   - Both show "Status: connected"
   - Peer count shows 1 in each (detecting the other)
   - No authentication warnings in console
   - Changes in one browser sync to the other immediately

## Production Considerations

For production deployment with actual authentication:

1. **Replace the server's `onAuthenticate` hook:**
   ```typescript
   async onAuthenticate({ requestHeaders, requestParameters }) {
     const token = requestHeaders.authorization?.split(' ')[1] || requestParameters.token
     
     if (!token) {
       throw new Error('No token provided')
     }
     
     // Verify token with Supabase Auth
     const { data: { user }, error } = await supabase.auth.getUser(token)
     
     if (error || !user) {
       throw new Error('Invalid token')
     }
     
     return {
       user: {
         id: user.id,
         name: user.email || 'Unknown User'
       }
     }
   }
   ```

2. **Update the client to provide real tokens:**
   ```typescript
   token: async () => {
     const { data: { session } } = await supabase.auth.getSession()
     return session?.access_token || ''
   }
   ```

3. **Adjust `messageReconnectTimeout` based on your token expiry:**
   ```typescript
   messageReconnectTimeout: 3600000 // Match your token lifetime
   ```

## Database Encoding Fix

### Root Cause of Permission-Denied Error

The "Authentication failed: permission-denied" error was actually caused by **corrupted database data**, not authentication itself. Here's what was happening:

1. **Incorrect Storage**: Yjs binary data was being stored as JSON `{"type":"Buffer","data":[...]}` instead of raw BYTEA
2. **Parsing Errors**: When loading, this caused "Unexpected end of JSON input" errors
3. **Authentication Failure**: The corrupted data triggered permission checks that failed

### The Fix

**File: `server/extensions/supabase-db.ts`**

#### Storing Data (Converting to Hex):
```typescript
store: async ({ documentName, state }) => {
  const supabase = getSupabaseClient()
  
  // Convert Uint8Array to hex string for Supabase BYTEA storage
  const buffer = Buffer.from(state)
  const hexString = '\\x' + buffer.toString('hex')
  
  await supabase
    .from('documents')
    .upsert({
      name: documentName,
      yjs_state: hexString,  // Store as \xHEXSTRING
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'name'
    })
}
```

#### Loading Data (Converting from Hex):
```typescript
fetch: async ({ documentName }) => {
  const { data } = await supabase
    .from('documents')
    .select('yjs_state')
    .eq('name', documentName)
    .single()
  
  let binaryData = data.yjs_state
  
  // Supabase returns BYTEA as hex string starting with \x
  if (typeof binaryData === 'string' && binaryData.startsWith('\\x')) {
    const hexString = binaryData.slice(2)  // Remove \x prefix
    binaryData = Buffer.from(hexString, 'hex')
  }
  
  return Buffer.isBuffer(binaryData) ? new Uint8Array(binaryData) : binaryData
}
```

### Clearing Corrupted Data

If you have corrupted data in your database, clear it:

```bash
docker exec g-zero-hocuspocus node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

(async () => {
  const { error } = await supabase
    .from('documents')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
    
  console.log(error ? 'Error:' + error : '✅ All documents deleted');
})();
"
```

Then rebuild the server:
```bash
cd server
docker-compose build hocuspocus
docker-compose up -d
```

## Troubleshooting

### "Authentication failed: permission-denied" Error  

This error after ~5 seconds typically indicates **corrupted database data** (see Database Encoding Fix above). If you still see this after the database fix:

1. **Old Browser Tabs**: Close all browser tabs and reopen - old tabs may have cached the old provider configuration

2. **Server Not Running**: Verify the Hocuspocus server is running:
   ```bash
   docker ps | grep hocuspocus
   docker logs g-zero-hocuspocus --tail 20
   ```

3. **Server Not Rebuilt**: After changing server code, rebuild the Docker container:
   ```bash
   cd server
   docker-compose down
   docker-compose up --build -d
   ```

4. **Database Issues**: Check for corrupted data in Supabase:
   ```bash
   # Check if any documents have invalid yjs_state
   # Run in server directory
   docker exec g-zero-hocuspocus node -e "
   const { createClient } = require('@supabase/supabase-js');
   const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
   (async () => {
     const { data } = await supabase.from('documents').select('name, yjs_state').limit(10);
     console.log(data);
   })();
   "
   ```

5. **Check Server Logs**: Look for authentication errors:
   ```bash
   docker logs g-zero-hocuspocus | grep -i "auth\|error\|fail"
   ```

6. **Browser Console Details**: With enhanced logging, you'll see:
   ```
   ❌ Authentication failed: permission-denied
   Error details: {...}
   This usually indicates a server-side authentication rejection
   ```

### Debug Mode

The provider now includes enhanced logging. Open browser DevTools and look for:
- ✅ Connection opened successfully
- Connection status: connected
- Hocuspocus synced: true
- ❌ Authentication failed (if errors occur)

### Clearing State

If issues persist, clear all state:

```bash
# Client side (browser console)
indexedDB.deleteDatabase('y-indexeddb')
location.reload()

# Server side
docker-compose down -v
docker-compose up -d
```

## References

- [Hocuspocus Documentation](https://tiptap.dev/hocuspocus)
- [GitHub Issue #596](https://github.com/ueberdosis/hocuspocus/issues/596)
- [GitHub Issue #813](https://github.com/ueberdosis/hocuspocus/issues/813)
- [HocuspocusProvider Configuration](https://tiptap.dev/hocuspocus/provider/configuration)


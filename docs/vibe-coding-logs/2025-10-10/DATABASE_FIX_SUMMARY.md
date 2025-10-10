# Database Encoding Fix - Complete Solution

## 🐛 The Bug

**Symptoms:**
- ❌ "Authentication failed: permission-denied" error after 5 seconds
- ❌ "[onLoadDocument] Unexpected end of JSON input" in server logs
- ❌ Data not syncing between browsers properly
- ❌ Empty `document_updates` table

## 🔍 Root Cause Analysis

The "permission-denied" error was **NOT an authentication issue** - it was caused by **corrupted database storage**:

### What Was Happening:

1. **Incorrect Storage Format**:
   - Yjs binary data was being stored as JSON: `{"type":"Buffer","data":[1,2,3...]}`
   - This happened because Supabase JS client JSON-stringified the Buffer object

2. **Failed Parsing on Load**:
   - When loading, Hocuspocus tried to parse this JSON as binary Yjs data
   - This caused "Unexpected end of JSON input" errors
   - The corrupted data triggered permission checks that failed

3. **The Cascade Effect**:
   - Corrupted data → Parsing errors → Permission denied → Connection drops

### Evidence Found:

```bash
# What was stored (WRONG):
\x7b2274797065223a22427566666572222c2264617461223a5b...
# Decoded: {"type":"Buffer","data":[1,1,204,179,235,248,7,0,8,1,10...]}

# What should be stored (CORRECT):
\x010190d5dbfc0f0008010a72656374616e676c6573017608...
# Raw binary Yjs data encoded as hex
```

## ✅ The Complete Fix

### 1. Fixed Database Extension (`server/extensions/supabase-db.ts`)

#### Storing Data - Convert to Hex String:
```typescript
store: async ({ documentName, state }) => {
  const supabase = getSupabaseClient()
  
  // Convert Uint8Array to hex string for Supabase BYTEA storage
  // Supabase requires format: \xHEXSTRING
  const buffer = Buffer.from(state)
  const hexString = '\\x' + buffer.toString('hex')
  
  console.log(`[SupabaseDB] Storing ${buffer.length} bytes as hex string`)
  
  const { error } = await supabase
    .from('documents')
    .upsert({
      name: documentName,
      yjs_state: hexString,  // Store as hex, not Buffer object
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'name'
    })
  
  if (error) throw error
}
```

#### Loading Data - Convert from Hex String:
```typescript
fetch: async ({ documentName }) => {
  const { data, error } = await supabase
    .from('documents')
    .select('yjs_state')
    .eq('name', documentName)
    .single()
  
  if (error || !data?.yjs_state) return null
  
  let binaryData = data.yjs_state
  
  // Supabase returns BYTEA as hex-encoded string (e.g., "\x7b2274...")
  // We need to convert it to Uint8Array
  if (typeof binaryData === 'string' && binaryData.startsWith('\\x')) {
    // Remove \x prefix and convert hex to buffer
    const hexString = binaryData.slice(2)
    binaryData = Buffer.from(hexString, 'hex')
    console.log(`[SupabaseDB] Converted hex string to buffer (${binaryData.length} bytes)`)
  }
  
  // Convert Buffer to Uint8Array if needed
  if (Buffer.isBuffer(binaryData)) {
    return new Uint8Array(binaryData)
  }
  
  return binaryData
}
```

### 2. Added Error Handling (`server/hocuspocus-server.ts`)

```typescript
async onLoadDocument({ documentName, document }) {
  try {
    console.log(`[Hocuspocus] Document loaded: ${documentName}`)
    const rectangles = document.getArray('rectangles')
    console.log(`[Hocuspocus] Document has ${rectangles.length} rectangles`)
  } catch (error: any) {
    console.error(`[onLoadDocument] Error:`, error?.message || error)
    console.error(`[onLoadDocument] Full error:`, error)
  }
}
```

## 🧹 Cleanup Steps

### Step 1: Clear Corrupted Data

```bash
# Delete all corrupted documents from Supabase
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
    
  console.log(error ? 'Error: ' + error : '✅ All documents deleted');
})();
"
```

### Step 2: Rebuild Server

```bash
cd server
docker-compose build hocuspocus
docker-compose up -d
```

### Step 3: Clear Browser Cache

Open browser console and run:
```javascript
indexedDB.deleteDatabase('y-indexeddb')
location.reload()
```

## ✅ Verification

After applying the fix, verify everything works:

### 1. Check Server Logs:
```bash
docker logs g-zero-hocuspocus --tail 20
```

**Expected output (GOOD):**
```
[SupabaseDB] Successfully fetched document: brand-new-test
[SupabaseDB] Converted hex string to buffer (168 bytes)
[Hocuspocus] Document loaded: brand-new-test
[Hocuspocus] Document has 1 rectangles
```

**Bad output (if not fixed):**
```
[onLoadDocument] Unexpected end of JSON input
[onLoadDocument] contentRefs[(info & binary.BITS5)] is not a function
```

### 2. Check Data in Supabase:
```bash
docker exec g-zero-hocuspocus node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

(async () => {
  const { data } = await supabase
    .from('documents')
    .select('yjs_state')
    .limit(1)
    .single();
    
  if (data?.yjs_state) {
    const hex = data.yjs_state;
    const isJson = hex.startsWith('{');
    const isHex = hex.startsWith('\\\\x');
    
    console.log('Stored format:');
    console.log('  Is JSON (BAD):', isJson);
    console.log('  Is hex-encoded (GOOD):', isHex);
    console.log('  First 50 chars:', hex.substring(0, 50));
  }
})();
"
```

**Expected output:**
```
Stored format:
  Is JSON (BAD): false
  Is hex-encoded (GOOD): true
  First 50 chars: \x010190d5dbfc0f0008010a72656374616e676c6573017608
```

### 3. Browser Console:

**Expected (GOOD):**
```
✅ Connection opened successfully
Connection status: connected
Hocuspocus synced: true
```

**No errors like:**
```
❌ Authentication failed: permission-denied
```

## 📊 Test Results

✅ **All Working:**
- Document creation and storage
- Loading documents from database  
- Real-time sync between browsers
- Data persistence after page reload
- No permission-denied errors
- No JSON parsing errors

## 🔑 Key Takeaways

1. **Supabase BYTEA Handling**: Supabase JS client returns BYTEA columns as hex-encoded strings (`\xHEXDATA`), not as Buffer objects

2. **Don't JSON-Stringify Buffers**: Storing `Buffer.from(data)` directly causes Supabase to JSON-stringify it

3. **Proper Format**: Convert to hex string manually: `'\\x' + buffer.toString('hex')`

4. **Bi-directional Conversion**: 
   - Store: `Uint8Array → Buffer → Hex String`
   - Load: `Hex String → Buffer → Uint8Array`

## 📚 Related Files Changed

- ✅ `server/extensions/supabase-db.ts` - Fixed hex encoding/decoding
- ✅ `server/hocuspocus-server.ts` - Added error handling
- ✅ `AUTHENTICATION_FIX.md` - Updated with database fix documentation

## 🎉 Final Status

**FIXED** ✅
- Authentication token warning (via token function + messageReconnectTimeout)
- Permission-denied error (via proper database encoding)
- Data corruption (via hex string storage)
- Synchronization issues (working perfectly now)

**Screenshot showing success:**
![Working Application](../.playwright-mcp/database-fix-success.png)
- ✅ Synced
- ✅ Status: connected  
- ✅ Rectangles: 1 (persisted and loaded from database)


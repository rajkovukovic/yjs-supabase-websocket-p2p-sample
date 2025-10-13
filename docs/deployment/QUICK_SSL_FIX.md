# Quick SSL Fix for ERR_CERT_AUTHORITY_INVALID

## 🚨 Immediate Solution (2 minutes)

Your WebSocket is failing because Let's Encrypt SSL isn't configured yet. Here's the quick fix:

### Step 1: Update Environment Variables

**Edit your `web/.env.local` file** (or create from example):

```bash
cd web

# If .env.local doesn't exist
cp env.example .env.local

# Edit .env.local - change wss:// to ws://
nano .env.local  # or use your preferred editor
```

**Change this:**
```bash
NEXT_PUBLIC_HOCUSPOCUS_URL=wss://yjs-hocuspocus-89-116-28-108.traefik.me
NEXT_PUBLIC_SIGNALING_URL=wss://yjs-signaling-89-116-28-108.traefik.me
```

**To this:**
```bash
NEXT_PUBLIC_HOCUSPOCUS_URL=ws://yjs-hocuspocus-89-116-28-108.traefik.me
NEXT_PUBLIC_SIGNALING_URL=ws://yjs-signaling-89-116-28-108.traefik.me
```

### Step 2: Restart Dev Server

```bash
# Stop current server (Ctrl+C)
# Then restart:
npm run dev
# or
pnpm dev
```

### Step 3: Test Connection

Open browser console and check for:
```
✅ IndexedDB loaded
✅ Connection opened successfully
✅ Hocuspocus synced: true
```

**Should work now!** ✨

---

## 🔒 Proper SSL Setup (for production)

Once you're ready for SSL, configure Let's Encrypt in Dockploy:

### In Dockploy Dashboard:

1. **Go to your Hocuspocus service** → **Domains** tab

2. **Edit domain settings**:
   - Domain: `yjs-hocuspocus-89-116-28-108.traefik.me`
   - ✅ **Enable SSL/TLS**
   - ✅ **Certificate Provider**: Let's Encrypt
   - Email: `your-email@example.com`

3. **Repeat for Signaling service**

4. **Wait 1-5 minutes** for certificate generation

5. **Check logs** for:
   ```
   [Traefik] Certificate obtained successfully
   ```

### Update to wss://

Once SSL works:

```bash
# Edit web/.env.local
NEXT_PUBLIC_HOCUSPOCUS_URL=wss://yjs-hocuspocus-89-116-28-108.traefik.me
NEXT_PUBLIC_SIGNALING_URL=wss://yjs-signaling-89-116-28-108.traefik.me
```

Restart dev server and you're done! 🎉

---

## 🧪 Test Your Setup

Run the test script:

```bash
./scripts/test-websocket.sh
```

This will check:
- ✅ Server connectivity
- ✅ SSL certificate status
- ✅ DNS resolution
- ✅ Configuration issues

---

## 📱 Browser Security Note

| Your Setup | Works? | Notes |
|------------|--------|-------|
| Frontend: `http://localhost:3000`<br>Backend: `ws://domain.com` | ✅ | Development - OK |
| Frontend: `http://localhost:3000`<br>Backend: `wss://domain.com` | ✅ | Also works |
| Frontend: `https://domain.com`<br>Backend: `wss://domain.com` | ✅ | Production - Required |
| Frontend: `https://domain.com`<br>Backend: `ws://domain.com` | ❌ | **Browsers block mixed content!** |

**Key Point**: If your Next.js app uses `https://`, you MUST use `wss://` for WebSocket.

---

## 🆘 Still Not Working?

### Check Dockploy Service Status

1. **Dockploy Dashboard** → Services
2. Verify both services are **running** (green status)
3. Check **Logs** for errors

### Check Firewall

Your server must allow:
- Port **80** (HTTP - for Let's Encrypt challenge)
- Port **443** (HTTPS)
- Port **1234** (Hocuspocus WebSocket)
- Port **4445** (Signaling WebSocket)

### Check Service Ports in Dockploy

Make sure services expose correct ports:

**Hocuspocus:**
- Container Port: `1234`
- Public Port: `1234`

**Signaling:**
- Container Port: `4445`
- Public Port: `4445`

### Still Stuck?

See full guide: [`DOCKPLOY_SSL_TROUBLESHOOTING.md`](./DOCKPLOY_SSL_TROUBLESHOOTING.md)

---

## ✅ Quick Checklist

- [ ] Changed `wss://` to `ws://` in `.env.local`
- [ ] Restarted dev server
- [ ] Opened `http://localhost:3000/document/test`
- [ ] Checked browser console (no SSL errors)
- [ ] Multiple tabs sync in real-time
- [ ] Works! 🎉

**For production**: Enable SSL in Dockploy → Change back to `wss://`


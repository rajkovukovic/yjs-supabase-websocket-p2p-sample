# Dockploy SSL Troubleshooting Guide

## Issue: `ERR_CERT_AUTHORITY_INVALID` with Let's Encrypt

This error occurs when SSL certificates haven't been properly issued or configured in Dockploy.

---

## Quick Fix: Use Unencrypted WebSocket (Temporary)

**Update your `.env.local` file:**

```bash
# Use ws:// instead of wss:// until SSL is configured
NEXT_PUBLIC_HOCUSPOCUS_URL=ws://yjs-hocuspocus-89-116-28-108.traefik.me
NEXT_PUBLIC_SIGNALING_URL=ws://yjs-signaling-89-116-28-108.traefik.me
NEXT_PUBLIC_WEBRTC_PASSWORD=your-secure-password
```

**Restart your dev server:**
```bash
npm run dev
```

⚠️ **Note**: Using `ws://` (unencrypted) works fine for development but should use `wss://` (SSL) in production.

---

## Proper Fix: Configure SSL in Dockploy

### Step 1: Verify Domain Configuration

1. **Go to Dockploy Dashboard** → Your Project
2. **Check each service** (Hocuspocus, Signaling, Web):
   - Click on the service
   - Go to **"Domains"** or **"Settings"** tab
   - Verify the Traefik domain is correctly set

### Step 2: Enable Let's Encrypt SSL

For **each service** (Hocuspocus, Signaling):

1. **Go to Service Settings** → **Domains**
2. **Add/Edit Domain**:
   ```
   Domain: yjs-hocuspocus-89-116-28-108.traefik.me
   ✅ Enable SSL/TLS
   ✅ Auto-generate Let's Encrypt certificate
   ```

3. **Important Settings**:
   - **Protocol**: Select `https` or check "Enable SSL"
   - **Certificate Provider**: Let's Encrypt
   - **Email**: Your email for Let's Encrypt notifications
   - **Auto-renew**: Enabled (should be default)

### Step 3: Wait for Certificate Generation

Let's Encrypt can take **1-5 minutes** to issue certificates:

1. **Check Dockploy Logs**:
   - Go to Service → **Logs** tab
   - Look for messages like:
     ```
     [Traefik] Generating Let's Encrypt certificate...
     [Traefik] Certificate obtained successfully
     ```

2. **Common Issues**:
   - ❌ **Rate limit exceeded**: Let's Encrypt has rate limits (5 certs/domain/week)
   - ❌ **Domain not accessible**: DNS must resolve to your server
   - ❌ **Port 80/443 blocked**: Firewall must allow these ports

### Step 4: Verify SSL Certificate

**Test in browser:**
```
https://yjs-hocuspocus-89-116-28-108.traefik.me
```

- ✅ **Should show**: Valid certificate (green lock icon)
- ❌ **Shows error**: SSL not configured or cert failed

**Test with curl:**
```bash
curl -I https://yjs-hocuspocus-89-116-28-108.traefik.me
```

**Expected output:**
```
HTTP/2 200
server: Traefik
...
```

### Step 5: Update Environment Variables

Once SSL works, update to `wss://`:

```bash
# .env.local
NEXT_PUBLIC_HOCUSPOCUS_URL=wss://yjs-hocuspocus-89-116-28-108.traefik.me
NEXT_PUBLIC_SIGNALING_URL=wss://yjs-signaling-89-116-28-108.traefik.me
NEXT_PUBLIC_WEBRTC_PASSWORD=your-secure-password
```

---

## Alternative: Use Custom Domain with DNS

Traefik domains (`*.traefik.me`) may have SSL issues. Use your own domain:

### Option 1: Custom Domain

1. **Register domain** (e.g., `yourdomain.com`)
2. **Add DNS A Record**:
   ```
   hocuspocus.yourdomain.com → 89.116.28.108
   signaling.yourdomain.com  → 89.116.28.108
   ```

3. **Configure in Dockploy**:
   - Service → Domains → Add:
     ```
     hocuspocus.yourdomain.com
     ✅ Enable SSL/TLS (Let's Encrypt)
     ```

4. **Update env vars**:
   ```bash
   NEXT_PUBLIC_HOCUSPOCUS_URL=wss://hocuspocus.yourdomain.com
   NEXT_PUBLIC_SIGNALING_URL=wss://signaling.yourdomain.com
   ```

---

## Debugging SSL Issues

### Check Traefik Dashboard

1. **Access Traefik Dashboard** (if enabled):
   ```
   https://your-dockploy-domain.com/traefik
   ```

2. **Check**:
   - **HTTP Routers**: Verify domains are listed
   - **Middlewares**: Check redirect rules
   - **Certificates**: Verify Let's Encrypt certs

### Check Dockploy Server Logs

**SSH into your server:**
```bash
ssh user@89.116.28.108

# Check Traefik logs
docker logs traefik

# Check certificate resolver logs
docker logs traefik 2>&1 | grep -i "certificate"

# Check Let's Encrypt errors
docker logs traefik 2>&1 | grep -i "acme"
```

### Common Let's Encrypt Errors

**Error: `acme: error: 400`**
```
Solution: Domain not reachable. Check DNS and firewall.
```

**Error: `rate limit exceeded`**
```
Solution: Wait 1 week or use staging environment for testing.
```

**Error: `connection refused`**
```
Solution: Port 80 must be accessible for HTTP-01 challenge.
```

---

## Production Checklist

Once everything works:

- [ ] SSL certificates generated and valid
- [ ] Environment variables use `wss://` 
- [ ] Test WebSocket connection in browser
- [ ] Check browser console for connection errors
- [ ] Verify multiple clients can connect
- [ ] Test on mobile/different networks

---

## Browser Security Note

**Mixed Content Warning**: If your frontend uses `https://` but connects to `ws://`, browsers block it.

**Solutions**:
1. ✅ Use `wss://` for production (recommended)
2. ⚠️ Use `ws://` only if frontend is also `http://`
3. ❌ Don't mix `https://` frontend with `ws://` backend

---

## Quick Reference

| Environment | Frontend | WebSocket | Notes |
|-------------|----------|-----------|-------|
| Local Dev | `http://localhost:3000` | `ws://localhost:1234` | ✅ Works |
| Dev Server (no SSL) | `http://domain.com` | `ws://domain.com` | ✅ Works |
| Production (SSL) | `https://domain.com` | `wss://domain.com` | ✅ Required |
| **Mixed (blocked)** | `https://domain.com` | `ws://domain.com` | ❌ Browser blocks |

---

## Next Steps

1. **For now**: Use `ws://` to test functionality
2. **Fix SSL**: Follow steps above to enable Let's Encrypt
3. **Switch to `wss://`**: Once certificates work
4. **Production**: Always use `wss://` with proper domain

Need help? Check:
- Dockploy logs for certificate generation status
- Traefik dashboard for routing issues
- Browser console for WebSocket connection errors


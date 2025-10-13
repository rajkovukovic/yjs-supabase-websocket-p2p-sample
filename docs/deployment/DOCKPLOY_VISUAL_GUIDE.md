# Dockploy Visual Configuration Guide

Step-by-step visual guide for deploying to Dockploy with screenshots and exact settings.

## 🎯 Overview: 3 Services to Configure

```
Service 1: Hocuspocus (WebSocket Backend)
    ↓
Service 2: Signaling (WebRTC Backend)  
    ↓
Service 3: Web App (Next.js Frontend)
```

---

## 📋 Service 1: Hocuspocus Server

### Step 1: Create New Service

1. Click **"New Service"** button
2. Select **"Docker"** as service type
3. Enter service name: `yjs-hocuspocus`

### Step 2: Build Configuration

**Build Type Section:**
```
☑ Dockerfile (select this option)
☐ Nixpacks
☐ Heroku Buildpacks
☐ Paketo Buildpacks
☐ Static
```

**Repository Settings:**
```
Repository URL: https://github.com/yourusername/g_zero_yjs_sample
Branch: main
Dockerfile Path: server/Dockerfile.hocuspocus
Context Path: server
```

### Step 3: Environment Variables

Click **"Add Environment Variable"** and add each:

```
Key: SUPABASE_URL
Value: https://xxxxx.supabase.co
□ Secret (unchecked - not sensitive)

Key: SUPABASE_SERVICE_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
☑ Secret (checked - sensitive!)

Key: HOCUSPOCUS_PORT
Value: 1234

Key: NODE_ENV
Value: production

Key: CORS_ORIGIN
Value: *
```

### Step 4: Network Settings

```
Container Port: 1234
Protocol: HTTP
☑ Enable WebSocket Support (IMPORTANT!)
```

### Step 5: Domain

```
Option A: Use Dockploy subdomain
  → yjs-hocuspocus.dockploy.app

Option B: Custom domain
  → hocuspocus.yourdomain.com
  ☑ Enable SSL/TLS (required for wss://)
```

### Step 6: Deploy

1. Click **"Save"** button
2. Click **"Deploy"** button
3. Watch build logs
4. Wait for ✅ "Running" status

**Save this URL for later:**
```
wss://yjs-hocuspocus.dockploy.app
```

---

## 📋 Service 2: Signaling Server

### Step 1: Create New Service

1. Click **"New Service"** button
2. Select **"Docker"**
3. Enter name: `yjs-signaling`

### Step 2: Build Configuration

**Build Type:**
```
☑ Dockerfile
```

**Repository Settings:**
```
Repository URL: https://github.com/yourusername/g_zero_yjs_sample
Branch: main
Dockerfile Path: server/Dockerfile.signaling
Context Path: server
```

### Step 3: Environment Variables

```
Key: SIGNALING_PORT
Value: 4445

Key: NODE_ENV
Value: production
```

### Step 4: Network Settings

```
Container Port: 4445
Protocol: HTTP
☑ Enable WebSocket Support
```

### Step 5: Domain

```
Use subdomain: yjs-signaling.dockploy.app
OR
Custom domain: signaling.yourdomain.com
☑ Enable SSL/TLS
```

### Step 6: Deploy

Click **"Deploy"** and wait for ✅

**Save this URL:**
```
wss://yjs-signaling.dockploy.app
```

---

## 📋 Service 3: Web App (Frontend)

### Step 1: Create New Service

1. Click **"New Service"**
2. Select **"Docker"**
3. Enter name: `yjs-web`

### Step 2: Build Configuration

**Build Type:**
```
☑ Dockerfile
```

**Repository Settings:**
```
Repository URL: https://github.com/yourusername/g_zero_yjs_sample
Branch: main
Dockerfile Path: web/Dockerfile
Context Path: web
```

### Step 3: Environment Variables

**Use URLs from Services 1 & 2:**

```
Key: NEXT_PUBLIC_SUPABASE_URL
Value: https://xxxxx.supabase.co

Key: NEXT_PUBLIC_SUPABASE_ANON_KEY
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

Key: NEXT_PUBLIC_HOCUSPOCUS_URL
Value: wss://yjs-hocuspocus.dockploy.app

Key: NEXT_PUBLIC_SIGNALING_URL
Value: wss://yjs-signaling.dockploy.app

Key: NEXT_PUBLIC_WEBRTC_PASSWORD
Value: my-secure-password-123
```

### Step 4: Network Settings

```
Container Port: 3000
Protocol: HTTP
☐ WebSocket Support (not needed - client handles it)
```

### Step 5: Domain

```
Use subdomain: yjs-web.dockploy.app
OR
Custom domain: app.yourdomain.com
☑ Enable SSL/TLS
```

### Step 6: Deploy

Click **"Deploy"** → Wait for ✅

**Your app is live at:**
```
https://yjs-web.dockploy.app
```

---

## ✅ Verification Steps

### 1. Check All Services Running

In Dockploy dashboard:

```
✅ yjs-hocuspocus  |  Running  |  wss://yjs-hocuspocus.dockploy.app
✅ yjs-signaling   |  Running  |  wss://yjs-signaling.dockploy.app
✅ yjs-web        |  Running  |  https://yjs-web.dockploy.app
```

### 2. Test Web App

1. Visit: `https://yjs-web.dockploy.app`
2. Open DevTools Console (F12)
3. Should see:

```
✓ IndexedDB loaded
✓ Hocuspocus synced: true
✓ Connection status: connected
✓ WebRTC synced: true
✓ P2P peers: { total: 0 }
```

### 3. Test Collaboration

1. **Browser 1**: Open `https://yjs-web.dockploy.app/document/test`
2. **Browser 2**: Open same URL in incognito/another browser
3. In Browser 1: Click canvas to create rectangle
4. **Result**: Rectangle appears in Browser 2 instantly ✅

### 4. Check Logs

For each service, click **"Logs"** tab:

**Hocuspocus logs should show:**
```
✅ Hocuspocus server running on port 1234
Connected to Supabase
Document loaded: test
```

**Signaling logs should show:**
```
✅ Signaling server running on port 4445
Client connected: abc123
Client abc123 joined room test. Total: 1
```

**Web logs should show:**
```
✓ Ready in 1234ms
✓ Compiled /document/[id] in 567ms
```

---

## 🔧 Advanced Settings

### Auto-Deploy on Push

For each service:

1. Go to service settings
2. Find **"Deployment"** section
3. Toggle **"Auto Deploy"** ON
4. Add GitHub webhook URL to your repo
5. Now `git push` → auto-redeploys

### Health Checks

Already configured in Dockerfiles:

```
Hocuspocus: HTTP GET :1234
Signaling: HTTP GET :4445  
Web App: HTTP GET :3000
```

Dockploy automatically monitors and restarts if unhealthy.

### Resource Limits

Click **"Resources"** tab for each service:

**Development:**
- CPU: 1 core
- Memory: 512 MB

**Production:**
- Hocuspocus: 2 cores, 2 GB
- Signaling: 1 core, 1 GB
- Web: 1 core, 1 GB

### Scaling

For multiple instances:

1. Go to service settings
2. **"Scaling"** section
3. Set **Replicas**: 2 or more
4. Enable **Load Balancer**

---

## 📊 Monitoring Dashboard

### Metrics to Watch

**Hocuspocus:**
- Active connections
- Messages per second
- Database queries
- Memory usage

**Signaling:**
- WebRTC connections
- Rooms active
- CPU usage

**Web App:**
- Page load time
- Request rate
- Error rate

### Alerts

Set up alerts for:
- Service down (>1 min)
- High memory (>80%)
- Error rate spike (>5%)
- Response time (>2s)

---

## 🎨 Custom Domains Setup

### If Using Custom Domain:

1. **In Dockploy:**
   - Add domain: `app.yourdomain.com`
   - Enable SSL (auto Let's Encrypt)
   - Copy the IP address shown

2. **In Your DNS Provider:**
   - Add A record:
     ```
     Type: A
     Name: app (or hocuspocus, signaling)
     Value: [Dockploy IP address]
     TTL: 3600
     ```

3. **Wait for DNS:**
   - Usually 5-60 minutes
   - Check: `nslookup app.yourdomain.com`

4. **SSL Certificate:**
   - Auto-issued by Dockploy
   - Renews automatically

---

## 🔄 Update/Redeploy

### Manual Update

1. Push changes to GitHub
2. Go to Dockploy dashboard
3. Click service → **"Redeploy"**
4. Confirm and wait for build

### Automatic Update

With auto-deploy enabled:
```bash
git add .
git commit -m "Update feature"
git push origin main
# → Dockploy auto-rebuilds
```

### Zero-Downtime Deploy

Dockploy does rolling updates:
1. Builds new version
2. Starts new container
3. Health check passes
4. Routes traffic to new version
5. Stops old container

---

## 🚨 Common Issues & Fixes

### Build Fails

**Error:** `pnpm: not found`
```
✓ Fix: Dockerfile already uses corepack to enable pnpm
✓ Check: Ensure pnpm-lock.yaml is committed
```

**Error:** `Cannot find module`
```
✓ Fix: Verify Context Path is correct (server or web)
✓ Check: node_modules in .dockerignore
```

### WebSocket Connection Fails

**Error in console:** `WebSocket connection failed`
```
✓ Fix: Enable "WebSocket Support" in network settings
✓ Check: Use wss:// not ws:// (SSL required)
✓ Verify: Backend service is running
```

### CORS Error

**Error:** `CORS policy: No 'Access-Control-Allow-Origin'`
```
✓ Fix: Add web app URL to CORS_ORIGIN in server
✓ Example: CORS_ORIGIN=https://yjs-web.dockploy.app
✓ Or use: CORS_ORIGIN=* (development only)
```

### Database Connection Error

**Error in logs:** `Database connection failed`
```
✓ Fix: Check SUPABASE_SERVICE_KEY is correct
✓ Verify: Using service_role key (not anon key)
✓ Test: Supabase project is active
```

---

## 📋 Deployment Checklist

Before clicking Deploy:

### Supabase Setup
- [ ] Project created
- [ ] Schema executed (`supabase-schema.sql`)
- [ ] API keys copied (URL, anon key, service key)

### Hocuspocus Service
- [ ] Build Type: Dockerfile
- [ ] Dockerfile Path: `server/Dockerfile.hocuspocus`
- [ ] Context Path: `server`
- [ ] All environment variables added
- [ ] WebSocket enabled
- [ ] SSL/TLS enabled
- [ ] Deployed successfully

### Signaling Service
- [ ] Build Type: Dockerfile
- [ ] Dockerfile Path: `server/Dockerfile.signaling`
- [ ] Context Path: `server`
- [ ] Environment variables added
- [ ] WebSocket enabled
- [ ] SSL/TLS enabled
- [ ] Deployed successfully

### Web App Service
- [ ] Build Type: Dockerfile
- [ ] Dockerfile Path: `web/Dockerfile`
- [ ] Context Path: `web`
- [ ] All NEXT_PUBLIC_* variables added
- [ ] Backend URLs from previous services
- [ ] SSL/TLS enabled
- [ ] Deployed successfully

### Verification
- [ ] All services showing "Running" status
- [ ] Web app loads in browser
- [ ] Console shows no errors
- [ ] Collaboration test works
- [ ] Logs look healthy

---

## 🎉 Success Checklist

Your deployment is successful when:

✅ All 3 services are **green/running** in Dockploy
✅ Web app loads at your domain
✅ DevTools console shows all connections **synced**
✅ Creating shapes in one browser → appears in another
✅ No errors in any service logs
✅ Health checks passing

**You're live! 🚀**

Share your app:
```
https://yjs-web.dockploy.app/document/welcome
```

---

## 📞 Getting Help

If stuck:

1. **Check Logs:**
   - Dockploy dashboard → Service → Logs tab
   - Look for error messages

2. **Review Settings:**
   - Double-check all environment variables
   - Verify Dockerfile paths
   - Confirm WebSocket enabled

3. **Test Locally:**
   - Run `docker build` locally
   - Ensure it works before deploying

4. **Consult Docs:**
   - [Dockploy Docs](https://dockploy.com/docs)
   - [Main Deployment Guide](./DOCKPLOY_DEPLOYMENT_GUIDE.md)

---

**Next Steps:** [Secure Your Deployment](./SECURITY.md) | [Performance Tuning](./PERFORMANCE.md)


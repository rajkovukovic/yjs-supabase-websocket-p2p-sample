# Deploy Backend with Docker Compose on Dockploy

## 🎯 Simplified Deployment: 2 Services Instead of 3

Instead of deploying Hocuspocus and Signaling as separate services, you can deploy them together using Docker Compose!

### Deployment Structure

**Option A: Separate Services** (3 deployments)
```
1. Hocuspocus Service
2. Signaling Service  
3. Web App Service
```

**Option B: Docker Compose** (2 deployments) ✅ **Recommended**
```
1. Backend Services (Hocuspocus + Signaling via Docker Compose)
2. Web App Service
```

---

## 🚀 Quick Setup (Docker Compose Method)

### Step 1: Deploy Backend (Both Services)

1. **Create New Service** in Dockploy
   - Click **"New Service"** → **"Docker Compose"**
   - Name: `yjs-backend`

2. **Build Configuration**:
   ```
   Repository URL: https://github.com/yourusername/g_zero_yjs_sample
   Branch: main
   Docker Compose File: server/docker-compose.prod.yml
   Context Path: server
   ```

3. **Environment Variables**:
   ```env
   SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_SERVICE_KEY=your-service-role-key-here
   CORS_ORIGIN=*
   ```

4. **Port Mapping**:
   
   **Hocuspocus Service:**
   - Service Name: `hocuspocus`
   - Container Port: `1234`
   - Domain: `hocuspocus.yourdomain.com` or subdomain
   - ☑ Enable WebSocket Support
   - ☑ Enable SSL/TLS

   **Signaling Service:**
   - Service Name: `signaling`
   - Container Port: `4444`
   - Domain: `signaling.yourdomain.com` or subdomain
   - ☑ Enable WebSocket Support
   - ☑ Enable SSL/TLS

5. **Deploy** and wait for build

---

### Step 2: Deploy Frontend (Web App)

1. **Create New Service** in Dockploy
   - Click **"New Service"** → **"Docker"**
   - Name: `yjs-web`

2. **Build Configuration**:
   ```
   Build Type: Dockerfile
   Repository: https://github.com/yourusername/g_zero_yjs_sample
   Branch: main
   Dockerfile Path: web/Dockerfile
   Context Path: web
   ```

3. **Environment Variables** (use URLs from Step 1):
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   NEXT_PUBLIC_HOCUSPOCUS_URL=wss://hocuspocus.yourdomain.com
   NEXT_PUBLIC_SIGNALING_URL=wss://signaling.yourdomain.com
   NEXT_PUBLIC_WEBRTC_PASSWORD=your-secure-password
   ```

4. **Network Settings**:
   ```
   Container Port: 3000
   Protocol: HTTP
   ```

5. **Domain**:
   - Set domain: `app.yourdomain.com`
   - ☑ Enable SSL/TLS

6. **Deploy**

---

## 📋 Dockploy Configuration Reference

### Service 1: Backend (Docker Compose)

**In Dockploy Dashboard:**

```yaml
Service Type: Docker Compose
Name: yjs-backend
Repository: [YOUR_GITHUB_REPO]
Branch: main
Compose File Path: server/docker-compose.prod.yml
Working Directory: server

Environment Variables:
  SUPABASE_URL: https://xxxxx.supabase.co
  SUPABASE_SERVICE_KEY: eyJhbG...
  CORS_ORIGIN: *

Services to Expose:
  hocuspocus:
    - Port: 1234
    - Domain: hocuspocus.yourdomain.com
    - WebSocket: Enabled
    - SSL: Enabled
  
  signaling:
    - Port: 4444
    - Domain: signaling.yourdomain.com
    - WebSocket: Enabled
    - SSL: Enabled
```

### Service 2: Web App (Dockerfile)

**In Dockploy Dashboard:**

```yaml
Service Type: Docker (Dockerfile)
Name: yjs-web
Repository: [YOUR_GITHUB_REPO]
Branch: main
Dockerfile Path: web/Dockerfile
Context Path: web

Environment Variables:
  NEXT_PUBLIC_SUPABASE_URL: https://xxxxx.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY: eyJhbG...
  NEXT_PUBLIC_HOCUSPOCUS_URL: wss://hocuspocus.yourdomain.com
  NEXT_PUBLIC_SIGNALING_URL: wss://signaling.yourdomain.com
  NEXT_PUBLIC_WEBRTC_PASSWORD: secure-password

Network:
  - Port: 3000
  - Domain: app.yourdomain.com
  - SSL: Enabled
```

---

## ✅ Verification

### 1. Check Services Running

In Dockploy dashboard, you should see:

```
✅ yjs-backend (Docker Compose)
   ├── hocuspocus  - Running - wss://hocuspocus.yourdomain.com
   └── signaling   - Running - wss://signaling.yourdomain.com

✅ yjs-web (Docker)
   └── Running - https://app.yourdomain.com
```

### 2. Test Backend Services

**Test Hocuspocus:**
```bash
curl https://hocuspocus.yourdomain.com
# Should return 200 OK
```

**Test Signaling:**
```bash
curl https://signaling.yourdomain.com
# Should return 200 OK
```

### 3. Test Web App

1. Visit: `https://app.yourdomain.com`
2. Open DevTools Console (F12)
3. Should see:
   ```
   ✓ Hocuspocus synced: true
   ✓ Connection status: connected
   ✓ WebRTC synced: true
   ```

### 4. Test Collaboration

1. Open `https://app.yourdomain.com/document/test` in Browser 1
2. Open same URL in Browser 2 (incognito)
3. Create rectangle in Browser 1
4. Should appear in Browser 2 instantly ✅

---

## 🔧 Docker Compose File Explained

**`server/docker-compose.prod.yml`:**

```yaml
version: '3.8'

services:
  # Service 1: Hocuspocus (WebSocket Collaboration)
  hocuspocus:
    build:
      context: .
      dockerfile: Dockerfile.hocuspocus
    ports:
      - "1234:1234"  # Expose port for Dockploy
    environment:
      # These come from Dockploy environment variables
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}
      - CORS_ORIGIN=${CORS_ORIGIN:-*}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:1234"]
      interval: 30s

  # Service 2: Signaling (WebRTC P2P)
  signaling:
    build:
      context: .
      dockerfile: Dockerfile.signaling
    ports:
      - "4444:4444"  # Expose port for Dockploy
    environment:
      - SIGNALING_PORT=4444
      - CORS_ORIGIN=${CORS_ORIGIN:-*}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:4444/health"]
      interval: 30s

networks:
  collab-network:
    driver: bridge
```

---

## 🎨 Architecture Diagram

```
┌─────────────────────────────────────────┐
│         Dockploy Platform               │
├─────────────────────────────────────────┤
│                                         │
│  📦 Service 1: yjs-backend (Compose)   │
│  ┌─────────────────────────────────┐   │
│  │  🔹 hocuspocus:1234             │   │
│  │     wss://hocuspocus.domain.com │   │
│  │                                  │   │
│  │  🔹 signaling:4444              │   │
│  │     wss://signaling.domain.com  │   │
│  └─────────────────────────────────┘   │
│                                         │
│  📦 Service 2: yjs-web (Docker)        │
│  ┌─────────────────────────────────┐   │
│  │  🌐 Next.js App:3000            │   │
│  │     https://app.domain.com      │   │
│  └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
           ↓
    ┌──────────────┐
    │   Supabase   │
    │  (Database)  │
    └──────────────┘
```

---

## 📊 Comparison: Separate vs Docker Compose

| Aspect | Separate Services | Docker Compose |
|--------|------------------|----------------|
| **Services to Deploy** | 3 (Hocuspocus + Signaling + Web) | 2 (Backend + Web) |
| **Configuration Complexity** | Medium | Low |
| **Network Setup** | Manual (if needed) | Automatic (shared network) |
| **Updates** | Update each separately | Update backend together |
| **Resource Isolation** | High | Medium |
| **Deployment Time** | ~30 min | ~20 min |
| **Management** | 3 services to monitor | 2 services to monitor |
| **Recommended For** | Large scale, need isolation | MVP, small-medium scale |

**Recommendation:** Use Docker Compose for MVP and initial deployment. Switch to separate services if you need independent scaling.

---

## 🐛 Troubleshooting

### Issue: Services Can't Communicate

**Symptoms:** Logs show connection errors between services

**Solution:**
```yaml
# Both services are on same network in docker-compose.prod.yml
networks:
  collab-network:
    driver: bridge
```

### Issue: Port Conflicts

**Symptoms:** "Port already in use" error

**Solution:**
- Ensure no other services use ports 1234 or 4444
- In Dockploy, each service gets isolated networking

### Issue: Environment Variables Not Set

**Symptoms:** Services fail to start, missing env vars

**Solution:**
1. Check Dockploy environment variables are set
2. Verify variable names match docker-compose.prod.yml
3. Restart deployment after adding variables

### Issue: WebSocket Connection Failed

**Symptoms:** Console shows "WebSocket connection failed"

**Solution:**
1. ✅ Enable "WebSocket Support" for both hocuspocus and signaling
2. ✅ Use `wss://` in web app URLs (not `ws://`)
3. ✅ Ensure SSL/TLS is enabled on both services

---

## 🔄 Updating Your Deployment

### To Update Backend Services:

1. Push changes to GitHub
2. In Dockploy, click **"Redeploy"** on `yjs-backend`
3. Both Hocuspocus and Signaling rebuild together
4. Zero-downtime deployment (new containers replace old)

### To Update Web App:

1. Push changes to GitHub
2. In Dockploy, click **"Redeploy"** on `yjs-web`
3. Frontend rebuilds independently

---

## 🚀 Quick Command Reference

### Local Testing (Before Deploying)

```bash
# Test Docker Compose build locally
cd server
docker-compose -f docker-compose.prod.yml build

# Start services locally
docker-compose -f docker-compose.prod.yml up

# Stop services
docker-compose -f docker-compose.prod.yml down
```

### Logs (In Dockploy)

- Click service → **Logs** tab
- Filter by container: `hocuspocus` or `signaling`
- Download logs for debugging

---

## ✅ Final Checklist

Before deploying with Docker Compose:

- [ ] Supabase project created
- [ ] Database schema executed
- [ ] API keys ready (URL, anon, service_role)
- [ ] Code pushed to GitHub
- [ ] `docker-compose.prod.yml` exists in `server/`
- [ ] Environment variables prepared
- [ ] Dockploy account ready

---

## 🎉 Success!

With Docker Compose deployment:
- ✅ **2 services** to manage (instead of 3)
- ✅ **Simpler** configuration
- ✅ **Shared network** between backend services
- ✅ **Faster** deployment
- ✅ **Easier** updates

**Estimated deployment time: 20-25 minutes** ⏱️

---

## 📚 Related Documentation

- [Main Deployment Guide](./DOCKPLOY_DEPLOYMENT_GUIDE.md)
- [Quick Start](./DOCKPLOY_QUICKSTART.md)
- [Visual Guide](./DOCKPLOY_VISUAL_GUIDE.md)
- [Troubleshooting](./DOCKPLOY_DEPLOYMENT_GUIDE.md#troubleshooting)

---

**Ready to deploy?** Follow the steps above and you'll have your backend running in minutes! 🚀


# 🚀 Simplified Dockploy Deployment (Docker Compose)

## TL;DR - Deploy in 20 Minutes

Deploy your Rectangles Editor with just **2 services** using Docker Compose!

---

## 📦 What You'll Deploy

```
┌─────────────────────────────────┐
│  Service 1: Backend (Compose)   │
│  ├── Hocuspocus (WebSocket)     │
│  └── Signaling (WebRTC)         │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│  Service 2: Frontend (Docker)   │
│  └── Next.js Web App            │
└─────────────────────────────────┘
```

---

## ⚡ Quick Deploy Steps

### 1. Setup Supabase (5 min)

1. Create project at [supabase.com](https://supabase.com)
2. Go to SQL Editor
3. Run this schema:

```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  yjs_state BYTEA,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE document_updates (
  id BIGSERIAL PRIMARY KEY,
  document_name TEXT REFERENCES documents(name) ON DELETE CASCADE,
  update BYTEA NOT NULL,
  client_id TEXT,
  clock BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_doc_name ON documents(name);
CREATE INDEX idx_updates_doc ON document_updates(document_name);
```

4. Get API keys from **Settings → API**:
   - Project URL
   - `anon` public key  
   - `service_role` key

---

### 2. Deploy Backend with Docker Compose (8 min)

**In Dockploy:**

1. Click **"New Service"** → **"Docker Compose"**

2. **Service Settings:**
   ```
   Name: yjs-backend
   Repository: https://github.com/yourusername/g_zero_yjs_sample
   Branch: main
   Compose File: server/docker-compose.prod.yml
   Working Directory: server
   ```

3. **Environment Variables:**
   ```env
   SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_SERVICE_KEY=eyJhbG...
   CORS_ORIGIN=*
   ```

4. **Configure Ports & Domains:**
   
   **Hocuspocus:**
   - Port: `1234`
   - Domain: `hocuspocus.yourdomain.com`
   - ☑ WebSocket Support
   - ☑ SSL/TLS

   **Signaling:**
   - Port: `4444`
   - Domain: `signaling.yourdomain.com`
   - ☑ WebSocket Support
   - ☑ SSL/TLS

5. Click **Deploy** → Wait for ✅

---

### 3. Deploy Frontend (7 min)

**In Dockploy:**

1. Click **"New Service"** → **"Docker"**

2. **Service Settings:**
   ```
   Name: yjs-web
   Build Type: Dockerfile
   Repository: https://github.com/yourusername/g_zero_yjs_sample
   Branch: main
   Dockerfile Path: web/Dockerfile
   Context Path: web
   ```

3. **Environment Variables:**
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
   NEXT_PUBLIC_HOCUSPOCUS_URL=wss://hocuspocus.yourdomain.com
   NEXT_PUBLIC_SIGNALING_URL=wss://signaling.yourdomain.com
   NEXT_PUBLIC_WEBRTC_PASSWORD=secure-password-123
   ```

4. **Configure Port & Domain:**
   - Port: `3000`
   - Domain: `app.yourdomain.com`
   - ☑ SSL/TLS

5. Click **Deploy** → Wait for ✅

---

### 4. Test (2 min)

1. Visit: `https://app.yourdomain.com`
2. Open Console (F12) - should see:
   ```
   ✓ Hocuspocus synced: true
   ✓ Connection status: connected
   ✓ WebRTC synced: true
   ```

3. Open in 2 browsers → Create shapes → See real-time sync ✅

---

## 📋 Copy-Paste Configuration

### Service 1: Backend (Docker Compose)

```yaml
# In Dockploy UI:
Service Type: Docker Compose
Name: yjs-backend
Repository: [YOUR_REPO_URL]
Branch: main
Compose File Path: server/docker-compose.prod.yml
Working Directory: server

# Environment Variables:
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
CORS_ORIGIN=*

# Service: hocuspocus
#   Port: 1234
#   Domain: hocuspocus.yourdomain.com
#   WebSocket: ✓
#   SSL: ✓

# Service: signaling
#   Port: 4444
#   Domain: signaling.yourdomain.com
#   WebSocket: ✓
#   SSL: ✓
```

### Service 2: Frontend (Docker)

```yaml
# In Dockploy UI:
Service Type: Docker
Name: yjs-web
Build Type: Dockerfile
Repository: [YOUR_REPO_URL]
Branch: main
Dockerfile Path: web/Dockerfile
Context Path: web

# Environment Variables:
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_HOCUSPOCUS_URL=wss://hocuspocus.yourdomain.com
NEXT_PUBLIC_SIGNALING_URL=wss://signaling.yourdomain.com
NEXT_PUBLIC_WEBRTC_PASSWORD=secure-password-123

# Network:
#   Port: 3000
#   Domain: app.yourdomain.com
#   SSL: ✓
```

---

## ✅ Success Checklist

After deployment, verify:

- [ ] Both services show "Running" in Dockploy
- [ ] Web app loads at your domain
- [ ] Console shows all services connected
- [ ] Real-time collaboration works
- [ ] No errors in logs

---

## 🎯 Why Docker Compose?

### Benefits:
- ✅ **Simpler**: 2 services instead of 3
- ✅ **Faster**: Deploy backend together
- ✅ **Easier**: Single configuration
- ✅ **Network**: Services auto-connected
- ✅ **Updates**: Update backend as one unit

### Comparison:

| Method | Services | Config | Time |
|--------|----------|--------|------|
| **Separate** | 3 | Complex | 40 min |
| **Compose** | 2 | Simple | 20 min |

---

## 🔧 Common Issues

### WebSocket Connection Failed
```
✓ Solution: Enable "WebSocket Support" in Dockploy
✓ Use wss:// (not ws://) in environment variables
✓ Ensure SSL/TLS is enabled
```

### Database Connection Error
```
✓ Use SUPABASE_SERVICE_KEY (not anon key) in backend
✓ Verify Supabase project is active
✓ Check database schema is created
```

### Build Failed
```
✓ Verify compose file path: server/docker-compose.prod.yml
✓ Check context is set to: server
✓ Ensure pnpm-lock.yaml is committed
```

---

## 📚 Full Documentation

- [Docker Compose Guide](./DOCKPLOY_COMPOSE_GUIDE.md) - Detailed Docker Compose setup
- [Deployment Guide](./DOCKPLOY_DEPLOYMENT_GUIDE.md) - Complete deployment guide
- [Quick Reference](./DOCKPLOY_QUICKSTART.md) - Cheat sheet
- [Visual Guide](./DOCKPLOY_VISUAL_GUIDE.md) - Step-by-step with UI

---

## 🚀 Ready to Deploy?

1. **Push code to GitHub**
   ```bash
   git add .
   git commit -m "Ready for Dockploy deployment"
   git push origin main
   ```

2. **Follow steps above** (20 minutes total)

3. **Share your app** 🎉
   ```
   https://app.yourdomain.com/document/welcome
   ```

---

**Questions?** Check the [Full Docker Compose Guide](./DOCKPLOY_COMPOSE_GUIDE.md)


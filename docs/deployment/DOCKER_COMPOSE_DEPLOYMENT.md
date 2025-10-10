# ✅ Docker Compose Deployment - Setup Complete!

## 🎉 What's Ready

Your project is now configured for **simplified Docker Compose deployment** on Dockploy!

### 📦 New Files Created

1. ✅ **`server/docker-compose.prod.yml`** - Production-ready Docker Compose
2. ✅ **`DOCKPLOY_COMPOSE_GUIDE.md`** - Complete Docker Compose guide
3. ✅ **`DOCKPLOY_SIMPLIFIED.md`** - Quick start (20 min deployment)
4. ✅ **`DEPLOYMENT_OPTIONS.md`** - Compare all deployment methods

### 🔧 Existing Files (Already Ready)

- ✅ `server/Dockerfile.hocuspocus` - Hocuspocus build
- ✅ `server/Dockerfile.signaling` - Signaling build
- ✅ `web/Dockerfile` - Next.js build (created earlier)
- ✅ `web/next.config.js` - Updated with `output: 'standalone'`

---

## 🚀 Two Ways to Deploy

### Option A: Docker Compose (Recommended - 2 Services)

**Deployment:**
```
Service 1: Backend (Docker Compose)
  ├── Hocuspocus :1234
  └── Signaling :4444

Service 2: Frontend (Docker)
  └── Next.js :3000
```

**Time:** ~20 minutes  
**Guide:** [DOCKPLOY_SIMPLIFIED.md](./DOCKPLOY_SIMPLIFIED.md)

### Option B: Separate Services (3 Services)

**Deployment:**
```
Service 1: Hocuspocus :1234
Service 2: Signaling :4444
Service 3: Next.js :3000
```

**Time:** ~40 minutes  
**Guide:** [DOCKPLOY_QUICKSTART.md](./DOCKPLOY_QUICKSTART.md)

---

## 📋 Quick Start (Docker Compose Method)

### 1. Prepare Database (5 min)

```sql
-- In Supabase SQL Editor:
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

### 2. Push to GitHub

```bash
git add .
git commit -m "Add Docker Compose deployment configuration"
git push origin main
```

### 3. Deploy Backend (Dockploy - 8 min)

**Create Service:**
- Type: **Docker Compose**
- Name: `yjs-backend`
- Repo: `https://github.com/yourusername/g_zero_yjs_sample`
- Branch: `main`
- Compose File: `server/docker-compose.prod.yml`
- Context: `server`

**Environment Variables:**
```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
CORS_ORIGIN=*
```

**Expose Services:**
- **hocuspocus**: Port 1234 → Domain + WebSocket + SSL
- **signaling**: Port 4444 → Domain + WebSocket + SSL

### 4. Deploy Frontend (Dockploy - 7 min)

**Create Service:**
- Type: **Docker**
- Name: `yjs-web`
- Repo: Same as above
- Branch: `main`
- Dockerfile: `web/Dockerfile`
- Context: `web`

**Environment Variables:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_HOCUSPOCUS_URL=wss://hocuspocus.domain.com
NEXT_PUBLIC_SIGNALING_URL=wss://signaling.domain.com
NEXT_PUBLIC_WEBRTC_PASSWORD=secure-password
```

**Network:**
- Port: 3000
- Domain + SSL

---

## ✅ Verification

### Check Deployment Status

In Dockploy:
```
✅ yjs-backend (Docker Compose)
   ├── hocuspocus - Running
   └── signaling - Running

✅ yjs-web (Docker)
   └── Running
```

### Test Application

1. Visit: `https://your-app-domain.com`
2. Open Console (F12):
   ```
   ✓ IndexedDB loaded
   ✓ Hocuspocus synced: true
   ✓ Connection status: connected
   ✓ WebRTC synced: true
   ```

3. Test collaboration:
   - Open in 2 browsers
   - Create shapes
   - See real-time sync ✅

---

## 📚 Documentation Quick Links

### For Deployment

**Start Here (Recommended):**
- 🎯 [**DOCKPLOY_SIMPLIFIED.md**](./DOCKPLOY_SIMPLIFIED.md) - Quick Docker Compose deployment

**Detailed Guides:**
- 📦 [DOCKPLOY_COMPOSE_GUIDE.md](./DOCKPLOY_COMPOSE_GUIDE.md) - Complete Compose guide
- 📊 [DEPLOYMENT_OPTIONS.md](./DEPLOYMENT_OPTIONS.md) - Compare all methods

**Alternative Methods:**
- 📋 [DOCKPLOY_QUICKSTART.md](./DOCKPLOY_QUICKSTART.md) - Separate services (3 services)
- 📖 [DOCKPLOY_DEPLOYMENT_GUIDE.md](./DOCKPLOY_DEPLOYMENT_GUIDE.md) - Detailed separate services

### For Reference

- 📄 [README.md](./README.md) - Project overview
- 🔧 [server/README.md](./server/README.md) - Server configuration
- 🌐 [web/README.md](./web/README.md) - Web configuration

---

## 🎯 Recommended Path

### 1. First Time Deployment
→ Follow: [DOCKPLOY_SIMPLIFIED.md](./DOCKPLOY_SIMPLIFIED.md)
- Fastest (20 min)
- Simplest (2 services)
- Perfect for MVP

### 2. When You Need to Scale
→ Migrate to: Separate Services
- Better for 100+ users
- Independent scaling
- Follow: [DOCKPLOY_QUICKSTART.md](./DOCKPLOY_QUICKSTART.md)

---

## 🔑 Key Files Reference

### Docker Configuration

| File | Purpose | Used In |
|------|---------|---------|
| `server/docker-compose.prod.yml` | Backend services (Compose) | Docker Compose deployment |
| `server/Dockerfile.hocuspocus` | Hocuspocus build | Both methods |
| `server/Dockerfile.signaling` | Signaling build | Both methods |
| `web/Dockerfile` | Next.js build | Both methods |

### Environment Variables

| Location | Variables | Purpose |
|----------|-----------|---------|
| Backend (Compose/Separate) | `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | Database connection |
| Frontend | `NEXT_PUBLIC_*` | Client configuration |

---

## 🚨 Important Notes

### WebSocket Requirements
- ✅ **Enable WebSocket Support** in Dockploy for both hocuspocus and signaling
- ✅ Use `wss://` (not `ws://`) in frontend environment variables
- ✅ SSL/TLS must be enabled

### Environment Variables
- ✅ Use `SUPABASE_SERVICE_KEY` in backend (not anon key)
- ✅ Use `NEXT_PUBLIC_SUPABASE_ANON_KEY` in frontend (not service key)
- ✅ All `NEXT_PUBLIC_*` vars are exposed to browser

### File Paths in Dockploy
- ✅ Compose File: `server/docker-compose.prod.yml`
- ✅ Context: `server` (for backend)
- ✅ Context: `web` (for frontend)

---

## 🎉 You're All Set!

Everything is configured and ready to deploy. Choose your method:

### Quick Start (Recommended)
👉 **[Deploy with Docker Compose in 20 min](./DOCKPLOY_SIMPLIFIED.md)**

### Compare Options First
👉 **[See All Deployment Options](./DEPLOYMENT_OPTIONS.md)**

### Need More Details
👉 **[Complete Docker Compose Guide](./DOCKPLOY_COMPOSE_GUIDE.md)**

---

**Questions?** Check the guides above or review the [troubleshooting section](./DOCKPLOY_COMPOSE_GUIDE.md#troubleshooting).

**Ready to ship? Let's go! 🚀**


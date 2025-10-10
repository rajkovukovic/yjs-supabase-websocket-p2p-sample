# Dockploy Quick Start - Configuration Cheat Sheet

## 🎯 TL;DR - 3 Services to Deploy

| Service | Dockerfile | Port | Domain Example |
|---------|-----------|------|----------------|
| **Hocuspocus** | `server/Dockerfile.hocuspocus` | 1234 | `hocuspocus.yourdomain.com` |
| **Signaling** | `server/Dockerfile.signaling` | 4444 | `signaling.yourdomain.com` |
| **Web App** | `web/Dockerfile` | 3000 | `app.yourdomain.com` |

---

## 📋 Copy-Paste Configurations

### Service 1: Hocuspocus Server

**Dockploy Settings:**
```
Name: yjs-hocuspocus
Build Type: Dockerfile
Repository: [YOUR_GITHUB_REPO_URL]
Branch: main
Dockerfile Path: server/Dockerfile.hocuspocus
Context Path: server
Container Port: 1234
Protocol: HTTP/WebSocket (enable WebSocket)
```

**Environment Variables:**
```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
HOCUSPOCUS_PORT=1234
NODE_ENV=production
CORS_ORIGIN=*
```

---

### Service 2: Signaling Server

**Dockploy Settings:**
```
Name: yjs-signaling
Build Type: Dockerfile
Repository: [YOUR_GITHUB_REPO_URL]
Branch: main
Dockerfile Path: server/Dockerfile.signaling
Context Path: server
Container Port: 4444
Protocol: HTTP/WebSocket (enable WebSocket)
```

**Environment Variables:**
```env
SIGNALING_PORT=4444
NODE_ENV=production
```

---

### Service 3: Web App (Next.js)

**Dockploy Settings:**
```
Name: yjs-web
Build Type: Dockerfile
Repository: [YOUR_GITHUB_REPO_URL]
Branch: main
Dockerfile Path: web/Dockerfile
Context Path: web
Container Port: 3000
Protocol: HTTP
```

**Environment Variables:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_HOCUSPOCUS_URL=wss://hocuspocus.yourdomain.com
NEXT_PUBLIC_SIGNALING_URL=wss://signaling.yourdomain.com
NEXT_PUBLIC_WEBRTC_PASSWORD=your-secure-password
```

---

## 🔑 Getting Your Supabase Credentials

1. Go to [supabase.com](https://supabase.com) → Your Project
2. Click **Settings** → **API**
3. Copy these values:

| Field | Use In | Variable Name |
|-------|--------|---------------|
| **Project URL** | Web + Server | `SUPABASE_URL` |
| **anon public** key | Web App only | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| **service_role** key | Server only | `SUPABASE_SERVICE_KEY` |

---

## ⚠️ Important Notes

### SSL/TLS Requirements
- ✅ **Must enable SSL** on all services
- ✅ Use `wss://` for WebSocket URLs (not `ws://`)
- ✅ Use `https://` for HTTP URLs (not `http://`)

### WebSocket Configuration
- ✅ Enable "WebSocket Support" for Hocuspocus
- ✅ Enable "WebSocket Support" for Signaling
- ✅ Regular HTTP for Web App (Next.js handles WS client-side)

### Deployment Order
```
1. Supabase (setup database first)
   ↓
2. Hocuspocus Server (get the URL)
   ↓
3. Signaling Server (get the URL)
   ↓
4. Web App (use URLs from step 2-3)
```

---

## 🧪 Testing Your Deployment

### 1. Check Service Health

Visit each service URL:
- Hocuspocus: `https://hocuspocus.yourdomain.com` (should return 200)
- Signaling: `https://signaling.yourdomain.com` (should return 200)
- Web App: `https://app.yourdomain.com` (should load the app)

### 2. Test Collaboration

1. Open web app: `https://app.yourdomain.com/document/test`
2. Open DevTools → Console
3. Should see:
   ```
   ✓ IndexedDB loaded
   ✓ Hocuspocus synced: true
   ✓ Connection status: connected
   ✓ WebRTC synced: true
   ```

4. Open same URL in another browser/tab
5. Create a rectangle in one → should appear in other

---

## 🐛 Quick Troubleshooting

| Issue | Check | Fix |
|-------|-------|-----|
| Build fails | Logs in Dockploy | Verify Dockerfile path & context |
| WebSocket fails | SSL enabled? | Enable SSL, use `wss://` |
| CORS error | CORS_ORIGIN set? | Add web app URL to server env |
| DB connection fails | Supabase key? | Use SERVICE_KEY for server |
| App loads but no sync | Backend URLs? | Check `NEXT_PUBLIC_*` vars |

---

## 📱 Mobile/Remote Testing

To test from mobile or share with others:

1. Use custom domains (not `localhost`)
2. Ensure SSL is enabled
3. Test on: `https://your-app.com/document/shared-test`
4. Share link with collaborators

---

## 🔄 Auto-Deploy on Git Push

In Dockploy:
1. Go to service settings
2. Enable "Auto Deploy"
3. Add GitHub webhook
4. Push to `main` → auto-redeploys

---

## 📊 Resource Recommendations

### Development/Testing
- **Hocuspocus**: 1 CPU, 512MB RAM
- **Signaling**: 0.5 CPU, 256MB RAM
- **Web App**: 1 CPU, 512MB RAM

### Production (20-50 concurrent users)
- **Hocuspocus**: 2 CPU, 2GB RAM
- **Signaling**: 1 CPU, 1GB RAM
- **Web App**: 1 CPU, 1GB RAM

### High Load (100+ concurrent users)
- **Hocuspocus**: 4 CPU, 4GB RAM (multiple instances)
- **Signaling**: 2 CPU, 2GB RAM (multiple instances)
- **Web App**: 2 CPU, 2GB RAM (CDN for static assets)

---

## ✅ Deployment Checklist

Before deploying to production:

- [ ] Supabase project created
- [ ] Database schema executed (`supabase-schema.sql`)
- [ ] All environment variables prepared
- [ ] GitHub repo is public (or Dockploy has access)
- [ ] SSL certificates configured in Dockploy
- [ ] Custom domains added (optional)
- [ ] Health checks enabled
- [ ] Monitoring/logs configured
- [ ] Backup strategy for Supabase
- [ ] `CORS_ORIGIN` restricted to your domain

---

## 🚀 Deploy Now!

1. **Database**: Create Supabase project + run schema (5 min)
2. **Backend**: Deploy Hocuspocus + Signaling (10 min each)
3. **Frontend**: Deploy Web App with backend URLs (10 min)
4. **Test**: Open app, create document, collaborate! (2 min)

**Total time**: ~40 minutes for complete deployment 🎉


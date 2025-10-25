# Dockploy Deployment Guide

Complete guide to deploy your Yjs Rectangles Editor to Dockploy.

## 📋 Prerequisites

1. **Dockploy Account** - Sign up at your Dockploy instance
2. **Supabase Project** - Set up database (see Database Setup below)
3. **Public GitHub Repository** - Push your code to GitHub

## 🏗️ Architecture Overview

Your application consists of **3 services**:

1. **Hocuspocus Server** (WebSocket) - Port 1234
2. **Signaling Server** (WebRTC) - Port 4445  
3. **Next.js Web App** - Port 3000

## 📦 Step 1: Prepare Your Repository

### 1.1 Ensure all Dockerfiles are in place

✅ `server/Dockerfile.hocuspocus` - Already exists
✅ `server/Dockerfile.signaling` - Already exists
✅ `web/Dockerfile` - Now created

### 1.2 Environment Variables

Create these files locally (don't commit with real values):

**`web/.env.local`** (for local development):
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
NEXT_PUBLIC_HOCUSPOCUS_URL=wss://your-hocuspocus-service.dockploy.app
NEXT_PUBLIC_SIGNALING_URL=wss://your-signaling-service.dockploy.app
NEXT_PUBLIC_WEBRTC_PASSWORD=your-secret-password
```

**`server/.env`** (for local development):
```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key-here
HOCUSPOCUS_PORT=1234
Y_WEBRTC_SIGNALING_PORT=4445
NODE_ENV=production
CORS_ORIGIN=*
```

### 1.3 Push to GitHub

```bash
git add .
git commit -m "Add Dockploy deployment configuration"
git push origin main
```

## 🗄️ Step 2: Database Setup (Supabase)

### 2.1 Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Wait for provisioning (~2 minutes)

### 2.2 Run Database Schema

1. In Supabase Dashboard, go to **SQL Editor**
2. Run the schema from `server/supabase-schema.sql`:

```sql
-- Main documents table
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  yjs_state BYTEA,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Incremental updates (for delta storage)
CREATE TABLE document_updates (
  id BIGSERIAL PRIMARY KEY,
  document_name TEXT REFERENCES documents(name) ON DELETE CASCADE,
  update BYTEA NOT NULL,
  client_id TEXT,
  clock BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_doc_name ON documents(name);
CREATE INDEX idx_updates_doc ON document_updates(document_name);
CREATE INDEX idx_updates_created ON document_updates(created_at);
```

### 2.3 Get API Keys

1. Go to **Settings** → **API**
2. Copy:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon/public key** (for web app)
   - **service_role key** (for server - keep secret!)

## 🚀 Step 3: Deploy to Dockploy

### 3.1 Deploy Hocuspocus Server (Backend 1/2)

1. **Create New Service** in Dockploy
   - Click **New Service** → **Docker**
   - Name: `yjs-hocuspocus`

2. **Build Configuration**:
   - **Build Type**: `Dockerfile`
   - **Repository**: Your GitHub repo URL
   - **Branch**: `main`
   - **Dockerfile Path**: `server/Dockerfile.hocuspocus`
   - **Context Path**: `server`

3. **Environment Variables**:
   ```env
   SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_SERVICE_KEY=your-service-role-key-here
   HOCUSPOCUS_PORT=1234
   NODE_ENV=production
   CORS_ORIGIN=*
   ```

4. **Network Settings**:
   - **Container Port**: `1234`
   - **Protocol**: `HTTP/WebSocket`
   - Enable **WebSocket Support**

5. **Domain Settings**:
   - Add custom domain or use Dockploy subdomain
   - Example: `hocuspocus.yourdomain.com` or `yjs-hocuspocus.dockploy.app`
   - **Enable SSL/TLS** (for wss:// protocol)

6. **Deploy** and wait for build to complete

### 3.2 Deploy Signaling Server (Backend 2/2)

1. **Create New Service** in Dockploy
   - Click **New Service** → **Docker**
   - Name: `yjs-signaling`

2. **Build Configuration**:
   - **Build Type**: `Dockerfile`
   - **Repository**: Your GitHub repo URL
   - **Branch**: `main`
   - **Dockerfile Path**: `server/Dockerfile.signaling`
   - **Context Path**: `server`

3. **Environment Variables**:
   ```env
   Y_WEBRTC_SIGNALING_PORT=4445
   NODE_ENV=production
   ```

4. **Network Settings**:
   - **Container Port**: `4445`
   - **Protocol**: `HTTP/WebSocket`
   - Enable **WebSocket Support**

5. **Domain Settings**:
   - Add custom domain or use Dockploy subdomain
   - Example: `signaling.yourdomain.com` or `yjs-signaling.dockploy.app`
   - **Enable SSL/TLS** (for wss:// protocol)

6. **Deploy** and wait for build to complete

### 3.3 Deploy Next.js Web App (Frontend)

1. **Create New Service** in Dockploy
   - Click **New Service** → **Docker**
   - Name: `yjs-web`

2. **Build Configuration**:
   - **Build Type**: `Dockerfile`
   - **Repository**: Your GitHub repo URL
   - **Branch**: `main`
   - **Dockerfile Path**: `web/Dockerfile`
   - **Context Path**: `web`

3. **Environment Variables** (use URLs from previous steps):
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   NEXT_PUBLIC_HOCUSPOCUS_URL=wss://yjs-hocuspocus.dockploy.app
   NEXT_PUBLIC_SIGNALING_URL=wss://yjs-signaling.dockploy.app
   NEXT_PUBLIC_WEBRTC_PASSWORD=my-secure-password
   ```

4. **Network Settings**:
   - **Container Port**: `3000`
   - **Protocol**: `HTTP`

5. **Domain Settings**:
   - Add custom domain or use Dockploy subdomain
   - Example: `app.yourdomain.com` or `yjs-web.dockploy.app`
   - **Enable SSL/TLS**

6. **Deploy** and wait for build to complete

## ✅ Step 4: Verify Deployment

### 4.1 Check Service Health

1. Visit your web app URL: `https://yjs-web.dockploy.app`
2. Open browser DevTools → Console
3. Look for connection messages:
   ```
   IndexedDB loaded
   Hocuspocus synced: true
   Connection status: connected
   WebRTC synced: true
   ```

### 4.2 Test Collaboration

1. Open your app in **two different browsers**
2. Go to the same document: `/document/test-doc`
3. Create a rectangle in one browser
4. It should appear in the other browser instantly

### 4.3 Check WebSocket Connections

In Dockploy dashboard:
1. Check **Logs** for each service
2. Hocuspocus should show: `✅ Hocuspocus server running on port 1234`
3. Signaling should show: `✅ Signaling server running on port 4445`
4. Web app should show: `✓ Ready in XXXms`

## 🔧 Step 5: Configure CORS (If Needed)

If you encounter CORS errors:

### Update Hocuspocus Server

Add environment variable in Dockploy:
```env
CORS_ORIGIN=https://yjs-web.dockploy.app,https://app.yourdomain.com
```

### Update Signaling Server

The signaling server already has CORS enabled (`origin: '*'`), but you can restrict it by modifying the code.

## 📊 Step 6: Monitoring & Scaling

### Health Checks

All Dockerfiles include health checks. Dockploy will automatically restart containers if they fail.

### Logs

View logs in Dockploy dashboard:
- Click on service → **Logs** tab
- Filter by error level
- Download logs for debugging

### Scaling

For production with many concurrent users:

1. **Hocuspocus Server**:
   - Increase resources: 2 CPU, 4GB RAM minimum
   - Enable horizontal scaling (multiple instances)
   - Use load balancer

2. **Signaling Server**:
   - Increase resources: 1 CPU, 2GB RAM minimum
   - Can run multiple instances

3. **Web App**:
   - Increase resources: 1 CPU, 2GB RAM minimum
   - Enable CDN for static assets

## 🐛 Troubleshooting

### Issue: WebSocket Connection Failed

**Symptoms**: `Connection status: disconnected` in console

**Solutions**:
1. Ensure WebSocket is enabled in Dockploy network settings
2. Check domain has SSL/TLS enabled (wss:// requires HTTPS)
3. Verify environment variables are correct
4. Check firewall/network policies

### Issue: Build Failed

**Symptoms**: Red status in Dockploy

**Solutions**:
1. Check build logs in Dockploy
2. Verify Dockerfile path is correct
3. Ensure `pnpm-lock.yaml` is committed to repo
4. Check if dependencies can be installed

### Issue: CORS Error

**Symptoms**: Console shows CORS policy errors

**Solutions**:
1. Add web app URL to `CORS_ORIGIN` in server env vars
2. Ensure all URLs use HTTPS/WSS (not HTTP/WS)
3. Check Supabase CORS settings if database errors

### Issue: Database Connection Failed

**Symptoms**: `Store error` or `Fetch error` in server logs

**Solutions**:
1. Verify `SUPABASE_SERVICE_KEY` is correct (not anon key)
2. Check Supabase project is active
3. Verify database tables are created
4. Check network connectivity from Dockploy to Supabase

## 🔐 Security Checklist

Before going to production:

- [ ] Use strong `NEXT_PUBLIC_WEBRTC_PASSWORD`
- [ ] Never commit `.env` files with real credentials
- [ ] Use `SUPABASE_SERVICE_KEY` only in server (not web app)
- [ ] Enable Supabase RLS (Row Level Security) policies
- [ ] Restrict CORS origins to your domains only
- [ ] Enable rate limiting in Hocuspocus
- [ ] Use custom domains with SSL certificates
- [ ] Set up monitoring and alerting
- [ ] Regular database backups
- [ ] Implement authentication (post-MVP)

## 📝 Environment Variables Reference

### Web App (`yjs-web`)

| Variable | Example | Required | Notes |
|----------|---------|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` | ✅ | From Supabase dashboard |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbG...` | ✅ | Public anon key |
| `NEXT_PUBLIC_HOCUSPOCUS_URL` | `wss://hocuspocus.app` | ✅ | Must use wss:// |
| `NEXT_PUBLIC_SIGNALING_URL` | `wss://signaling.app` | ✅ | Must use wss:// |
| `NEXT_PUBLIC_WEBRTC_PASSWORD` | `secret123` | ⚠️ | Optional but recommended |

### Hocuspocus Server (`yjs-hocuspocus`)

| Variable | Example | Required | Notes |
|----------|---------|----------|-------|
| `SUPABASE_URL` | `https://xxx.supabase.co` | ✅ | Same as web app |
| `SUPABASE_SERVICE_KEY` | `eyJhbG...` | ✅ | **Secret** service_role key |
| `HOCUSPOCUS_PORT` | `1234` | ✅ | Default: 1234 |
| `NODE_ENV` | `production` | ✅ | Must be production |
| `CORS_ORIGIN` | `*` or `https://app.com` | ⚠️ | Restrict in production |

### Signaling Server (`yjs-signaling`)

| Variable | Example | Required | Notes |
|----------|---------|----------|-------|
| `SIGNALING_PORT` | `4445` | ✅ | Default: 4445 |
| `NODE_ENV` | `production` | ✅ | Must be production |

## 🚢 Deployment Order

**Important**: Deploy in this order to avoid connection errors:

1. **Database** (Supabase) - Set up first
2. **Hocuspocus Server** - Backend service 1
3. **Signaling Server** - Backend service 2
4. **Web App** - Frontend (needs backend URLs)

## 🔄 Updating Your Deployment

When you push new code to GitHub:

1. Dockploy can auto-deploy on push (enable webhook)
2. Or manually trigger rebuild in Dockploy dashboard
3. Services will rebuild and restart automatically
4. Zero-downtime deployment with rolling updates

## 📚 Additional Resources

- [Dockploy Documentation](https://dockploy.com/docs)
- [Yjs Documentation](https://docs.yjs.dev)
- [Hocuspocus Docs](https://tiptap.dev/hocuspocus)
- [Supabase Docs](https://supabase.com/docs)

## 🎉 Success!

Your Rectangles Editor is now live! Share the web app URL with users and start collaborating in real-time.

**Example URLs**:
- Web App: `https://yjs-web.dockploy.app/document/my-first-doc`
- Hocuspocus: `wss://yjs-hocuspocus.dockploy.app` (internal)
- Signaling: `wss://yjs-signaling.dockploy.app` (internal)


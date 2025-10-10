# Server Setup Guide

Complete setup guide for the collaborative editor backend.

## 📋 Prerequisites

Before you begin, ensure you have:

- ✅ Node.js 18 or higher installed
- ✅ npm or yarn package manager
- ✅ Supabase account (free tier is fine)
- ✅ Docker and Docker Compose (optional, for containerized deployment)

## 🚀 Step-by-Step Setup

### Step 1: Supabase Project Setup

1. **Create a Supabase Project**
   - Go to [supabase.com](https://supabase.com)
   - Click "New Project"
   - Fill in project details (name, database password, region)
   - Wait for project to be ready (~2 minutes)

2. **Get Your Credentials**
   - Go to Project Settings → API
   - Copy the following:
     - `Project URL` (e.g., https://xxxxx.supabase.co)
     - `service_role` key (under "Project API keys")
   
   ⚠️ **Important**: Use the `service_role` key, not the `anon` key for the server

3. **Run Database Schema**
   - Go to SQL Editor in Supabase dashboard
   - Create a new query
   - Copy the entire contents of `supabase-schema.sql`
   - Click "Run" to execute

4. **Verify Tables Created**
   - Go to Table Editor
   - You should see three tables:
     - ✅ `documents`
     - ✅ `document_updates`
     - ✅ `document_snapshots`

### Step 2: Server Configuration

1. **Clone and Navigate**
   ```bash
   cd server
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   ```bash
   cp env.example .env
   ```

4. **Edit `.env` File**
   
   Open `.env` and fill in your Supabase credentials:
   
   ```env
   # Supabase Configuration
   SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_SERVICE_KEY=your-service-role-key-here
   
   # Server Configuration
   HOCUSPOCUS_PORT=1234
   SIGNALING_PORT=4444
   NODE_ENV=development
   
   # Optional: CORS Configuration
   CORS_ORIGIN=*
   ```

### Step 3: Local Development

1. **Start Both Servers**
   ```bash
   npm run dev
   ```

   This starts:
   - Hocuspocus server on `ws://localhost:1234`
   - Signaling server on `ws://localhost:4444`

2. **Or Start Individually**
   
   Terminal 1 - Hocuspocus:
   ```bash
   npm run dev:hocuspocus
   ```
   
   Terminal 2 - Signaling:
   ```bash
   npm run dev:signaling
   ```

3. **Verify Servers Are Running**
   
   You should see:
   ```
   ╔════════════════════════════════════════════════════════╗
   ║   🚀 Hocuspocus Server Running                         ║
   ║   Port: 1234                                           ║
   ╚════════════════════════════════════════════════════════╝
   
   ╔════════════════════════════════════════════════════════╗
   ║   🔄 WebRTC Signaling Server Running                  ║
   ║   Port: 4444                                           ║
   ╚════════════════════════════════════════════════════════╝
   ```

### Step 4: Test the Setup

#### Test 1: Signaling Server Health Check

```bash
curl http://localhost:4444/health
```

Expected response:
```json
{"status":"ok","service":"webrtc-signaling"}
```

#### Test 2: WebSocket Connections

Using browser console:

```javascript
// Test Hocuspocus
const ws1 = new WebSocket('ws://localhost:1234')
ws1.onopen = () => console.log('Hocuspocus connected ✅')
ws1.onerror = (e) => console.error('Hocuspocus error:', e)

// Test Signaling
const ws2 = new WebSocket('ws://localhost:4444')
ws2.onopen = () => console.log('Signaling connected ✅')
ws2.onerror = (e) => console.error('Signaling error:', e)
```

#### Test 3: Database Connection

The Hocuspocus server will log database operations. Try creating a document from your client app and check the console for:

```
[SupabaseDB] Fetching document: test-doc
[SupabaseDB] Document not found (new document): test-doc
[Hocuspocus] Document loaded: test-doc
```

## 🐳 Docker Deployment (Optional)

### Quick Start with Docker

1. **Ensure `.env` is configured**
   ```bash
   # Check .env file exists and has correct values
   cat .env
   ```

2. **Build and Start Services**
   ```bash
   docker-compose up -d
   ```

3. **View Logs**
   ```bash
   # All services
   docker-compose logs -f
   
   # Individual service
   docker-compose logs -f hocuspocus
   docker-compose logs -f signaling
   ```

4. **Check Container Status**
   ```bash
   docker-compose ps
   ```

5. **Stop Services**
   ```bash
   docker-compose down
   ```

### Docker Health Checks

Both services include health checks:

```bash
# Check health status
docker inspect g-zero-hocuspocus | jq '.[0].State.Health'
docker inspect g-zero-signaling | jq '.[0].State.Health'
```

## 🔧 Troubleshooting

### Common Issues

#### 1. "Port already in use"

**Error**: `EADDRINUSE: address already in use :::1234`

**Solution**:
```bash
# Find process using port
lsof -ti:1234 | xargs kill
lsof -ti:4444 | xargs kill

# Or use different ports in .env
HOCUSPOCUS_PORT=1235
SIGNALING_PORT=4445
```

#### 2. Supabase Connection Failed

**Error**: `Invalid Supabase credentials`

**Checklist**:
- ✅ Using `service_role` key (not `anon` key)
- ✅ URL includes `https://` prefix
- ✅ No extra spaces in `.env` file
- ✅ Supabase project is active (not paused)

**Test Connection**:
```bash
curl -H "apikey: YOUR_SERVICE_KEY" \
     -H "Authorization: Bearer YOUR_SERVICE_KEY" \
     YOUR_SUPABASE_URL/rest/v1/documents
```

#### 3. WebSocket Connection Failed

**Symptoms**: Client cannot connect to WebSocket

**Solutions**:
- Check firewall allows ports 1234 and 4444
- Verify CORS_ORIGIN includes your client URL
- Check server logs for errors
- Ensure server is actually running

#### 4. Database Tables Not Found

**Error**: `relation "documents" does not exist`

**Solution**:
- Go to Supabase SQL Editor
- Re-run `supabase-schema.sql`
- Verify tables in Table Editor

#### 5. Module Not Found Errors

**Error**: `Cannot find module '@hocuspocus/server'`

**Solution**:
```bash
# Clear and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Debugging Tips

1. **Enable Verbose Logging**
   ```bash
   NODE_ENV=development npm run dev
   ```

2. **Check Server Logs**
   ```bash
   # Development
   tail -f logs/*.log
   
   # Docker
   docker-compose logs -f --tail=100
   ```

3. **Test Each Component**
   ```bash
   # Test Hocuspocus only
   npm run dev:hocuspocus
   
   # Test Signaling only
   npm run dev:signaling
   ```

4. **Verify Environment**
   ```bash
   # Print environment (without sensitive values)
   node -e "require('dotenv').config(); console.log('SUPABASE_URL:', process.env.SUPABASE_URL); console.log('Ports:', process.env.HOCUSPOCUS_PORT, process.env.SIGNALING_PORT)"
   ```

## 📊 Monitoring

### Development Monitoring

```bash
# Monitor both servers
npm run dev

# Watch logs
tail -f *.log
```

### Production Monitoring

```bash
# Docker logs
docker-compose logs -f

# Check resource usage
docker stats

# Container health
docker-compose ps
```

### Database Monitoring

Use Supabase Dashboard:
- Table Editor → View data
- SQL Editor → Run queries
- Logs → View database logs

Or use SQL queries:

```sql
-- Check document count
SELECT COUNT(*) FROM documents;

-- View recent updates
SELECT * FROM document_updates 
ORDER BY created_at DESC 
LIMIT 10;

-- Get document statistics
SELECT * FROM get_document_stats('your-doc-name');
```

## 🔐 Security Checklist

### Development (Current)
- ✅ No authentication required
- ✅ CORS allows all origins
- ✅ All documents publicly accessible

### Production (TODO)
- ⬜ Implement authentication in `onAuthenticate`
- ⬜ Enable Row Level Security (RLS) in Supabase
- ⬜ Restrict CORS to specific domains
- ⬜ Add rate limiting
- ⬜ Use WSS (WebSocket Secure) with SSL
- ⬜ Implement document access control
- ⬜ Add API keys for server-to-server auth

## 📈 Performance Tips

### Optimize Supabase

1. **Create Indexes** (already done in schema)
   ```sql
   CREATE INDEX idx_doc_name ON documents(name);
   CREATE INDEX idx_updates_doc ON document_updates(document_name);
   ```

2. **Enable Connection Pooling**
   - Use Supabase pooler for better performance
   - Update connection string in `.env`

3. **Cleanup Old Data**
   ```sql
   -- Run periodically
   SELECT cleanup_old_updates(30); -- Keep last 30 days
   ```

### Scale the Servers

1. **Use Redis for Multi-Server Setup**
   ```bash
   npm install @hocuspocus/extension-redis
   ```

2. **Load Balancer Configuration**
   - Use sticky sessions for WebSocket
   - Configure health check endpoints

3. **Database Optimization**
   - Enable snapshots for large documents
   - Archive old updates to cold storage

## ✅ Verification Checklist

Before going to production:

- ⬜ Supabase tables created successfully
- ⬜ Environment variables configured
- ⬜ Both servers start without errors
- ⬜ Health checks pass
- ⬜ WebSocket connections work
- ⬜ Database reads/writes successful
- ⬜ CORS configured correctly
- ⬜ Logs are readable and helpful
- ⬜ Error handling works
- ⬜ Docker setup tested (if using)

## 🆘 Getting Help

If you encounter issues:

1. Check this troubleshooting guide
2. Review server logs for errors
3. Verify Supabase dashboard for connection issues
4. Test each component individually
5. Check environment variables

For additional help:
- Hocuspocus: https://tiptap.dev/hocuspocus
- Socket.IO: https://socket.io/docs
- Supabase: https://supabase.com/docs

## 🎉 Next Steps

Once your server is running:

1. ✅ Set up the web client (in `../web`)
2. ✅ Test real-time collaboration
3. ✅ Monitor performance
4. ✅ Add authentication (post-MVP)
5. ✅ Deploy to production

Happy collaborating! 🚀


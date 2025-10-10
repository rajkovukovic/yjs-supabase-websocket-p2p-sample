# 🚀 Quick Start Guide

Get your collaborative editing server running in 5 minutes!

## Prerequisites

- ✅ Node.js 18+
- ✅ Supabase account (free tier works)
- ✅ 5 minutes of your time

## Step 1: Supabase Setup (2 minutes)

1. **Create Project** at [supabase.com](https://supabase.com)
   
2. **Run Database Schema**:
   - Open SQL Editor in Supabase dashboard
   - Copy & paste contents of `supabase-schema.sql`
   - Click "Run"
   
3. **Get Credentials**:
   - Go to Settings → API
   - Copy `Project URL` and `service_role` key

## Step 2: Server Setup (3 minutes)

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp env.example .env

# 3. Edit .env with your Supabase credentials
# SUPABASE_URL=https://xxxxx.supabase.co
# SUPABASE_SERVICE_KEY=your-service-role-key

# 4. Verify setup
npm run verify

# 5. Start servers
npm run dev
```

## Step 3: Test It! (30 seconds)

Open a new terminal:

```bash
# Test connections
npm run test:connection
```

Expected output:
```
✓ Hocuspocus WebSocket connection established
✓ Signaling WebSocket connection established
✓ Signaling HTTP health check passed
```

## 🎉 You're Ready!

Your servers are now running:
- **Hocuspocus**: `ws://localhost:1234` (for Yjs sync)
- **Signaling**: `ws://localhost:4444` (for WebRTC P2P)

## Next Steps

1. **Connect your client** - Point your web app to these WebSocket URLs
2. **Monitor logs** - Watch real-time collaboration in action
3. **Deploy** - Use Docker Compose for production: `docker-compose up -d`

## Need Help?

- 📚 Full docs: See `README.md`
- 🔧 Setup issues: See `SETUP.md`
- 🐛 Troubleshooting: Check server logs

## Common Issues

**Port in use?**
```bash
lsof -ti:1234 | xargs kill
```

**Supabase connection fails?**
- Ensure you're using `service_role` key (not `anon`)
- Check URL includes `https://`

**Dependencies missing?**
```bash
rm -rf node_modules && npm install
```

---

That's it! Your collaborative editing server is live. 🚀


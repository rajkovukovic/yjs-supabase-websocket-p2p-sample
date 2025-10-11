# Rectangles Editor Server

Backend services for real-time collaborative graphic editing using Yjs CRDT.

## 🏗️ Architecture

This server provides two main services:

1. **Hocuspocus Server** (Port 1234) - WebSocket collaboration server for Yjs
2. **Signaling Server** (Port 4444) - WebRTC signaling for peer-to-peer connections

```
┌─────────────┐
│   Client A  │────┐
└─────────────┘    │
       │           │
       │ WebRTC ───┼──► Direct P2P (low latency)
       │           │
       │           │
       ▼           │
  Hocuspocus ◄─────┘
   (Server)         
       ▲           
       │           
       │           
┌─────────────┐    
│   Client B  │────┘
└─────────────┘
```

## 📋 Prerequisites

- Node.js 18+ 
- Supabase account (for database)
- Docker & Docker Compose (for production deployment)

## 🚀 Quick Start

### 1. Environment Setup

Copy the example environment file:

```bash
cp env.example .env
```

Edit `.env` with your Supabase credentials:

```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key-here
HOCUSPOCUS_PORT=1234
SIGNALING_PORT=4444
NODE_ENV=development
CORS_ORIGIN=*
```

### 2. Database Setup

Run this SQL in your Supabase SQL Editor:

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

-- Optional: Snapshots table (for optimization)
CREATE TABLE document_snapshots (
  id BIGSERIAL PRIMARY KEY,
  document_name TEXT REFERENCES documents(name) ON DELETE CASCADE,
  snapshot BYTEA NOT NULL,
  update_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_doc_name ON documents(name);
CREATE INDEX idx_updates_doc ON document_updates(document_name);
CREATE INDEX idx_updates_created ON document_updates(created_at);
CREATE INDEX idx_snapshots_doc ON document_snapshots(document_name);
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Development

Run both servers concurrently:

```bash
npm run dev
```

Or run them separately:

```bash
# Terminal 1: Hocuspocus server
npm run dev:hocuspocus

# Terminal 2: Signaling server
npm run dev:signaling
```

## 🐳 Docker Deployment

### Build and Run

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Production Deployment

1. Set environment variables in `.env`
2. Build images:

```bash
docker-compose build
```

3. Start services:

```bash
docker-compose up -d
```

### Health Checks

- Hocuspocus: WebSocket connection on `ws://localhost:1234`
- Signaling: `http://localhost:4444/health`

## 📚 API Documentation

### Hocuspocus Server

**WebSocket Endpoint**: `ws://localhost:1234`

The Hocuspocus server handles:
- Document synchronization via Yjs protocol
- Automatic persistence to Supabase
- Incremental update tracking
- Document lifecycle management

**Authentication** (MVP):
- Currently allows anonymous access
- Production: Implement token-based auth in `onAuthenticate` hook

### Signaling Server

**WebSocket Endpoint**: `ws://localhost:4444`

**Events**:

#### Client → Server

- `join` - Join a room (document)
  ```typescript
  socket.emit('join', 'document-name')
  ```

- `leave` - Leave a room
  ```typescript
  socket.emit('leave', 'document-name')
  ```

- `signal` - Send WebRTC signal to peer
  ```typescript
  socket.emit('signal', { to: 'peer-id', signal: rtcSignal })
  ```

- `broadcast` - Broadcast to all peers in room
  ```typescript
  socket.emit('broadcast', { room: 'document-name', data: {} })
  ```

- `room-info` - Get room information
  ```typescript
  socket.emit('room-info', 'document-name', (info) => {
    console.log(info) // { room, peerCount, peers, createdAt }
  })
  ```

#### Server → Client

- `peers` - List of existing peers when joining
- `peer-joined` - New peer joined the room
- `peer-left` - Peer left the room
- `signal` - WebRTC signal from another peer
- `broadcast` - Broadcast message from another peer
- `server-shutdown` - Server is shutting down

## 🔧 Configuration

### Hocuspocus Server

Key configuration in `hocuspocus-server.ts`:

```typescript
const server = Server.configure({
  port: 1234,
  extensions: [SupabaseDatabase],
  async onAuthenticate({ documentName }) {
    // Add your auth logic here
  },
  async onChange({ documentName, context }) {
    // Handle document changes
  }
})
```

### Signaling Server

Key configuration in `signaling-server.ts`:

```typescript
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST']
  },
  pingInterval: 25000,
  pingTimeout: 60000
})
```

## 📊 Monitoring

### Logs

Both servers provide detailed logging:

```bash
# View Hocuspocus logs
docker-compose logs -f hocuspocus

# View Signaling logs
docker-compose logs -f signaling
```

### Health Checks

Docker Compose includes health checks for both services:

- **Hocuspocus**: Checks WebSocket availability every 30s
- **Signaling**: HTTP health endpoint check every 30s

## 🐛 Troubleshooting

### Connection Issues

1. **CORS errors**: Update `CORS_ORIGIN` in `.env`
2. **WebSocket upgrade failed**: Check firewall/proxy settings
3. **Database errors**: Verify Supabase credentials and network access

### Performance Issues

1. **High memory usage**: Consider enabling snapshot creation for large documents
2. **Slow sync**: Check network latency and database performance
3. **Too many connections**: Implement connection rate limiting

### Common Errors

**"EADDRINUSE" error**: Port already in use
```bash
# Find and kill process using port
lsof -ti:1234 | xargs kill
lsof -ti:4444 | xargs kill
```

**Supabase connection error**: Check service key and URL
```bash
# Test Supabase connection
curl -H "apikey: YOUR_SERVICE_KEY" YOUR_SUPABASE_URL/rest/v1/
```

## 🔒 Security Notes (MVP)

⚠️ **Current implementation is for MVP/development**:

- No authentication required
- All documents publicly accessible
- CORS set to allow all origins

**For Production**:

1. Implement proper authentication in `onAuthenticate` hook
2. Add Row Level Security (RLS) in Supabase
3. Restrict CORS origins
4. Add rate limiting
5. Implement access control per document
6. Use HTTPS/WSS in production

## 📈 Scaling

### Horizontal Scaling

To scale Hocuspocus across multiple servers, use Redis adapter:

```bash
npm install @hocuspocus/extension-redis
```

```typescript
import { Redis } from '@hocuspocus/extension-redis'

const server = Server.configure({
  extensions: [
    new Redis({
      host: 'localhost',
      port: 6379
    })
  ]
})
```

### Database Optimization

1. **Enable snapshots**: Run periodic snapshot creation to compress updates
2. **Archive old updates**: Move old updates to cold storage
3. **Add caching**: Use Redis for frequently accessed documents

## 📝 Development Scripts

```bash
# Development (with hot reload)
npm run dev                  # Run both servers
npm run dev:hocuspocus      # Run Hocuspocus only
npm run dev:signaling       # Run signaling only

# Production
npm run build               # Build TypeScript
npm run start               # Run both servers (production)
npm run start:hocuspocus    # Run Hocuspocus only
npm run start:signaling     # Run signaling only
```

## 🧪 Testing

### Manual Testing

1. **Test Hocuspocus**:
```bash
# In browser console
const ws = new WebSocket('ws://localhost:1234')
ws.onopen = () => console.log('Connected')
```

2. **Test Signaling**:
```bash
npm install -g wscat
wscat -c ws://localhost:4444
```

### Health Check

```bash
# Signaling server
curl http://localhost:4444/health
```

## 📦 File Structure

```
server/
├── extensions/
│   └── supabase-db.ts       # Supabase database extension
├── hocuspocus-server.ts     # Main WebSocket server
├── signaling-server.ts      # WebRTC signaling server
├── package.json
├── tsconfig.json
├── docker-compose.yml
├── Dockerfile.hocuspocus
├── Dockerfile.signaling
├── .dockerignore
├── env.example
└── README.md
```

## 🤝 Contributing

1. Follow TypeScript best practices
2. Add proper error handling
3. Include logging for debugging
4. Update this README for new features

## 📄 License

MIT


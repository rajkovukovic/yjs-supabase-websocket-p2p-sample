# Rectangles Editor Server

Backend services for real-time collaborative graphic editing using Yjs CRDT.

## 🏗️ Architecture

This server provides two main services:

1. **Hocuspocus Server** (Port 1234) - WebSocket collaboration server for Yjs
2. **Signaling Server** (Port 4445) - WebRTC signaling for peer-to-peer connections

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
Y_WEBRTC_SIGNALING_PORT=4445
NODE_ENV=development
CORS_ORIGIN=*
Y_WEBRTC_PASSWORD=your-secret-password # Optional: Password-protects signaling rooms

# Optional: Database Table Names (defaults to standard names)
# TABLE_DOCUMENTS=documents
# TABLE_DOCUMENT_UPDATES=document_updates
# TABLE_DOCUMENT_SNAPSHOTS=document_snapshots
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
- Signaling: `http://localhost:4445/health`

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

The signaling server uses the `ws` library and has minimal configuration. See `y-webrtc-signaling.ts`.

**Protocol Messages**:

#### Client → Server

- **`subscribe`**: Joins one or more rooms.
  - If a server password is set, the client must send `roomName/password` as the topic.
  ```json
  { "type": "subscribe", "topics": ["my-document-name"] }
  ```
- **`unsubscribe`**: Leaves one or more rooms.
  ```json
  { "type": "unsubscribe", "topics": ["my-document-name"] }
  ```
- **`publish`**: Broadcasts a message (e.g., a WebRTC connection offer) to all other clients in a room.
  ```json
  { "type": "publish", "topic": "my-document-name", "data": { ... } }
  ```
- **`ping`**: A keepalive message. The server will respond with `pong`.

#### Server → Client

- The server broadcasts `publish` messages from other clients to all members of a room.
- **`pong`**: The response to a client's `ping`.

### 🔧 Configuration

### Database Table Names

The server uses configurable table names that can be set via environment variables:

```env
# Optional: Custom table names (defaults shown)
TABLE_DOCUMENTS=documents
TABLE_DOCUMENT_UPDATES=document_updates
TABLE_DOCUMENT_SNAPSHOTS=document_snapshots
```

**Use Cases:**
- **Multi-tenant setups**: Use different table names per tenant
- **Environment separation**: `prod_documents`, `staging_documents`
- **Custom schemas**: `myapp.documents`, `collab.document_updates`

**Important**: If you change table names, you must:
1. Create the tables with your custom names in Supabase
2. Update the schema in `supabase-schema.sql` with your table names
3. Set the environment variables in your `.env` file

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

The signaling server uses the `ws` library and has minimal configuration. See `y-webrtc-signaling.ts`.

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
lsof -ti:4445 | xargs kill
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
wscat -c ws://localhost:4445
```

### Health Check

```bash
# Signaling server
curl http://localhost:4445/health
```

## 📦 File Structure

```
server/
├── extensions/
│   └── supabase-db.ts       # Supabase database extension
├── hocuspocus-server.ts     # Main WebSocket server
├── y-webrtc-signaling.ts      # WebRTC signaling server
├── package.json
├── tsconfig.json
├── docker-compose.yml
├── Dockerfile.hocuspocus
├── Dockerfile.y-webrtc
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


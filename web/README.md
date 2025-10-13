# Rectangles Editor - Frontend

A real-time collaborative graphic editing tool built with Next.js, Yjs, and Valtio.

## Features

- ✅ **Real-time Collaboration**: Multiple users can edit simultaneously
- ✅ **Offline Support**: Works offline with IndexedDB persistence
- ✅ **P2P Synchronization**: Low-latency updates via WebRTC
- ✅ **Server Sync**: Reliable synchronization via Hocuspocus WebSocket server
- ✅ **Live Cursors**: See other users' cursors in real-time
- ✅ **SVG Canvas**: Native SVG rendering for crisp graphics
- ✅ **Pan Canvas**: Navigate large canvases easily

## Tech Stack

- **Next.js 14** - React framework
- **Yjs** - CRDT for conflict-free collaboration
- **Valtio** - Reactive state management
- **Hocuspocus** - WebSocket provider for Yjs
- **y-webrtc** - Peer-to-peer synchronization
- **y-indexeddb** - Local persistence
- **Tailwind CSS** - Styling

## Prerequisites

- Node.js 18+
- Running Hocuspocus server on port 1234
- Running signaling server on port 4445

## Installation

```bash
npm install
```

## Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
NEXT_PUBLIC_HOCUSPOCUS_URL=ws://localhost:1234
NEXT_PUBLIC_SIGNALING_URL=ws://localhost:4445
```

## Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Usage

1. **Create/Open Document**: Enter a document name or leave blank to generate one
2. **Add Rectangles**: Click anywhere on the canvas
3. **Move Rectangles**: Drag them around
4. **Resize**: Drag the circle handle at the bottom-right corner
5. **Pan**: Cmd+Click and drag (or middle mouse button)
6. **Collaborate**: Open the same document URL in multiple tabs or share with others!

## Project Structure

```
web/
├── app/
│   ├── document/[id]/
│   │   └── page.tsx         # Document editor page
│   ├── layout.tsx           # Root layout
│   ├── page.tsx             # Landing page
│   └── globals.css          # Global styles
├── components/
│   ├── Canvas.tsx           # SVG canvas component
│   ├── Rectangle.tsx        # Rectangle component
│   ├── StatusBar.tsx        # Connection status
│   └── Cursors.tsx          # User cursors
├── hooks/
│   └── useYjs.tsx           # Yjs provider hook
├── lib/
│   ├── yjs-providers.ts     # Setup providers
│   └── supabase.ts          # Supabase client
├── store/
│   └── document.ts          # Valtio state
└── types.ts                 # TypeScript types
```

## Architecture

```
Yjs (CRDT) → Valtio Proxy → React Component
    ↓
  Y.Array observes changes
    ↓
  Updates Valtio state
    ↓
  React re-renders
```

## Connection Flow

1. IndexedDB loads local state immediately
2. WebRTC connects to peers (if available)
3. Hocuspocus connects to server
4. All providers merge their states
5. Conflicts resolved via Yjs CRDT

## Performance

- Initial load: < 2s (with 100 rectangles)
- Update latency (local): < 16ms (60 FPS)
- Update latency (WebRTC): < 50ms (P2P)
- Update latency (Hocuspocus): < 200ms (server)

## Building for Production

```bash
npm run build
npm start
```

## License

MIT


# AGENTS

## Role

- Senior Full-Stack engineer expert in Next.js, React, TypeScript, Valtio, Yjs, and collaborative systems.
- Prioritize correctness, readability, and DRY principles. Use early returns, implement fully, and avoid placeholders.

## Tech Stack Expectations

- **Next.js 14** with **React 18** and **TypeScript 5.3**; use `.tsx` for React components and `.ts` for logic.
- **TailwindCSS 3.4** for styling with utility-first approach. Maintain dark mode via Tailwind 'class' strategy.
- **lucide-react** for icons
- **State Management**: Valtio 1.12 for reactive state with Yjs integration for real-time collaboration.
- **Collaborative Editing**: Yjs 13.6 with Valtio synchronization for real-time document editing.
- **Backend Integration**: Supabase 2.39+ for database, authentication, and real-time features.
- **Real-time Communication**: Hocuspocus server for WebSocket collaboration, Socket.io for WebRTC signaling.
- **Package Manager**: pnpm (enforced via lock files).

## Imports and Path Aliases (Must)

- Use single quotes in import statements.
- Prefer path aliases configured in `tsconfig.json`:
  - `@/` → root of the project (for components, hooks, lib, store, etc.)

Examples:

```ts
import { documentState, actions } from '@/store/document'
import { useYjs } from '@/hooks/useYjs'
import { supabase } from '@/lib/supabase'
```

## Coding Conventions (Must)

- Use `const` arrow functions; name event handlers with `handle*` (e.g., `handleCreateRectangle`).
- Descriptive names for variables, functions, and components.
- Exported/public APIs must be typed explicitly; avoid `any` and unsafe casts.
- Guard clauses first; avoid deep nesting beyond 2–3 levels.
- Do not add explanatory inline comments for obvious code; document "why" above complex sections.

## Styling (Must)

- Tailwind utilities for all layout and visual styles.
- Maintain dark mode support via Tailwind 'class' strategy (already configured).
- Use CSS variables for consistent design tokens when needed.

## File Organization (Should)

- Keep files under ~200 lines; refactor into smaller modules when larger.
- **Feature-based Structure**: Organize by domain (document editing, collaboration, persistence).
- **Current Structure**:
  - `components/` - React UI components (Canvas, Rectangle, Cursors, StatusBar)
  - `hooks/` - Custom hooks (useYjs for Yjs integration)
  - `lib/` - Utilities (supabase client, Yjs providers)
  - `store/` - Valtio state management with Yjs sync
  - `types.ts` - TypeScript type definitions
- **Shared Code**: Reuse utilities from `@/` and organize by concern.

## Testing, Linting, and Types (Should)

- **Linting**: Next.js ESLint configuration with TypeScript support.
- **Formatting**: Follow Next.js conventions for code style.
- **TypeScript**: Target ES2020 with strict mode considerations.
- Ensure the code builds and passes lint checks when modified.
- Prefer type-safe APIs over speed; avoid weakening types.

## Error Handling and Control Flow (Must)

- Handle edge cases first, fail fast with clear error messages.
- Use Yjs transactions for atomic operations on collaborative documents.
- Avoid catching errors unless adding meaningful handling or context.

## Collaborative Architecture (Must)

- **State Management**: Valtio proxy stores with `useSnapshot` for reactive UI updates.
- **Document Synchronization**: Yjs documents synced bidirectionally with Valtio stores.
- **Real-time Sync**: Yjs updates persisted to Supabase via Hocuspocus WebSocket server.
- **Offline Support**: IndexedDB persistence via y-indexeddb for offline document access.
- **Peer-to-Peer**: WebRTC signaling via Socket.io server for direct client communication.
- **Provider Pattern**: Custom Yjs providers for Supabase and WebRTC connectivity.

## Specialized Libraries (Should)

- **Yjs Ecosystem**: y-indexeddb for offline storage, y-webrtc for P2P sync, @hocuspocus/provider for WebSocket fallback.
- **State Management**: Valtio for reactive state, integrated with Yjs for collaborative editing.
- **Backend**: @supabase/supabase-js for database and real-time subscriptions.
- **Server Components**: Hocuspocus for WebSocket collaboration server, Socket.io for signaling.

## UI/UX Practices (Should)

- Apply accessible patterns for collaborative editing interfaces.
- Use clear visual indicators for connection status, peer presence, and document state.
- Implement smooth animations for real-time updates and user interactions.
- Design for multiple users editing simultaneously with clear visual feedback.

## How to Work (Must)

- Fully implement requested functionality; no TODOs or placeholders.
- If a rule conflicts with established code patterns, match the existing codebase and update this file accordingly.
- Use Yjs transactions for all document modifications to ensure consistency.
- Follow the established Valtio + Yjs integration pattern for state management.
- If there is a report generated about the completed tasks, it should be saved in docs/vibe-coding-logs/YYYY-MM-DD where YYYY-MM-DD is the current date.

## Non-Goals / Don’ts

- Don’t introduce global CSS for component-specific styling.
- Don’t bypass established Valtio stores without justification.
- Don’t use default imports for modules that export named APIs unless required by the module.
- Don’t break the Yjs synchronization patterns already established.

## Architecture Patterns (Must)

- **Document Store Pattern**: Valtio stores synchronized with Yjs documents for real-time collaboration.
- **Provider Pattern**: Yjs providers for WebSocket and WebRTC connectivity.
- **Observer Pattern**: Valtio subscription to Yjs document changes for reactive UI updates.
- **Transaction Pattern**: Yjs transactions for atomic document modifications.
- **Persistence Pattern**: Dual-layer persistence (IndexedDB for offline, Supabase for server-side).
- **Signaling Pattern**: Socket.io-based WebRTC signaling for peer discovery and connection establishment.

## Quick References

- **Dev**: `pnpm dev` (Next.js dev server)
- **Build**: `pnpm build` (Next.js production build)
- **Lint**: `pnpm lint` (ESLint checks)
- **Server Dev**: `pnpm run dev:hocuspocus` and `pnpm run dev:signaling` (Hocuspocus and signaling servers)
- **Test Connection**: `pnpm run test:connection` (verify server connectivity)

## Development Workflow

1. **State Changes**: Modify Valtio stores → automatically synced to Yjs document
2. **Document Updates**: Yjs changes → Valtio observers → React re-renders
3. **Persistence**: Yjs operations → Hocuspocus server → Supabase database
4. **Real-time Sync**: WebRTC for P2P → WebSocket fallback via Hocuspocus
5. **Offline Support**: IndexedDB persistence → sync when online

## Key Integration Points

- **Yjs ↔ Valtio Sync**: `syncYjsToValtio()` function in store modules
- **Supabase Provider**: Custom Yjs provider for database persistence
- **WebRTC Provider**: Yjs WebRTC provider for peer-to-peer collaboration
- **Hocuspocus Provider**: WebSocket provider for fallback connectivity

# Refactoring Plan: Generic Data Sync and Storage with Yjs

This plan outlines steps to refactor the project for handling arbitrary data types using Hocuspocus, WebRTC, and IndexedDB. It includes configurable DB tables, Zod schemas for entities, and support for polymorphic drawables (e.g., abstract Drawable with Rectangle/Ellipse subclasses).

## Prerequisites
- Ensure all dependencies (Yjs, Zod, Hocuspocus, etc.) are up-to-date.
- Backup the current codebase and database.

## Step 1: Define Zod Schemas and Entity Configs
Create schemas for entities and a registry for configurations.

- [ ] Create new file `web/lib/schemas.ts`.
- [ ] Define base helpers for Yjs-compatible schemas (yTextSchema, yArraySchema, yMapSchema).
- [ ] Implement polymorphic drawableSchema using z.discriminatedUnion for types like 'rectangle' and 'ellipse'.
- [ ] Add example documentSchema with nested fields (e.g., drawables array, comments array of maps).
- [ ] Create entityConfigs object with entries for 'document' (schema, tableName, yjsBuilder).
- [ ] Add type EntityType as keyof entityConfigs.
- [ ] Test schemas by parsing sample data objects.

## Step 2: Abstract Yjs Providers and Sync Logic
Parameterize providers by entityType and entityId.

- [ ] Update `web/lib/yjs-providers.ts` to accept entityType and entityId, construct documentName as `${entityType}:${entityId}`.
- [ ] Integrate entityConfigs.yjsBuilder to initialize Yjs structures in setupProviders.
- [ ] Modify `web/hooks/useYjs.tsx` to take entityType/entityId parameters.
- [ ] Generalize syncYjsToValtio in `web/store/document.ts` to handle any entityType recursively.
- [ ] Add Zod validation before applying updates in hooks.
- [ ] Test provider setup with a non-rectangle entity (e.g., simple text document).

## Step 3: Configurable Database Storage
Make server-side persistence dynamic.

- [ ] Update `server/supabase-schema.sql` to include entity_types table for mapping types to table_names.
- [ ] Create example tables for new entity types (e.g., documents, user_profiles).
- [ ] In `server/hocuspocus-server.ts`, configure Database extension with fetch/store hooks that parse documentName to get entityType/tableName.
- [ ] Add entity_type column to document_updates table for entity-specific updates.
- [ ] Implement server-side Zod validation in Hocuspocus hooks to reject invalid data.
- [ ] Test persistence by creating/updating a generic entity and verifying DB storage.

## Step 4: Handle Polymorphic Drawables in UI
Refactor components to support abstract Drawable.

- [ ] Create new `web/components/Drawable.tsx` as a switch-based component rendering based on type (Rectangle, Ellipse, etc.).
- [ ] Update `web/components/KonvaCanvas.tsx` to map Y.Array('drawables') to Drawable components instead of hardcoding Rectangle.
- [ ] Create `web/components/Ellipse.tsx` (similar to Rectangle.tsx) for testing polymorphism.
- [ ] Refactor `web/components/Rectangle.tsx` to extend base props.
- [ ] Update types in `web/types.ts` to include Drawable interface.
- [ ] Test rendering and editing of mixed drawables (rectangles + ellipses).

## Step 5: Testing and Edge Cases
Ensure robustness.

- [ ] Test deep nesting: Create a document with array of Y.Maps containing Y.Text.
- [ ] Verify offline sync: Disconnect network, edit, reconnect, check IndexedDB/Hocuspocus merge.
- [ ] Test polymorphism: Add ellipse to canvas, sync across clients.
- [ ] Handle large docs: Simulate with 1000+ nested items, check performance.
- [ ] Validate errors: Attempt invalid data, ensure Zod rejects and logs.
- [ ] Run full e2e tests using P2P_TESTING_GUIDE.md extended for generics.

## Step 6: Deployment and Cleanup
- [ ] Migrate existing rectangle data to new 'drawable' entity type.
- [ ] Update README.md and other docs with generic usage.
- [ ] Remove hardcoded rectangle logic from codebase.
- [ ] Deploy to staging, monitor for issues.
- [ ] Celebrate! 🎉

Track progress by checking off items as completed.

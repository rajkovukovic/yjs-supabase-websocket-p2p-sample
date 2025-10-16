-- ================================================
-- Yjs Generic Entities - Supabase Schema
-- ================================================
-- This schema provides persistent storage for Yjs documents
-- using a simplified two-table model:
-- 1. yjs_entities: Stores the main state (header) of any entity.
-- 2. yjs_entity_deltas: Stores the incremental updates (deltas) for any entity.
-- ================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================
-- Generic Entities Table (Headers)
-- ================================================
-- Stores the current state of each Yjs document for any entity type.
CREATE TABLE IF NOT EXISTS yjs_entities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT NOT NULL,
    yjs_state BYTEA,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE yjs_entities IS 'Stores Yjs document headers/main states for various entity types.';
COMMENT ON COLUMN yjs_entities.id IS 'Unique document identifier (UUID)';
COMMENT ON COLUMN yjs_entities.type IS 'The type of the entity (e.g., ''document'', ''user_profile'').';
COMMENT ON COLUMN yjs_entities.yjs_state IS 'The compressed binary state of the Yjs document.';
COMMENT ON COLUMN yjs_entities.metadata IS 'Entity metadata, such as title, that is not part of the Yjs document.';

-- ================================================
-- Entity Deltas Table (Updates)
-- ================================================
-- Stores incremental updates for any entity.
CREATE TABLE IF NOT EXISTS yjs_entity_deltas (
    id BIGSERIAL PRIMARY KEY,
    entity_id UUID NOT NULL,
    entity_type TEXT NOT NULL,
    update BYTEA NOT NULL,
    client_id TEXT,
    clock BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE yjs_entity_deltas IS 'Stores incremental Yjs updates (deltas) for any entity type.';
COMMENT ON COLUMN yjs_entity_deltas.entity_id IS 'Foreign key to the yjs_entities table.';
COMMENT ON COLUMN yjs_entity_deltas.entity_type IS 'The type of entity this update belongs to (e.g., ''document'').';

-- ================================================
-- Indexes for Performance
-- ================================================

-- Entities table indexes
CREATE INDEX IF NOT EXISTS idx_yjs_entities_type ON yjs_entities(type);
CREATE INDEX IF NOT EXISTS idx_yjs_entities_updated ON yjs_entities(updated_at DESC);

-- Deltas table indexes
CREATE INDEX IF NOT EXISTS idx_yjs_entity_deltas_entity_id ON yjs_entity_deltas(entity_id);
CREATE INDEX IF NOT EXISTS idx_yjs_entity_deltas_entity_type ON yjs_entity_deltas(entity_type);
CREATE INDEX IF NOT EXISTS idx_yjs_entity_deltas_created ON yjs_entity_deltas(created_at DESC);

-- ================================================
-- Triggers for Automatic Updated_at
-- ================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for entities table
DROP TRIGGER IF EXISTS update_yjs_entities_updated_at ON yjs_entities;
CREATE TRIGGER update_yjs_entities_updated_at
    BEFORE UPDATE ON yjs_entities
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


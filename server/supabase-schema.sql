-- ================================================
-- Yjs Generic Entities - Supabase Schema
-- ================================================
-- This schema provides persistent storage for Yjs documents
-- with support for incremental updates and snapshots, designed
-- to handle arbitrary entity types.
-- ================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================
-- Entity Type Management
-- ================================================
-- This table maps entity types to their storage tables.
CREATE TABLE IF NOT EXISTS entity_types (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    table_name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE entity_types IS 'Maps entity type names to their database table names.';

-- Insert initial entity types.
INSERT INTO entity_types (name, table_name, description) VALUES
    ('document', 'entities', 'Generic document entities'),
    ('user_profile', 'user_profiles', 'User profile information')
ON CONFLICT (name) DO NOTHING;

-- ================================================
-- Generic Entities Table
-- ================================================
-- Stores the current state of each Yjs document for any entity type.
CREATE TABLE IF NOT EXISTS entities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL, -- Format: 'entityType:entityId'
    yjs_state BYTEA,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE entities IS 'Stores Yjs document states for various entity types.';
COMMENT ON COLUMN entities.name IS 'Unique document identifier, e.g., ''document:my-doc-id''';
COMMENT ON COLUMN entities.yjs_state IS 'Encoded Yjs document state as binary data';
COMMENT ON COLUMN entities.metadata IS 'Optional entity metadata (title, tags, etc.)';

-- ================================================
-- Legacy Documents Table (to be deprecated)
-- ================================================
-- This table is kept for backward compatibility but will be phased out.
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    yjs_state BYTEA,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- Document Updates Table (Modified for Generic Entities)
-- ================================================
-- Stores incremental updates for any entity.
-- NOTE: The foreign key to `documents` table is removed to support generic entities.
CREATE TABLE IF NOT EXISTS document_updates (
    id BIGSERIAL PRIMARY KEY,
    document_name TEXT NOT NULL,
    entity_type TEXT NOT NULL DEFAULT 'document', -- New column to specify entity type
    update BYTEA NOT NULL,
    client_id TEXT,
    clock BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Drop old foreign key constraint if it exists
ALTER TABLE document_updates DROP CONSTRAINT IF EXISTS document_updates_document_name_fkey;

COMMENT ON TABLE document_updates IS 'Stores incremental Yjs updates for any entity type.';
COMMENT ON COLUMN document_updates.document_name IS 'References the ''name'' in the corresponding entity table.';
COMMENT ON COLUMN document_updates.entity_type IS 'The type of entity this update belongs to (e.g., ''document'').';

-- ================================================
-- User Profiles Table (Example of another entity type)
-- ================================================
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL, -- 'user_profile:userId'
    yjs_state BYTEA,
    username TEXT,
    bio TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE user_profiles IS 'Stores user profile data managed via Yjs.';

-- ================================================
-- Indexes for Performance
-- ================================================

-- Entity types table index
CREATE INDEX IF NOT EXISTS idx_entity_types_name ON entity_types(name);

-- Entities table indexes
CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name);
CREATE INDEX IF NOT EXISTS idx_entities_updated ON entities(updated_at DESC);

-- Updates table indexes
CREATE INDEX IF NOT EXISTS idx_updates_doc ON document_updates(document_name);
CREATE INDEX IF NOT EXISTS idx_updates_entity_type ON document_updates(entity_type);
CREATE INDEX IF NOT EXISTS idx_updates_created ON document_updates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_updates_clock ON document_updates(clock);

-- User profiles table indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_name ON user_profiles(name);

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
DROP TRIGGER IF EXISTS update_entities_updated_at ON entities;
CREATE TRIGGER update_entities_updated_at
    BEFORE UPDATE ON entities
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for user_profiles table
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- (Legacy) Trigger for documents table
DROP TRIGGER IF EXISTS update_documents_updated_at ON documents;
CREATE TRIGGER update_documents_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


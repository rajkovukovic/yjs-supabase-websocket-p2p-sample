-- ================================================
-- Yjs Collaborative Editor - Supabase Schema
-- ================================================
-- This schema provides persistent storage for Yjs documents
-- with support for incremental updates and snapshots.

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================
-- Main Documents Table
-- ================================================
-- Stores the current state of each Yjs document
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  yjs_state BYTEA,                    -- Binary Yjs state (Y.encodeStateAsUpdate)
  metadata JSONB DEFAULT '{}',        -- Optional metadata (title, description, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comment for documentation
COMMENT ON TABLE documents IS 'Stores Yjs document states for real-time collaboration';
COMMENT ON COLUMN documents.name IS 'Unique document identifier (used by clients)';
COMMENT ON COLUMN documents.yjs_state IS 'Encoded Yjs document state as binary data';
COMMENT ON COLUMN documents.metadata IS 'Optional document metadata (title, tags, etc.)';

-- ================================================
-- Document Updates Table
-- ================================================
-- Stores incremental updates for audit trail and debugging
CREATE TABLE IF NOT EXISTS document_updates (
  id BIGSERIAL PRIMARY KEY,
  document_name TEXT NOT NULL REFERENCES documents(name) ON DELETE CASCADE,
  update BYTEA NOT NULL,              -- Individual Y.Update binary
  client_id TEXT,                     -- Client that made the update
  clock BIGINT,                       -- Logical clock from update
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comment for documentation
COMMENT ON TABLE document_updates IS 'Stores incremental Yjs updates for audit and replay';
COMMENT ON COLUMN document_updates.update IS 'Individual Yjs update as binary data';
COMMENT ON COLUMN document_updates.clock IS 'Logical clock value from the update';

-- ================================================
-- Document Snapshots Table (Optional)
-- ================================================
-- Stores periodic snapshots to compress update history
CREATE TABLE IF NOT EXISTS document_snapshots (
  id BIGSERIAL PRIMARY KEY,
  document_name TEXT NOT NULL REFERENCES documents(name) ON DELETE CASCADE,
  snapshot BYTEA NOT NULL,            -- Snapshot of document state
  update_count INTEGER,               -- Number of updates in this snapshot
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comment for documentation
COMMENT ON TABLE document_snapshots IS 'Periodic snapshots to compress update history';
COMMENT ON COLUMN document_snapshots.snapshot IS 'Compressed document state snapshot';
COMMENT ON COLUMN document_snapshots.update_count IS 'Number of updates merged into this snapshot';

-- ================================================
-- Indexes for Performance
-- ================================================

-- Documents table indexes
CREATE INDEX IF NOT EXISTS idx_doc_name ON documents(name);
CREATE INDEX IF NOT EXISTS idx_doc_updated ON documents(updated_at DESC);

-- Updates table indexes
CREATE INDEX IF NOT EXISTS idx_updates_doc ON document_updates(document_name);
CREATE INDEX IF NOT EXISTS idx_updates_created ON document_updates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_updates_clock ON document_updates(clock);

-- Snapshots table indexes
CREATE INDEX IF NOT EXISTS idx_snapshots_doc ON document_snapshots(document_name);
CREATE INDEX IF NOT EXISTS idx_snapshots_created ON document_snapshots(created_at DESC);

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

-- Trigger for documents table
DROP TRIGGER IF EXISTS update_documents_updated_at ON documents;
CREATE TRIGGER update_documents_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- Row Level Security (RLS) - Currently Disabled for MVP
-- ================================================
-- For production, enable RLS and add policies:

-- Enable RLS on documents table
-- ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Example policy for authenticated users
-- CREATE POLICY "Users can view all documents" ON documents
--   FOR SELECT TO authenticated
--   USING (true);

-- CREATE POLICY "Users can insert documents" ON documents
--   FOR INSERT TO authenticated
--   WITH CHECK (true);

-- CREATE POLICY "Users can update documents" ON documents
--   FOR UPDATE TO authenticated
--   USING (true);

-- ================================================
-- Utility Functions
-- ================================================

-- Function to get document statistics
CREATE OR REPLACE FUNCTION get_document_stats(doc_name TEXT)
RETURNS TABLE (
  document_name TEXT,
  update_count BIGINT,
  latest_update TIMESTAMPTZ,
  state_size BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.name,
    COUNT(u.id),
    MAX(u.created_at),
    LENGTH(d.yjs_state)
  FROM documents d
  LEFT JOIN document_updates u ON d.name = u.document_name
  WHERE d.name = doc_name
  GROUP BY d.name, d.yjs_state;
END;
$$ LANGUAGE plpgsql;

-- Function to clean old updates (keep last N days)
CREATE OR REPLACE FUNCTION cleanup_old_updates(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM document_updates
  WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ================================================
-- Sample Data (Optional - for testing)
-- ================================================

-- Uncomment to insert sample document
/*
INSERT INTO documents (name, metadata) VALUES
  ('test-doc', '{"title": "Test Document", "description": "A sample collaborative document"}')
ON CONFLICT (name) DO NOTHING;
*/

-- ================================================
-- Verification Queries
-- ================================================

-- Check if all tables exist
SELECT 
  'documents' as table_name, 
  EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'documents') as exists
UNION ALL
SELECT 
  'document_updates', 
  EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'document_updates')
UNION ALL
SELECT 
  'document_snapshots', 
  EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'document_snapshots');

-- Count records in each table
SELECT 'documents' as table_name, COUNT(*) as count FROM documents
UNION ALL
SELECT 'document_updates', COUNT(*) FROM document_updates
UNION ALL
SELECT 'document_snapshots', COUNT(*) FROM document_snapshots;


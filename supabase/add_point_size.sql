-- Ekzekuto këtë në Supabase SQL Editor
-- Shton kolonën point_size në tabelën layers

ALTER TABLE layers
  ADD COLUMN IF NOT EXISTS point_size integer DEFAULT 16;

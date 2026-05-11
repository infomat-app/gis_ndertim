-- Ekzekuto këtë në Supabase SQL Editor
-- Shton kolonën clustering në tabelën layers

ALTER TABLE layers
  ADD COLUMN IF NOT EXISTS clustering boolean DEFAULT false;

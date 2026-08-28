-- Add short_code column for shorter invite URLs
ALTER TABLE accountability_invitations ADD COLUMN short_code TEXT;

-- Generate short codes for existing invitations
UPDATE accountability_invitations
SET short_code = upper(substring(replace(id::text, '-', ''), 1, 8))
WHERE short_code IS NULL;

-- Add unique constraint and index
ALTER TABLE accountability_invitations ALTER COLUMN short_code SET NOT NULL;
ALTER TABLE accountability_invitations ADD CONSTRAINT accountability_invitations_short_code_unique UNIQUE (short_code);
CREATE INDEX idx_accountability_invitations_short_code ON accountability_invitations (short_code);

-- Add checked_in_by column to tickets table to track which volunteer performed the admission
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS checked_in_by TEXT;

-- Create an index for faster lookups if needed (though mostly for display)
CREATE INDEX IF NOT EXISTS idx_tickets_checked_in_by ON tickets(checked_in_by);

-- Add last_checked_in_at column to tickets table
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS last_checked_in_at TIMESTAMP WITH TIME ZONE;

-- Create an index for faster sorting by check-in time
CREATE INDEX IF NOT EXISTS idx_tickets_last_checked_in_at ON tickets(last_checked_in_at);

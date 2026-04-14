-- Add partial check-in support to tickets table
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS checked_in_count INTEGER DEFAULT 0;

-- Create a table to log each check-in transaction
CREATE TABLE IF NOT EXISTS ticket_checkins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    count INTEGER NOT NULL CHECK (count > 0),
    checked_in_name TEXT, -- Name of the person checking in (e.g. self or family member)
    staff_name TEXT,     -- Name of the staff who processed this (optional for now)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_ticket_checkins_ticket_id ON ticket_checkins(ticket_id);

-- Update existing 'checked_in' status tickets to have checked_in_count = quantity
UPDATE tickets SET checked_in_count = quantity WHERE status = 'checked_in';

-- Add a searchable text version of the ID to support short-code lookups in the dashboard
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS id_text TEXT GENERATED ALWAYS AS (id::text) STORED;
CREATE INDEX IF NOT EXISTS idx_tickets_id_text ON tickets (id_text);

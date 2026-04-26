-- Add WhatsApp Message ID column to link with Meta Webhooks
ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS wa_message_id TEXT;

-- Index for faster lookups when webhook hits
CREATE INDEX IF NOT EXISTS idx_tickets_wa_message_id ON tickets(wa_message_id);

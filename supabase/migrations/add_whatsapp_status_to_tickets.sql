-- Add WhatsApp delivery tracking columns to tickets table
ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS whatsapp_status TEXT DEFAULT 'not_sent',
ADD COLUMN IF NOT EXISTS whatsapp_error TEXT,
ADD COLUMN IF NOT EXISTS last_whatsapp_at TIMESTAMPTZ;

-- Possible values for whatsapp_status: 'not_sent', 'sent', 'failed'

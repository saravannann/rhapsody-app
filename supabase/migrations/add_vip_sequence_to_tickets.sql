-- Add vip_sequence_number to tickets table
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS vip_sequence_number INTEGER;

-- Create a sequence for VIP tickets
CREATE SEQUENCE IF NOT EXISTS vip_ticket_sequence;

-- Create a trigger function to populate vip_sequence_number
CREATE OR REPLACE FUNCTION populate_vip_sequence()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.type = 'VIP' THEN
        NEW.vip_sequence_number := nextval('vip_ticket_sequence');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_populate_vip_sequence ON tickets;
CREATE TRIGGER trg_populate_vip_sequence
BEFORE INSERT ON tickets
FOR EACH ROW
EXECUTE FUNCTION populate_vip_sequence();

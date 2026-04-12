-- Table to track mass WhatsApp broadcasts and scheduled notifications
CREATE TABLE IF NOT EXISTS public.broadcasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Notification Details
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    broadcast_type TEXT NOT NULL DEFAULT 'text', -- 'text', 'image', 'survey'
    
    -- Assets
    image_url TEXT,
    survey_url TEXT,
    
    -- Targeting
    target_type TEXT NOT NULL, -- 'buyers', 'organisers', 'custom'
    target_categories JSONB DEFAULT '[]'::jsonb, -- ['Platinum Pass', 'Donor Pass'] etc.
    target_organisers JSONB DEFAULT '[]'::jsonb, -- ['Org A', 'Org B']
    exclude_checked_in BOOLEAN DEFAULT TRUE, -- If TRUE, don't send to guests who already checked in
    
    -- Execution
    scheduled_at TIMESTAMPTZ, -- If NULL, send immediately
    status DEFAULT 'draft', -- 'draft', 'scheduled', 'sending', 'sent', 'failed'
    
    -- Tracking
    total_recipients INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    error_log TEXT,
    
    -- Meta
    created_by TEXT -- Admin who created it
);

-- Enable RLS
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;

-- Allow admins to manage broadcasts
CREATE POLICY "Admins can manage broadcasts" ON public.broadcasts
    USING (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND (role = 'admin' OR 'admin' = ANY(roles))
    ));

-- Update timestamp on edit
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_broadcasts_updated_at
    BEFORE UPDATE ON public.broadcasts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

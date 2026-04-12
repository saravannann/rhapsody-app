-- Create broadcasts table for WhatsApp campaigns
CREATE TABLE IF NOT EXISTS public.broadcasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    broadcast_type TEXT NOT NULL DEFAULT 'text', -- 'text', 'image', 'survey'
    target_type TEXT NOT NULL, -- 'buyers', 'organisers'
    target_categories TEXT[], -- Array of ticket categories like 'Platinum Pass'
    image_url TEXT,
    survey_url TEXT,
    scheduled_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'scheduled', 'sent', 'failed'
    total_recipients INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;

-- 1. Allow Viewing History (Matching profile pattern)
CREATE POLICY "broadcasts_select_anon" ON public.broadcasts
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- 2. Allow Inserting New Broadcasts
CREATE POLICY "broadcasts_insert_anon" ON public.broadcasts
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- 3. Allow Full Management
CREATE POLICY "broadcasts_manage_anon" ON public.broadcasts
    FOR ALL 
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

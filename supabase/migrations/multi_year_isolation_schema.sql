-- 1. Enhance events table
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS year INTEGER;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active'; -- 'active', 'upcoming', 'archived'
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;

-- Update existing event (assuming it's the 2026 festival)
UPDATE public.events 
SET year = 2026, status = 'active', is_default = true 
WHERE id = '1760ad65-52a2-4f54-98cc-9c0df824384d';

-- 2. Link tickets to events
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id);

-- Migration: Link all current tickets to the existing event
UPDATE public.tickets SET event_id = '1760ad65-52a2-4f54-98cc-9c0df824384d' WHERE event_id IS NULL;

-- 3. Create event_targets table to isolate organiser goals per year
CREATE TABLE IF NOT EXISTS public.event_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    targets JSONB NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE(profile_id, event_id)
);

-- Enable RLS on new table
ALTER TABLE public.event_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_targets_select_all" ON public.event_targets FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "event_targets_manage_all" ON public.event_targets FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 4. Initial Data Migration for Targets
-- Copy existing targets from profiles to event_targets for the 2026 event
INSERT INTO public.event_targets (profile_id, event_id, targets)
SELECT id, '1760ad65-52a2-4f54-98cc-9c0df824384d', pass_targets
FROM public.profiles
WHERE pass_targets IS NOT NULL AND pass_targets::text != '{}'
ON CONFLICT (profile_id, event_id) DO UPDATE SET targets = EXCLUDED.targets;

-- Note: We keep the pass_targets column in profiles for now to avoid breaking existing code, 
-- but will eventually move logic to use event_targets.

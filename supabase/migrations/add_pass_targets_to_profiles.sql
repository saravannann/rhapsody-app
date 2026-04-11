-- Per-organiser quotas for pass types (set from Admin → Organisers → Edit targets).
-- Shape: { "Platinum Pass": 50, "Donor Pass": 15, "Bulk Tickets": 100, "Student Pass": 40 }

alter table public.profiles
  add column if not exists pass_targets jsonb;

comment on column public.profiles.pass_targets is 'JSON map of pass display name → numeric target; merged with app defaults when null or partial';

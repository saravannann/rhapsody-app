-- Run in Supabase SQL editor if tickets insert fails on funds_destination:
-- alter table tickets add column if not exists funds_destination text check (funds_destination in ('trust', 'organizer'));

alter table tickets add column if not exists funds_destination text;

comment on column tickets.funds_destination is 'trust = Thenmozhi Memorial Trust; organizer = selling organiser';

-- One row per sale; quantity = number of passes in that transaction.
alter table public.tickets add column if not exists quantity integer default 1;

update public.tickets set quantity = greatest(1, coalesce(quantity, 1)) where quantity is null or quantity < 1;

alter table public.tickets alter column quantity set default 1;
alter table public.tickets alter column quantity set not null;

comment on column public.tickets.quantity is 'Passes in this sale (single transaction row). Price is per pass.';

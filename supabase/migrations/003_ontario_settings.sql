-- Align cloud settings with Ontario sole-prop bookkeeping
alter table public.user_settings
  add column if not exists business_start_date date,
  add column if not exists hst_registered boolean not null default false,
  add column if not exists amounts_include_hst boolean not null default false,
  add column if not exists other_annual_income numeric(12, 2) not null default 0;

alter table public.user_settings
  alter column currency set default 'CAD';

update public.user_settings
  set currency = 'CAD'
  where currency is null or currency = 'USD';

update public.user_settings
  set business_start_date = '2026-06-01'
  where business_start_date is null;

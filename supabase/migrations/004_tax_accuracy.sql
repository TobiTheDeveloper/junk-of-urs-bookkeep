-- Vehicle / phone business-use % and receipt-total HST default
alter table public.user_settings
  add column if not exists vehicle_business_use_percent numeric(5, 2) not null default 100,
  add column if not exists phone_internet_business_use_percent numeric(5, 2) not null default 100;

alter table public.user_settings
  alter column amounts_include_hst set default true;

update public.user_settings
  set amounts_include_hst = true
  where amounts_include_hst is distinct from true
    and coalesce(hst_registered, false) = false;

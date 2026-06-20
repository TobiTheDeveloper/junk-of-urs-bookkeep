-- Add import_key for cross-device duplicate prevention

alter table public.transactions
  add column if not exists import_key text;

create unique index if not exists transactions_user_import_key_idx
  on public.transactions (user_id, import_key)
  where import_key is not null;

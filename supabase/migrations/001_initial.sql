-- Junk Of Urs Bookkeeper — Supabase schema
-- Run in Supabase SQL Editor or via: supabase db push

create extension if not exists "uuid-ossp";

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

create table if not exists public.categories (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  icon text not null default 'tag',
  color text not null default '#64748b',
  is_default boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('income', 'expense')),
  amount numeric(12, 2) not null,
  date date not null,
  description text not null default '',
  category_id uuid references public.categories (id) on delete set null,
  income_source text check (income_source in ('subcontractor', 'junk_removal')),
  vendor text not null default '',
  client text not null default '',
  receipt_id uuid,
  is_tax_deductible boolean not null default true,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.receipts (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  storage_path text,
  mime_type text not null default 'image/jpeg',
  file_name text not null default 'receipt.jpg',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.transactions
  add constraint transactions_receipt_id_fkey
  foreign key (receipt_id) references public.receipts (id) on delete set null;

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  business_name text not null default 'Junk Of Urs',
  income_tax_rate numeric(5, 2) not null default 22,
  self_employment_rate numeric(5, 2) not null default 15.3,
  fiscal_year_start int not null default 1,
  currency text not null default 'USD',
  quarterly_reminders_enabled boolean not null default true,
  dismissed_reminder_key text,
  last_synced_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists categories_user_id_idx on public.categories (user_id);
create index if not exists transactions_user_id_idx on public.transactions (user_id);
create index if not exists transactions_date_idx on public.transactions (date);
create index if not exists receipts_user_id_idx on public.receipts (user_id);

alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.receipts enable row level security;
alter table public.user_settings enable row level security;

create policy "categories_own" on public.categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "transactions_own" on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "receipts_own" on public.receipts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "settings_own" on public.user_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "receipts_storage_select" on storage.objects
  for select using (bucket_id = 'receipts' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "receipts_storage_insert" on storage.objects
  for insert with check (bucket_id = 'receipts' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "receipts_storage_update" on storage.objects
  for update using (bucket_id = 'receipts' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "receipts_storage_delete" on storage.objects
  for delete using (bucket_id = 'receipts' and auth.uid()::text = (storage.foldername(name))[1]);

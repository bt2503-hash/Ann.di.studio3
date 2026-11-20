-- ann.di.studio: database schema for customer accounts and orders
-- Run this entire file in Supabase Dashboard → SQL Editor → New query → Run.

create extension if not exists pgcrypto;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_number text not null unique,
  customer text not null,
  email text not null,
  phone text not null,
  city text,
  region text,
  branch text,
  address text,
  delivery text,
  payment text,
  comment text,
  items jsonb not null default '[]'::jsonb,
  total numeric(12,2) not null default 0 check (total >= 0),
  status text not null default 'Нове',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_user_id_created_at_idx
  on public.orders(user_id, created_at desc);

alter table public.orders enable row level security;

-- A signed-in customer can create an order only for their own account.
drop policy if exists "Customers create own orders" on public.orders;
create policy "Customers create own orders"
  on public.orders for insert to authenticated
  with check (auth.uid() = user_id);

-- Customers can see only their own order history.
drop policy if exists "Customers read own orders" on public.orders;
create policy "Customers read own orders"
  on public.orders for select to authenticated
  using (auth.uid() = user_id);

-- Admin access is granted only by app_metadata.role = 'admin'
-- (set by a project owner in Supabase; users cannot edit app_metadata themselves).
drop policy if exists "Admins manage all orders" on public.orders;
create policy "Admins manage all orders"
  on public.orders for all to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.orders to authenticated;

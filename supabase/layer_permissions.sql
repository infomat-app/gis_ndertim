-- ============================================================
-- GIS Ndertim — Lejet e Shtresave per Perdorues
-- Ekzekuto kete ne Supabase SQL Editor (pas schema.sql)
-- ============================================================

create table if not exists public.layer_permissions (
  id          uuid primary key default gen_random_uuid(),
  layer_id    uuid not null references public.layers(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  permission  text not null check (permission in ('none','view','edit')),
  created_at  timestamptz default now(),
  unique(layer_id, user_id)
);

alter table public.layer_permissions enable row level security;

-- Admin menaxhon te gjitha lejet
create policy "admin_all_layer_permissions" on public.layer_permissions
  for all using (public.my_role() = 'admin');

-- Perdoruesit shohin lejet e tyre
create policy "users_read_own_layer_permissions" on public.layer_permissions
  for select using (user_id = auth.uid());

-- ============================================================
-- GIS Ndertim - Supabase Schema
-- Ekzekuto kete ne Supabase SQL Editor
-- ============================================================

-- Profili i perdoruesve (extends auth.users)
create table if not exists public.profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  email       text not null,
  full_name   text,
  role        text not null default 'viewer'
                check (role in ('admin','editor','field','viewer')),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Shtresat GIS
create table if not exists public.layers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  geom_type   text not null check (geom_type in ('Point','LineString','Polygon')),
  color       text not null default '#e91e8c',
  fill_color  text not null default '#e91e8c',
  opacity     float not null default 0.8,
  visible     boolean not null default true,
  sort_order  int not null default 0,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- Fusha te personalizuara per cdo shtrese
create table if not exists public.layer_fields (
  id             uuid primary key default gen_random_uuid(),
  layer_id       uuid references public.layers(id) on delete cascade not null,
  field_name     text not null,
  field_label    text not null,
  field_type     text not null default 'text'
                   check (field_type in ('text','number','date','select','textarea','boolean')),
  field_options  jsonb,   -- per select type: ["Opsion1","Opsion2"]
  required       boolean not null default false,
  sort_order     int not null default 0
);

-- Objekte GIS (pikat, vijat, poligonet)
create table if not exists public.features (
  id          uuid primary key default gen_random_uuid(),
  layer_id    uuid references public.layers(id) on delete cascade not null,
  geometry    jsonb not null,   -- GeoJSON geometry { type, coordinates }
  properties  jsonb not null default '{}',
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles    enable row level security;
alter table public.layers      enable row level security;
alter table public.layer_fields enable row level security;
alter table public.features    enable row level security;

-- Helper function: merr rolin e userit aktual
create or replace function public.my_role()
returns text language sql security definer stable as $$
  select role from public.profiles where id = auth.uid()
$$;

-- ---------- PROFILES ----------
create policy "Shiko profilet" on public.profiles
  for select using (auth.role() = 'authenticated');

create policy "Perdoruesit perditesojne profilin e tyre" on public.profiles
  for update using (id = auth.uid());

create policy "Admin perditeson te gjitha profilet" on public.profiles
  for update using (public.my_role() = 'admin');

-- ---------- LAYERS ----------
create policy "Shiko shtresat" on public.layers
  for select using (auth.role() = 'authenticated');

create policy "Editor/Admin krijon shtresa" on public.layers
  for insert with check (public.my_role() in ('admin','editor'));

create policy "Editor/Admin perditeson shtresa" on public.layers
  for update using (public.my_role() in ('admin','editor'));

create policy "Admin fshin shtresa" on public.layers
  for delete using (public.my_role() = 'admin');

-- ---------- LAYER FIELDS ----------
create policy "Shiko fushat e shtresave" on public.layer_fields
  for select using (auth.role() = 'authenticated');

create policy "Editor/Admin menaxhon fushat" on public.layer_fields
  for all using (public.my_role() in ('admin','editor'));

-- ---------- FEATURES ----------
create policy "Shiko objekte" on public.features
  for select using (auth.role() = 'authenticated');

create policy "Editor/Admin/Field shton objekte" on public.features
  for insert with check (public.my_role() in ('admin','editor','field'));

create policy "Editor/Admin perditeson objekte" on public.features
  for update using (
    public.my_role() in ('admin','editor')
    or created_by = auth.uid()
  );

create policy "Editor/Admin fshin objekte" on public.features
  for delete using (
    public.my_role() in ('admin','editor')
    or created_by = auth.uid()
  );

-- ============================================================
-- TRIGGER: krijo profil automatikisht pas regjistrimit
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- TRIGGER: updated_at automatik
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger layers_updated_at   before update on public.layers   for each row execute procedure public.set_updated_at();
create trigger features_updated_at before update on public.features for each row execute procedure public.set_updated_at();
create trigger profiles_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();

-- ============================================================
-- SHEMBULL: shtresa e pare (Kantiere Ndertimi)
-- ============================================================
-- Ekzekuto kete pasi te kesh krijuar llogarite e para te adminit
-- INSERT INTO public.layers (name, description, geom_type, color, fill_color)
-- VALUES ('Kantiere_Ndertimi', 'Kantiere aktive ndertimi ne Tirane', 'Point', '#e91e8c', '#e91e8c');

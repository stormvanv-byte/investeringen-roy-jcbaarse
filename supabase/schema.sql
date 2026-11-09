-- Auto-investeringen: database schema voor Supabase
-- Plak dit in Supabase > SQL Editor > New query en klik op "Run".

-- Auto's: elke aankoop is een rij.
--  * verkoopdatum leeg                 -> staat nog te koop
--  * verkoopdatum gevuld, winst leeg    -> verkocht, winst nog te bepalen
--  * verkoopdatum en winst_deel gevuld  -> afgerekend: inleg + winst komt terug als cash
create table if not exists public.cars (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  merk          text not null,
  model         text not null,
  bouwjaar      int,
  kenteken      text,
  inruil        text,
  aankoopdatum  date not null default current_date,
  aankoopprijs  numeric(12,2) not null check (aankoopprijs >= 0),
  kosten        numeric(12,2) not null default 0 check (kosten >= 0), -- extra kosten die jij hebt betaald
  verkoopdatum  date,
  winst_deel    numeric(12,2), -- jouw deel van de winst (mag negatief zijn bij verlies)
  notities      text,
  created_at    timestamptz not null default now(),
  constraint winst_na_verkoop check (winst_deel is null or verkoopdatum is not null)
);

-- Kasmutaties die geen auto zijn: geld inleggen of opnemen.
create table if not exists public.cash_movements (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  datum       date not null default current_date,
  soort       text not null check (soort in ('storting', 'opname')),
  bedrag      numeric(12,2) not null check (bedrag > 0),
  omschrijving text,
  created_at  timestamptz not null default now()
);

create index if not exists cars_user_idx on public.cars (user_id);
create index if not exists cash_movements_user_idx on public.cash_movements (user_id);

-- Row Level Security: iedere ingelogde gebruiker ziet en wijzigt alleen zijn eigen gegevens.
alter table public.cars enable row level security;
alter table public.cash_movements enable row level security;

drop policy if exists "eigen auto's" on public.cars;
create policy "eigen auto's" on public.cars
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "eigen kasmutaties" on public.cash_movements;
create policy "eigen kasmutaties" on public.cash_movements
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

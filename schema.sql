-- Run this once in Supabase > SQL Editor > New query > Run.
create table if not exists public.docs (
  owner      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  coll       text not null,
  id         text not null,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (owner, coll, id)
);
create index if not exists docs_owner_coll_idx on public.docs (owner, coll);

alter table public.docs enable row level security;

drop policy if exists "own rows select" on public.docs;
drop policy if exists "own rows insert" on public.docs;
drop policy if exists "own rows update" on public.docs;
drop policy if exists "own rows delete" on public.docs;
create policy "own rows select" on public.docs for select to authenticated using (owner = auth.uid());
create policy "own rows insert" on public.docs for insert to authenticated with check (owner = auth.uid());
create policy "own rows update" on public.docs for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
create policy "own rows delete" on public.docs for delete to authenticated using (owner = auth.uid());

-- realtime (live sync between phone and laptop)
alter table public.docs replica identity full;
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;

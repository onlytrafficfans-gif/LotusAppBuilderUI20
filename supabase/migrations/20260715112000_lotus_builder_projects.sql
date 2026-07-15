create table if not exists public.lotus_builder_projects (
  id text primary key,
  workspace_id text not null,
  owner_id uuid references auth.users(id) on delete cascade,
  name text not null,
  folder_id text not null,
  prompt text not null,
  style_seed integer not null,
  updated_at timestamptz not null default now(),
  saved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  pinned boolean not null default false
);

create index if not exists lotus_builder_projects_workspace_updated_idx
  on public.lotus_builder_projects (workspace_id, updated_at desc);

create index if not exists lotus_builder_projects_owner_updated_idx
  on public.lotus_builder_projects (owner_id, updated_at desc)
  where owner_id is not null;

create or replace function public.set_lotus_builder_projects_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_lotus_builder_projects_updated_at on public.lotus_builder_projects;
create trigger set_lotus_builder_projects_updated_at
before update on public.lotus_builder_projects
for each row
execute function public.set_lotus_builder_projects_updated_at();

alter table public.lotus_builder_projects enable row level security;

drop policy if exists "Authenticated users manage their builder projects" on public.lotus_builder_projects;
create policy "Authenticated users manage their builder projects"
on public.lotus_builder_projects
for all
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "Anonymous builder workspaces are allowed during preview" on public.lotus_builder_projects;
create policy "Anonymous builder workspaces are allowed during preview"
on public.lotus_builder_projects
for all
to anon
using (owner_id is null and workspace_id like 'local-%')
with check (owner_id is null and workspace_id like 'local-%');


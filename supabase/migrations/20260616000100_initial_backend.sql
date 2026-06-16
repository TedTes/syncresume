create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  plan text not null default 'Free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  file_type text not null check (file_type in ('pdf', 'docx', 'text')),
  storage_path text,
  extracted_text text not null,
  character_count integer not null default 0,
  usage_count integer not null default 0,
  is_active boolean not null default false,
  uploaded_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.optimization_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  resume_id uuid not null references public.resumes(id) on delete cascade,
  resume_name text not null,
  title text not null,
  job_description text not null,
  optimized_resume jsonb,
  score integer not null default 0,
  status text not null default 'draft' check (status in ('draft', 'exported')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.export_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid not null references public.optimization_runs(id) on delete cascade,
  export_type text not null check (export_type in ('docx', 'pdf', 'copy')),
  created_at timestamptz not null default now()
);

create unique index if not exists resumes_one_active_per_user
  on public.resumes(user_id)
  where is_active;

create index if not exists resumes_user_uploaded_at_idx
  on public.resumes(user_id, uploaded_at desc);

create index if not exists optimization_runs_user_created_at_idx
  on public.optimization_runs(user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists resumes_set_updated_at on public.resumes;
create trigger resumes_set_updated_at
before update on public.resumes
for each row execute function public.set_updated_at();

drop trigger if exists optimization_runs_set_updated_at on public.optimization_runs;
create trigger optimization_runs_set_updated_at
before update on public.optimization_runs
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.resumes enable row level security;
alter table public.optimization_runs enable row level security;
alter table public.export_events enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users can read own resumes"
  on public.resumes for select
  using (auth.uid() = user_id);

create policy "Users can insert own resumes"
  on public.resumes for insert
  with check (auth.uid() = user_id);

create policy "Users can update own resumes"
  on public.resumes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own resumes"
  on public.resumes for delete
  using (auth.uid() = user_id);

create policy "Users can read own runs"
  on public.optimization_runs for select
  using (auth.uid() = user_id);

create policy "Users can insert own runs"
  on public.optimization_runs for insert
  with check (auth.uid() = user_id);

create policy "Users can update own runs"
  on public.optimization_runs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own runs"
  on public.optimization_runs for delete
  using (auth.uid() = user_id);

create policy "Users can read own export events"
  on public.export_events for select
  using (auth.uid() = user_id);

create policy "Users can insert own export events"
  on public.export_events for insert
  with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resumes',
  'resumes',
  false,
  26214400,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can read own resume objects"
  on storage.objects for select
  using (
    bucket_id = 'resumes'
    and auth.uid()::text = split_part(name, '/', 1)
  );

create policy "Users can upload own resume objects"
  on storage.objects for insert
  with check (
    bucket_id = 'resumes'
    and auth.uid()::text = split_part(name, '/', 1)
  );

create policy "Users can update own resume objects"
  on storage.objects for update
  using (
    bucket_id = 'resumes'
    and auth.uid()::text = split_part(name, '/', 1)
  )
  with check (
    bucket_id = 'resumes'
    and auth.uid()::text = split_part(name, '/', 1)
  );

create policy "Users can delete own resume objects"
  on storage.objects for delete
  using (
    bucket_id = 'resumes'
    and auth.uid()::text = split_part(name, '/', 1)
  );

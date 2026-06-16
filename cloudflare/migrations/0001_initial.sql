create table if not exists users (
  id text primary key,
  email text not null unique,
  plan text not null default 'Free',
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp
);

create table if not exists magic_links (
  id text primary key,
  email text not null,
  token_hash text not null unique,
  expires_at text not null,
  used_at text,
  created_at text not null default current_timestamp
);

create index if not exists magic_links_email_idx
  on magic_links(email, created_at desc);

create table if not exists sessions (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at text not null,
  created_at text not null default current_timestamp
);

create index if not exists sessions_user_id_idx
  on sessions(user_id);

create table if not exists resumes (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  name text not null,
  file_type text not null check (file_type in ('pdf', 'docx', 'text')),
  storage_key text,
  extracted_text text not null,
  character_count integer not null default 0,
  usage_count integer not null default 0,
  is_active integer not null default 0,
  uploaded_at text not null default current_timestamp,
  updated_at text not null default current_timestamp
);

create unique index if not exists resumes_one_active_per_user
  on resumes(user_id)
  where is_active = 1;

create index if not exists resumes_user_uploaded_at_idx
  on resumes(user_id, uploaded_at desc);

create table if not exists optimization_runs (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  resume_id text not null references resumes(id) on delete cascade,
  resume_name text not null,
  title text not null,
  job_description text not null,
  optimized_resume text,
  score integer not null default 0,
  status text not null default 'draft' check (status in ('draft', 'exported')),
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp
);

create index if not exists optimization_runs_user_created_at_idx
  on optimization_runs(user_id, created_at desc);

create table if not exists export_events (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  run_id text not null references optimization_runs(id) on delete cascade,
  export_type text not null check (export_type in ('docx', 'pdf', 'copy')),
  created_at text not null default current_timestamp
);

create index if not exists export_events_run_id_idx
  on export_events(run_id, created_at desc);

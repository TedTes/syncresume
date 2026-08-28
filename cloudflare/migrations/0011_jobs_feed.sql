create table if not exists jobs (
  id text primary key,
  user_id text not null,
  source text not null default 'manual',
  external_id text,
  title text not null,
  company text not null default '',
  location text not null default '',
  url text not null default '',
  description text not null default '',
  salary text not null default '',
  employment_type text not null default '',
  remote text not null default '',
  status text not null default 'new' check (status in ('new', 'saved', 'dismissed', 'applied')),
  content_hash text not null,
  posted_at text,
  discovered_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  foreign key (user_id) references users(id) on delete cascade
);

create index if not exists idx_jobs_user_source_external
  on jobs(user_id, source, external_id);

create unique index if not exists idx_jobs_user_content_hash
  on jobs(user_id, content_hash);

create index if not exists idx_jobs_user_status_discovered
  on jobs(user_id, status, discovered_at desc);

create index if not exists idx_jobs_user_discovered
  on jobs(user_id, discovered_at desc);

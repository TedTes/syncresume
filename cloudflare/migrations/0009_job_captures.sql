create table if not exists extension_tokens (
  id text primary key,
  user_id text not null,
  token_hash text not null unique,
  label text not null default 'Browser extension',
  last_used_at text,
  expires_at text not null,
  revoked_at text,
  created_at text not null default current_timestamp,
  foreign key (user_id) references users(id) on delete cascade
);

create index if not exists idx_extension_tokens_user_id
  on extension_tokens(user_id);

create index if not exists idx_extension_tokens_hash
  on extension_tokens(token_hash);

create table if not exists job_captures (
  id text primary key,
  user_id text not null,
  title text not null default '',
  company text not null default '',
  location text not null default '',
  description text not null,
  source_url text not null default '',
  content_hash text not null,
  duplicate_of_id text,
  expires_at text not null,
  created_at text not null default current_timestamp,
  foreign key (user_id) references users(id) on delete cascade,
  foreign key (duplicate_of_id) references job_captures(id) on delete set null
);

create index if not exists idx_job_captures_user_hash
  on job_captures(user_id, content_hash);

create index if not exists idx_job_captures_user_created
  on job_captures(user_id, created_at desc);

create index if not exists idx_job_captures_source_url
  on job_captures(user_id, source_url);

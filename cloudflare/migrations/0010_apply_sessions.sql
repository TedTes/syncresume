create table if not exists apply_sessions (
  id text primary key,
  user_id text not null,
  run_id text,
  token_hash text not null unique,
  job_url text not null default '',
  file_name text not null,
  template_id text not null,
  resume_html text not null,
  created_at text not null default current_timestamp,
  expires_at text not null,
  last_used_at text,
  foreign key (user_id) references users(id) on delete cascade,
  foreign key (run_id) references optimization_runs(id) on delete cascade
);

create index if not exists idx_apply_sessions_user_created
  on apply_sessions(user_id, created_at desc);

create index if not exists idx_apply_sessions_token_hash
  on apply_sessions(token_hash);

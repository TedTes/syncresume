alter table users
  add column stripe_customer_id text;

alter table users
  add column subscription_status text not null default 'free';

alter table users
  add column subscription_current_period_end text;

create table if not exists subscriptions (
  id text primary key,
  user_id text not null,
  stripe_customer_id text not null,
  stripe_subscription_id text unique,
  plan text not null default 'Pro',
  status text not null,
  current_period_end text,
  cancel_at_period_end integer not null default 0,
  created_at text not null default current_timestamp,
  updated_at text not null default current_timestamp,
  foreign key (user_id) references users(id) on delete cascade
);

create index if not exists idx_subscriptions_user_id
  on subscriptions(user_id);

create index if not exists idx_subscriptions_stripe_customer_id
  on subscriptions(stripe_customer_id);

create index if not exists idx_subscriptions_stripe_subscription_id
  on subscriptions(stripe_subscription_id);

create table if not exists usage_limits (
  plan text primary key,
  monthly_ai_actions integer not null
);

insert into usage_limits (plan, monthly_ai_actions)
values ('Free', 3), ('Pro', 100)
on conflict(plan) do update set
  monthly_ai_actions = excluded.monthly_ai_actions;

create table if not exists usage_ledger (
  id text primary key,
  user_id text not null,
  action_type text not null,
  provider text not null,
  model text,
  request_units integer not null default 1,
  input_chars integer not null default 0,
  output_chars integer not null default 0,
  run_id text,
  billing_period text not null,
  created_at text not null default current_timestamp,
  foreign key (user_id) references users(id) on delete cascade,
  foreign key (run_id) references optimization_runs(id) on delete set null
);

create index if not exists idx_usage_ledger_user_period
  on usage_ledger(user_id, billing_period, created_at desc);

create table if not exists billing_events (
  id text primary key,
  provider_event_id text not null unique,
  event_type text not null,
  payload text not null,
  created_at text not null default current_timestamp
);

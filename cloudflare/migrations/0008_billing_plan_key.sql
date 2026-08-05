alter table users
  add column billing_plan_key text;

alter table subscriptions
  add column billing_plan_key text;

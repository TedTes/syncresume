alter table optimization_runs
  add column original_resume_text text;

alter table optimization_runs
  add column optimized_resume_text text;

alter table optimization_runs
  add column before_score integer not null default 0;

alter table optimization_runs
  add column matched_keywords text not null default '[]';

alter table optimization_runs
  add column partial_keywords text not null default '[]';

alter table optimization_runs
  add column missing_keywords text not null default '[]';

alter table optimization_runs
  add column selected_template_id text not null default 'ats-simple';

alter table optimization_runs
  add column tailored_resume_id text;

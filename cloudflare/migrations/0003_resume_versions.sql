alter table resumes
  add column version_type text not null default 'base';

alter table resumes
  add column source_resume_id text;

alter table resumes
  add column source_run_id text;

alter table resumes
  add column tailored_for text;

alter table resumes
  add column match_score integer;

create index if not exists resumes_source_resume_id_idx
  on resumes(source_resume_id, uploaded_at desc);

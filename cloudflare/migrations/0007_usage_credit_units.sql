alter table usage_ledger add column credit_units real;

update usage_ledger
set credit_units = request_units
where credit_units is null;

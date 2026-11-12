-- Folders inside list sections (e.g. HR & Payroll → Benefits & Rewards).
-- New enum value in its own migration: Postgres can't use it in the same transaction.
alter type public.node_kind add value if not exists 'folder';

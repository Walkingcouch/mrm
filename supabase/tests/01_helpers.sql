-- Tiny test harness. check() raises on failure; expect_error() runs SQL as the
-- current role and asserts it fails (optionally matching an SQLSTATE).
create schema if not exists test;
grant usage on schema test to anon, authenticated, service_role;

create or replace function test.check(cond boolean, label text) returns text
language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'FAIL: %', label; end if;
  raise notice 'ok - %', label;
  return 'ok';
end $$;

create or replace function test.expect_error(sql text, label text, state text default null) returns text
language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    if state is not null and sqlstate <> state then
      raise exception 'FAIL: % (expected %, got % %)', label, state, sqlstate, sqlerrm;
    end if;
    raise notice 'ok - % (% %)', label, sqlstate, sqlerrm;
    return 'ok';
  end;
  raise exception 'FAIL: % (no error raised)', label;
end $$;

create or replace function test.expect_ok(sql text, label text) returns text
language plpgsql as $$
begin
  execute sql;
  raise notice 'ok - %', label;
  return 'ok';
exception when others then
  raise exception 'FAIL: % (% %)', label, sqlstate, sqlerrm;
end $$;

-- Impersonation helpers (session-level, so they survive autocommit statements).
create or replace function test.as_admin(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, false);
  perform set_config('role', 'authenticated', false);
end $$;
create or replace function test.as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('role', 'anon', false);
end $$;
create or replace function test.as_service() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('role', 'service_role', false);
end $$;

grant execute on all functions in schema test to anon, authenticated, service_role;

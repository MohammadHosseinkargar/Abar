-- Run only against an isolated local/staging database after applying migrations.
-- Every change is rolled back; no product or queue data is retained.
begin;

do $$
declare
  test_unique constant text := '__torob_dedup_test__';
  row_count bigint;
  latest_type text;
begin
  delete from public.torob_webhook_queue where page_unique = test_unique;

  perform public.enqueue_torob_webhook_event(
    null, test_unique, '/products/first', 'upsert'
  );
  perform public.enqueue_torob_webhook_event(
    null, test_unique, '/products/second', 'remove'
  );

  select count(*), max(event_type)
  into row_count, latest_type
  from public.torob_webhook_queue
  where page_unique = test_unique and status in ('pending','failed');

  if row_count <> 1 or latest_type <> 'remove' then
    raise exception 'Torob queue sequential deduplication failed';
  end if;

  update public.torob_webhook_queue set status = 'processing'
  where page_unique = test_unique;
  perform public.enqueue_torob_webhook_event(
    null, test_unique, '/products/third', 'upsert'
  );

  select count(*) into row_count
  from public.torob_webhook_queue
  where page_unique = test_unique;
  if row_count <> 2 then
    raise exception 'Torob queue did not preserve processing row and create a new event';
  end if;
end $$;

rollback;

-- Race test (two psql sessions, staging only):
-- Session A: begin; select public.enqueue_torob_webhook_event(null,'__race__','/a','upsert');
-- Keep A open. Session B should block on:
-- begin; select public.enqueue_torob_webhook_event(null,'__race__','/b','remove');
-- Commit A, then commit B. The following must return exactly one row containing /b + remove:
-- select page_url,event_type from public.torob_webhook_queue
-- where page_unique='__race__' and status in ('pending','failed');

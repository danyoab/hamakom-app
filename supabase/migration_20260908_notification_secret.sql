-- Configure Vault hamakom_report_webhook_secret to match Edge WEBHOOK_SECRET first.
-- The secret is provisioned separately; never commit its value.
create or replace function public.notify_problem_report()
returns trigger
language plpgsql
security definer
set search_path = public, net
as $$
declare
  fn_url text := 'https://kyenbpkgxnjrknebbiyr.supabase.co/functions/v1/notify-report';
  webhook_secret text;
begin
  select decrypted_secret into webhook_secret from vault.decrypted_secrets where name='hamakom_report_webhook_secret';
  if webhook_secret is null then return NEW; end if;
  perform net.http_post(
    url := fn_url,
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'problem_reports',
      'schema', 'public',
      'record', to_jsonb(NEW)
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', webhook_secret
    ),
    timeout_milliseconds := 5000
  );
  return NEW;
end;
$$;

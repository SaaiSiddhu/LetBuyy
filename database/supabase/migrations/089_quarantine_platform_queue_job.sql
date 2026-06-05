-- Add immediate quarantine support for deterministic platform queue failures.
-- Transient failures still use fail_platform_queue_job and retry with backoff.

CREATE OR REPLACE FUNCTION public.quarantine_platform_queue_job(
  p_job_id uuid,
  p_worker_id text,
  p_error_message text,
  p_result jsonb DEFAULT '{}'::jsonb
) RETURNS public.platform_queue_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_job platform_queue_jobs;
  v_error_message text;
BEGIN
  v_error_message := LEFT(COALESCE(p_error_message, 'Queue job failed deterministic validation'), 2000);

  UPDATE platform_queue_jobs
     SET status = 'dead',
         locked_at = NULL,
         locked_by = NULL,
         failed_at = NOW(),
         error_message = v_error_message,
         result = COALESCE(p_result, '{}'::jsonb)
           || jsonb_build_object(
             'quarantined', true,
             'quarantine_reason', v_error_message,
             'quarantined_at', NOW()
           ),
         updated_at = NOW()
   WHERE id = p_job_id
     AND status = 'running'
     AND locked_by = p_worker_id
   RETURNING * INTO v_job;

  IF v_job.id IS NULL THEN
    RAISE EXCEPTION 'queue job % is not claimable by worker %', p_job_id, p_worker_id;
  END IF;

  RETURN v_job;
END;
$$;

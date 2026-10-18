-- Remove only the atomic reset writer; customer credentials and reset history are retained.
BEGIN;
DROP FUNCTION IF EXISTS public.confirm_customer_password_reset(uuid,text,text,text);
COMMIT;

-- 111_customer_credentials_source_of_truth.sql
-- Move legacy inline store_customers.password_hash values into
-- customer_credentials. The inline column remains for compatibility but must no
-- longer be written by application code.

BEGIN;

INSERT INTO public.customer_credentials (
  store_id,
  email_or_phone,
  password_hash,
  customer_id,
  created_at,
  updated_at
)
SELECT
  sc.store_id,
  lower(sc.email),
  sc.password_hash,
  sc.id,
  NOW(),
  NOW()
FROM public.store_customers sc
WHERE sc.password_hash IS NOT NULL
  AND sc.email IS NOT NULL
  AND sc.store_id IS NOT NULL
ON CONFLICT (store_id, email_or_phone)
DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  customer_id = COALESCE(public.customer_credentials.customer_id, EXCLUDED.customer_id),
  updated_at = NOW();

UPDATE public.store_customers
   SET password_hash = NULL,
       updated_at = NOW()
 WHERE password_hash IS NOT NULL;

COMMIT;

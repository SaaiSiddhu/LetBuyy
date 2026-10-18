DROP FUNCTION IF EXISTS public.product_price_reference_window(uuid[], timestamptz);
DROP TRIGGER IF EXISTS product_variants_capture_price_observation ON public.product_variants;
DROP TRIGGER IF EXISTS products_capture_price_observation ON public.products;
DROP FUNCTION IF EXISTS public.capture_product_price_observation();
DROP TABLE IF EXISTS public.product_price_observations;

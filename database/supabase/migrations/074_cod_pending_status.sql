-- Forward migration after the verified baseline plus 073 compatibility fixes.
-- COD orders must be explicit pending-cash obligations until the merchant
-- confirms them, instead of looking like prepaid confirmed orders.

ALTER TABLE public.orders
DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders
ADD CONSTRAINT orders_status_check
CHECK (
    status = ANY (
        ARRAY[
            'pending'::text,
            'pending_cod'::text,
            'confirmed'::text,
            'processing'::text,
            'shipped'::text,
            'delivered'::text,
            'cancelled'::text,
            'refunded'::text
        ]
    )
);

CREATE OR REPLACE FUNCTION public.set_pending_cod_order_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
    IF NEW.payment_method = 'cod'
       AND COALESCE(NEW.payment_status, 'pending') = 'pending'
       AND COALESCE(NEW.total, 0) > 0
       AND NEW.status IN ('pending', 'confirmed')
       AND (TG_OP = 'INSERT' OR NEW.status = 'pending')
    THEN
        NEW.status := 'pending_cod';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_pending_cod_status ON public.orders;

CREATE TRIGGER trg_orders_pending_cod_status
BEFORE INSERT OR UPDATE OF payment_method, payment_status, total, status
ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.set_pending_cod_order_status();

UPDATE public.orders
   SET status = 'pending_cod',
       updated_at = NOW()
 WHERE payment_method = 'cod'
   AND payment_status = 'pending'
   AND status = 'confirmed'
   AND COALESCE(total, 0) > 0
   AND deleted_at IS NULL;

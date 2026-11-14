BEGIN;
-- Publication/read evidence cannot be silently erased by rolling back a used inbox.
DO $$BEGIN IF EXISTS(SELECT 1 FROM public.merchant_announcements LIMIT 1) OR EXISTS(SELECT 1 FROM public.merchant_announcement_receipts LIMIT 1) THEN RAISE EXCEPTION '372 retains message history; rollback requires an empty installation';END IF;END$$;
DROP FUNCTION public.console_merchant_messages_v1(uuid,text,text,text,jsonb);
DROP FUNCTION public.merchant_message_audience_v1(text,uuid[]);
DROP TRIGGER guard_platform_message_notification_v1 ON public.notifications;
DROP FUNCTION public.guard_platform_message_notification_v1();
DROP INDEX public.notifications_platform_message_recipient_uidx;
DROP INDEX public.notifications_platform_inbox_idx;
DROP TABLE public.merchant_announcement_receipts;
DROP TABLE public.merchant_announcements;
COMMIT;

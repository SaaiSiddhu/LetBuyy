-- Rollback for 214_issue_gst_invoice.sql
DROP FUNCTION IF EXISTS public.issue_gst_invoice(uuid, uuid, text);

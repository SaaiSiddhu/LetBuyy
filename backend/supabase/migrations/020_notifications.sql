-- ================================================================
-- Notification System
-- Migration: 020_notifications.sql
-- Created: 2026-02-16
-- Description: In-app notification system for marketplace events
-- ================================================================

-- ——— 1. Notifications Table ———
CREATE TABLE IF NOT EXISTS notifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users_custom(id) ON DELETE CASCADE,
  type            TEXT NOT NULL
                    CHECK (type IN (
                      'app_installed', 'app_uninstalled', 'app_review',
                      'theme_purchased', 'theme_review',
                      'order_placed', 'order_shipped', 'order_delivered',
                      'new_lead', 'new_contact', 'plan_upgraded',
                      'store_published', 'system'
                    )),
  title           TEXT NOT NULL,
  message         TEXT,
  data            JSONB DEFAULT '{}',
  is_read         BOOLEAN DEFAULT false,
  action_url      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- ——— 2. Enable RLS ———
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ——— 3. RLS Policies ———
CREATE POLICY "Users view own notifications"
  ON notifications FOR SELECT
  USING (user_id = (SELECT id FROM users_custom WHERE auth_id = auth.uid()));

CREATE POLICY "Users update own notifications"
  ON notifications FOR UPDATE
  USING (user_id = (SELECT id FROM users_custom WHERE auth_id = auth.uid()));

CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users delete own notifications"
  ON notifications FOR DELETE
  USING (user_id = (SELECT id FROM users_custom WHERE auth_id = auth.uid()));

-- ——— 4. Helper function to create notifications ———
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT DEFAULT NULL,
  p_data JSONB DEFAULT '{}',
  p_action_url TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO notifications (user_id, type, title, message, data, action_url)
  VALUES (p_user_id, p_type, p_title, p_message, p_data, p_action_url)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ——— 5. Auto-notify on app installation ———
CREATE OR REPLACE FUNCTION notify_on_app_install()
RETURNS TRIGGER AS $$
DECLARE
  v_app_name TEXT;
  v_store_name TEXT;
  v_dev_user_id UUID;
BEGIN
  SELECT ma.name, ad.user_id INTO v_app_name, v_dev_user_id
  FROM marketplace_apps ma
  JOIN app_developers ad ON ma.developer_id = ad.id
  WHERE ma.id = NEW.app_id;

  SELECT name INTO v_store_name FROM sites WHERE id = NEW.store_id;

  -- Notify store owner
  PERFORM create_notification(
    NEW.installed_by,
    'app_installed',
    v_app_name || ' installed',
    v_app_name || ' has been installed on ' || COALESCE(v_store_name, 'your store'),
    jsonb_build_object('app_id', NEW.app_id, 'store_id', NEW.store_id),
    '/apps/' || NEW.app_id
  );

  -- Notify developer
  IF v_dev_user_id IS NOT NULL THEN
    PERFORM create_notification(
      v_dev_user_id,
      'app_installed',
      'New installation: ' || COALESCE(v_store_name, 'a store'),
      COALESCE(v_store_name, 'A store') || ' installed ' || v_app_name,
      jsonb_build_object('app_id', NEW.app_id, 'store_id', NEW.store_id)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER notify_app_install
  AFTER INSERT ON app_installations
  FOR EACH ROW EXECUTE FUNCTION notify_on_app_install();

-- ——— 6. Auto-notify on theme purchase ———
CREATE OR REPLACE FUNCTION notify_on_theme_purchase()
RETURNS TRIGGER AS $$
DECLARE
  v_theme_name TEXT;
BEGIN
  SELECT name INTO v_theme_name FROM themes WHERE id = NEW.theme_id;

  PERFORM create_notification(
    NEW.user_id,
    'theme_purchased',
    'Theme purchased: ' || COALESCE(v_theme_name, 'Unknown'),
    'You can now install ' || COALESCE(v_theme_name, 'the theme') || ' on any of your stores.',
    jsonb_build_object('theme_id', NEW.theme_id, 'purchase_id', NEW.id),
    '/themes/' || NEW.theme_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER notify_theme_purchase
  AFTER INSERT ON theme_purchases
  FOR EACH ROW EXECUTE FUNCTION notify_on_theme_purchase();

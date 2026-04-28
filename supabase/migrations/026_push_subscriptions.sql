-- Push subscription storage for Web Push notifications
CREATE TABLE PushSubscription (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.User(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_push_subscription_user ON PushSubscription(user_id);

-- RLS
ALTER TABLE PushSubscription ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can read own push subscriptions"
  ON PushSubscription FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users can insert own push subscriptions"
  ON PushSubscription FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users can delete own push subscriptions"
  ON PushSubscription FOR DELETE
  USING (auth.uid() = user_id);

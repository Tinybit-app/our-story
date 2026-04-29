-- Add 'monthly' as a valid email_digest_frequency option and change default from 'weekly' to 'monthly'

-- Drop the existing CHECK constraint and recreate with 'monthly' added
ALTER TABLE NotificationPreference
  DROP CONSTRAINT IF EXISTS notificationpreference_email_digest_frequency_check;

ALTER TABLE NotificationPreference
  ADD CONSTRAINT notificationpreference_email_digest_frequency_check
  CHECK (email_digest_frequency IN ('daily', 'weekly', 'monthly', 'off'));

-- Change the default for new rows
ALTER TABLE NotificationPreference
  ALTER COLUMN email_digest_frequency SET DEFAULT 'monthly';

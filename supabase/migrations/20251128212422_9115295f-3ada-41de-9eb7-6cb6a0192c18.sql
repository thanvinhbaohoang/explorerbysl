-- Make telegram_id nullable in customer table (customer might only use Messenger)
ALTER TABLE customer ALTER COLUMN telegram_id DROP NOT NULL;

-- Add Messenger-specific fields to customer table
ALTER TABLE customer ADD COLUMN messenger_id text UNIQUE;
ALTER TABLE customer ADD COLUMN messenger_name text;
ALTER TABLE customer ADD COLUMN messenger_profile_pic text;

-- Make telegram_id nullable in messages table (for Messenger messages)
ALTER TABLE messages ALTER COLUMN telegram_id DROP NOT NULL;

-- Add platform distinction and Messenger message ID to messages table
ALTER TABLE messages ADD COLUMN messenger_mid text;
ALTER TABLE messages ADD COLUMN platform text NOT NULL DEFAULT 'telegram' CHECK (platform IN ('telegram', 'messenger'));

-- Index for performance on messages table
CREATE INDEX idx_messages_platform ON messages(platform);

-- Add platform and Messenger referral data to telegram_leads table
ALTER TABLE telegram_leads ADD COLUMN platform text NOT NULL DEFAULT 'telegram' CHECK (platform IN ('telegram', 'messenger'));
ALTER TABLE telegram_leads ADD COLUMN messenger_ref text;
ALTER TABLE telegram_leads ADD COLUMN messenger_ad_context jsonb;
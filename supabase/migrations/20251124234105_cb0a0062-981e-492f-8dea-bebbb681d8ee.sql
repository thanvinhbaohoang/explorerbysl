-- Add is_read column to messages table
ALTER TABLE messages 
ADD COLUMN is_read BOOLEAN DEFAULT FALSE;

-- Mark all existing employee messages as read
UPDATE messages 
SET is_read = TRUE 
WHERE sender_type = 'employee';

-- Create index for faster unread count queries
CREATE INDEX idx_messages_unread ON messages(customer_id, sender_type, is_read) WHERE is_read = FALSE;
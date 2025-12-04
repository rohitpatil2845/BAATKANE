-- Add new columns to users table for profile and status
ALTER TABLE users 
ADD COLUMN bio TEXT,
ADD COLUMN phone VARCHAR(20),
ADD COLUMN presence_status ENUM('online', 'offline', 'away', 'busy') DEFAULT 'offline',
ADD COLUMN custom_status VARCHAR(100);

-- Scheduled messages table
CREATE TABLE IF NOT EXISTS scheduled_messages (
  id CHAR(36) PRIMARY KEY,
  chat_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  content TEXT NOT NULL,
  type VARCHAR(50) DEFAULT 'text',
  scheduled_time TIMESTAMP NOT NULL,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_pattern VARCHAR(50),
  is_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Call logs table for WebRTC calls
CREATE TABLE IF NOT EXISTS call_logs (
  id CHAR(36) PRIMARY KEY,
  chat_id CHAR(36) NOT NULL,
  caller_id CHAR(36) NOT NULL,
  call_type ENUM('voice', 'video') DEFAULT 'voice',
  status ENUM('missed', 'completed', 'rejected') DEFAULT 'completed',
  duration INTEGER DEFAULT 0,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP NULL,
  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
  FOREIGN KEY (caller_id) REFERENCES users(id) ON DELETE CASCADE
);

-- User settings table
CREATE TABLE IF NOT EXISTS user_settings (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL UNIQUE,
  theme VARCHAR(20) DEFAULT 'light',
  notifications_enabled BOOLEAN DEFAULT TRUE,
  sound_enabled BOOLEAN DEFAULT TRUE,
  email_notifications BOOLEAN DEFAULT TRUE,
  show_last_seen BOOLEAN DEFAULT TRUE,
  show_profile_photo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX idx_scheduled_messages_chat_id ON scheduled_messages(chat_id);
CREATE INDEX idx_scheduled_messages_user_id ON scheduled_messages(user_id);
CREATE INDEX idx_scheduled_messages_scheduled_time ON scheduled_messages(scheduled_time);
CREATE INDEX idx_scheduled_messages_is_sent ON scheduled_messages(is_sent);
CREATE INDEX idx_call_logs_chat_id ON call_logs(chat_id);
CREATE INDEX idx_call_logs_caller_id ON call_logs(caller_id);
CREATE INDEX idx_users_presence_status ON users(presence_status);

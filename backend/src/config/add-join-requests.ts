import db from './database';

async function addJoinRequestsTable() {
  try {
    console.log('Creating join_requests table...');
    
    await db.query(`
      CREATE TABLE IF NOT EXISTS join_requests (
        id CHAR(36) PRIMARY KEY,
        chat_id CHAR(36) NOT NULL,
        user_id CHAR(36) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_request (chat_id, user_id),
        FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    
    await db.query('CREATE INDEX idx_join_requests_chat_id ON join_requests(chat_id)').catch(() => {});
    await db.query('CREATE INDEX idx_join_requests_user_id ON join_requests(user_id)').catch(() => {});
    await db.query('CREATE INDEX idx_join_requests_status ON join_requests(status)').catch(() => {});
    
    console.log('✅ Join requests table created successfully');
    await db.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

addJoinRequestsTable();

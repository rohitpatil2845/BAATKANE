import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Override NODE_TLS_REJECT_UNAUTHORIZED for Supabase
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Test connection
pool.connect()
  .then(client => {
    console.log('✅ Connected to PostgreSQL database');
    client.release();
  })
  .catch(err => {
    console.error('❌ Database connection failed:', err);
  });

// Helper function to convert MySQL-style queries to PostgreSQL
export const query = async (text: string, params?: any[]) => {
  // Convert ? placeholders to $1, $2, etc.
  let paramIndex = 1;
  const pgQuery = text.replace(/\?/g, () => `$${paramIndex++}`);
  
  const result = await pool.query(pgQuery, params);
  // Return result in MySQL-style format [rows, fields]
  return [result.rows, result.fields];
};

export default { query };

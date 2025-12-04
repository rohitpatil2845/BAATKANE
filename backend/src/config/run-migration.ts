import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

async function runMigration() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL!);

  try {
    console.log('🔄 Running database migrations...');

    const sql = fs.readFileSync(
      path.join(__dirname, 'add-new-features.sql'),
      'utf-8'
    );

    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const statement of statements) {
      try {
        await connection.query(statement);
        console.log('✅ Executed:', statement.substring(0, 50) + '...');
      } catch (error: any) {
        if (error.code === 'ER_DUP_FIELDNAME' || error.code === 'ER_TABLE_EXISTS_ERROR') {
          console.log('⚠️  Skipped (already exists):', statement.substring(0, 50) + '...');
        } else {
          console.error('❌ Error:', error.message);
        }
      }
    }

    console.log('✅ Migration completed!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await connection.end();
  }
}

runMigration();

import db from './config/database';

async function checkUsers() {
  try {
    const [rows] = await db.query('SELECT username, email, name FROM users');
    console.log('Existing users:', rows);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkUsers();

# Migration to Supabase PostgreSQL

## Prerequisites
- Supabase account (https://supabase.com)
- Node.js 18+ installed
- npm or yarn

## Step 1: Set up Supabase Database

1. **Create a Supabase Project**
   - Go to https://supabase.com/dashboard
   - Click "New Project"
   - Choose a name, database password, and region
   - Wait for the project to be provisioned

2. **Get Your Connection String**
   - Go to Project Settings → Database
   - Copy the "Connection string" under "Connection pooling"
   - It should look like: `postgresql://postgres.xxx:[YOUR-PASSWORD]@aws-0-us-west-2.pooler.supabase.com:5432/postgres`

3. **Run the Database Schema**
   - Go to SQL Editor in Supabase Dashboard
   - Copy the contents of `backend/src/config/schema-postgres.sql`
   - Paste and run the SQL script
   - This will create all tables, indexes, triggers, and ENUM types

## Step 2: Update Environment Variables

1. **Update `.env` file in backend folder**
   ```env
   DATABASE_URL=postgresql://postgres.xxx:[YOUR-PASSWORD]@aws-0-us-west-2.pooler.supabase.com:5432/postgres
   PORT=5000
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   GEMINI_API_KEY=AIzaSyD6nGAh7p3d4Zw2cOaPTS1UMXSHEGfsTfUnpm
   NODE_ENV=development
   ```

2. **Replace `[YOUR-PASSWORD]` with your actual Supabase database password**

## Step 3: Install Dependencies

```bash
cd backend
npm install
```

## Step 4: Start the Application

1. **Start Backend**
   ```bash
   cd backend
   npm run dev
   ```

2. **Start Frontend** (in another terminal)
   ```bash
   cd frontend
   npm run dev
   ```

## Key Changes from MySQL to PostgreSQL

### 1. UUID Generation
- **MySQL**: `CHAR(36)` with manual UUID generation
- **PostgreSQL**: Native `UUID` type with `gen_random_uuid()`

### 2. ENUM Types
- **MySQL**: Inline ENUM definition
- **PostgreSQL**: Separate `CREATE TYPE` statements

### 3. Auto-Increment
- **MySQL**: `AUTO_INCREMENT`
- **PostgreSQL**: `SERIAL` or `UUID` with `gen_random_uuid()`

### 4. Query Placeholders
- **MySQL**: `?` placeholders
- **PostgreSQL**: `$1, $2, $3` placeholders

### 5. ON UPDATE CURRENT_TIMESTAMP
- **MySQL**: Native support
- **PostgreSQL**: Requires trigger function

### 6. Boolean Values
- **MySQL**: `TRUE`, `FALSE`, `1`, `0`
- **PostgreSQL**: `TRUE`, `FALSE` (strict)

## Database Features Included

✅ User authentication with JWT
✅ Real-time messaging with Socket.io
✅ Group chats and direct messages
✅ Message read receipts (3-state: sent, delivered, read)
✅ User presence indicators (online, offline, away, busy)
✅ Scheduled messages with cron jobs
✅ SmartBot AI integration with Gemini
✅ Message forwarding
✅ Join requests for group chats
✅ Call logs for WebRTC calls
✅ File attachments support
✅ Message pinning and deletion
✅ User profiles with bio and custom status

## Troubleshooting

### Connection Issues
- Ensure your IP is whitelisted in Supabase (Project Settings → Database → Connection Pooling)
- Verify the DATABASE_URL is correct
- Check if the database password contains special characters that need URL encoding

### Migration Errors
- Run the schema SQL script in Supabase SQL Editor
- Check for any existing tables that might conflict
- Verify all ENUM types are created before tables

### Query Errors
- The database helper automatically converts MySQL `?` placeholders to PostgreSQL `$1, $2, $3`
- All queries are wrapped in the helper function for compatibility

## Next Steps

1. Test all features thoroughly
2. Deploy backend to Render
3. Deploy frontend to Vercel
4. Update production environment variables
5. Enable Supabase Row Level Security (RLS) for additional security

## Support

If you encounter any issues:
- Check Supabase logs in the dashboard
- Review backend console for error messages
- Verify all environment variables are set correctly

# 🚀 BaatKare - Real-Time Chat App with AI

A production-ready chat application with group messaging, real-time communication, and AI-powered features.

## ✨ Features

### Core Chat Features
- 🔐 **Authentication** - JWT-based signup/login with secure sessions
- 💬 **Real-Time Messaging** - Instant messaging with WebSocket (Socket.io)
- 👥 **Group Chats** - Create groups, manage members, admin roles
- 💬 **One-to-One Chat** - Private messaging with online status
- ⌨️ **Typing Indicators** - See when users are typing
- ✅ **Read Receipts** - Single/double tick for delivery & read status
- 📎 **Rich Media** - Send text, images, files, emojis, voice messages

### AI-Powered Features
- 🤖 **AI Chat Assistant** - @mention bot for instant answers
- ✍️ **Smart Compose** - AI message suggestions and auto-complete
- 📝 **Chat Summaries** - AI-powered conversation summaries
- 🛡️ **Content Moderation** - AI filters for toxic/spam content
- 📋 **Group Assistant** - Meeting notes, task extraction, reminders

### Bonus Features
- 🔔 Real-time notifications
- 🌙 Dark mode
- 📌 Pin important messages
- 🗑️ Delete for everyone
- 🔇 Mute groups
- 🖼️ Media gallery
- 🔍 Search messages

## 🏗️ Tech Stack

**Frontend:**
- React.js (Vite)
- TypeScript
- Tailwind CSS
- Socket.io Client
- React Router
- Zustand/Context API

**Backend:**
- Node.js + Express
- TypeScript
- Socket.io
- PostgreSQL
- Prisma ORM
- JWT Authentication
- OpenAI API

**Deployment:**
- Frontend: Vercel
- Backend: Render
- Database: Render PostgreSQL

## 📦 Installation

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL 14+
- OpenAI API key (optional for AI features)

### Setup Steps

1. **Clone and install dependencies:**
```bash
git clone <your-repo>
cd Baatkare
npm run install:all
```

2. **Configure Backend Environment:**
```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/baatkare"
JWT_SECRET="your-super-secret-jwt-key-change-this"
PORT=5000
OPENAI_API_KEY="sk-your-openai-api-key"
FRONTEND_URL="http://localhost:5173"
```

3. **Configure Frontend Environment:**
```bash
cd ../frontend
cp .env.example .env
```

Edit `frontend/.env`:
```env
VITE_API_URL=http://localhost:5000
VITE_WS_URL=http://localhost:5000
```

4. **Setup Database:**
```bash
cd ../backend
npx prisma migrate dev --name init
npx prisma generate
```

5. **Start Development Servers:**
```bash
cd ..
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:5000

## 🚀 Deployment

### Frontend (Vercel)

1. Push code to GitHub
2. Import project in Vercel
3. Set root directory to `frontend`
4. Add environment variables:
   - `VITE_API_URL`: Your Render backend URL
   - `VITE_WS_URL`: Your Render backend URL
5. Deploy

### Backend (Render)

1. Create new Web Service on Render
2. Connect your GitHub repo
3. Set root directory to `backend`
4. Add environment variables (DATABASE_URL, JWT_SECRET, etc.)
5. Build command: `npm install && npx prisma generate && npm run build`
6. Start command: `npm start`
7. Add PostgreSQL database (Render provides this)

## 📁 Project Structure

```
Baatkare/
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── middleware/
│   │   ├── services/
│   │   ├── socket/
│   │   └── server.ts
│   ├── prisma/
│   │   └── schema.prisma
│   ├── uploads/
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── store/
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
├── package.json
└── README.md
```

## 🗄️ Database Schema

- **Users** - User profiles, auth credentials
- **Chats** - Chat/group metadata
- **ChatMembers** - User-chat relationships
- **Messages** - Message content and metadata
- **MessageReads** - Read receipt tracking

## 🔑 API Endpoints

### Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/forgot-password` - Password reset

### Chats
- `GET /api/chats` - Get user's chats
- `POST /api/chats` - Create new chat/group
- `GET /api/chats/:id/messages` - Get chat messages

### Messages
- `POST /api/messages` - Send message
- `PUT /api/messages/:id` - Edit message
- `DELETE /api/messages/:id` - Delete message

### AI
- `POST /api/ai/suggest` - Get message suggestions
- `POST /api/ai/summarize` - Summarize chat
- `POST /api/ai/moderate` - Check content moderation

## 🔌 Socket Events

### Client → Server
- `join_chat` - Join chat room
- `send_message` - Send new message
- `typing` - User typing indicator
- `mark_read` - Mark message as read

### Server → Client
- `new_message` - Receive new message
- `user_typing` - Someone is typing
- `message_read` - Message read status update
- `user_status` - Online/offline status

## 🤝 Contributing

Contributions welcome! Please read our contributing guidelines first.

## 📄 License

MIT License - feel free to use this project for learning or portfolio purposes.

## 👨‍💻 Author

Built with ❤️ for learning and interviews

---

**⭐ Star this repo if it helped you in your interview prep!**

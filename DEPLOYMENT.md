# BaatKare - Real-Time Chat Application

## 🚀 Deployment Guide

### Backend Deployment (Render)

1. **Push your code to GitHub**
   ```bash
   cd backend
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin YOUR_GITHUB_REPO_URL
   git push -u origin main
   ```

2. **Deploy to Render**
   - Go to [Render Dashboard](https://dashboard.render.com/)
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select the `backend` folder
   - Render will auto-detect the `render.yaml` file

3. **Set Environment Variables** (in Render Dashboard)
   - `DATABASE_URL`: Your MySQL connection string (use PlanetScale, Railway, or Render PostgreSQL)
   - `JWT_SECRET`: Auto-generated or set manually
   - `GEMINI_API_KEY`: Your Google Gemini API key
   - `FRONTEND_URL`: Your Vercel frontend URL (e.g., `https://baatkare.vercel.app`)

4. **Database Setup**
   - Option 1: Use [PlanetScale](https://planetscale.com/) (MySQL, Free tier)
   - Option 2: Use [Railway](https://railway.app/) (MySQL)
   - Option 3: Convert to PostgreSQL and use Render's database
   
   Update `DATABASE_URL` format:
   ```
   mysql://username:password@host:port/database
   ```

### Frontend Deployment (Vercel)

1. **Push frontend to GitHub** (if separate repo)
   ```bash
   cd frontend
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin YOUR_GITHUB_REPO_URL
   git push -u origin main
   ```

2. **Deploy to Vercel**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "Add New" → "Project"
   - Import your GitHub repository
   - Select the `frontend` folder
   - Vercel will auto-detect Vite

3. **Set Environment Variables** (in Vercel Dashboard)
   - `VITE_API_URL`: Your Render backend URL (e.g., `https://baatkare-backend.onrender.com/api`)
   - `VITE_WS_URL`: Your Render backend WebSocket URL (e.g., `https://baatkare-backend.onrender.com`)

4. **Deploy**
   - Click "Deploy"
   - Vercel will build and deploy automatically

### Post-Deployment Steps

1. **Update CORS in backend**
   - After getting your Vercel URL, update `backend/.env`:
   ```env
   FRONTEND_URL=https://your-app.vercel.app
   ```

2. **Test the deployment**
   - Sign up a new user
   - Test SmartBot AI responses
   - Test real-time messaging
   - Check read receipts

### Database Migration on Render

Run migrations after first deployment:
```bash
# In Render Shell (Dashboard → Your Service → Shell)
npm run db:migrate
```

### Troubleshooting

- **CORS errors**: Make sure `FRONTEND_URL` is set correctly in Render
- **Database connection**: Verify `DATABASE_URL` format and credentials
- **WebSocket issues**: Ensure Render service is on paid plan for persistent WebSocket connections (free tier has limitations)
- **API key errors**: Verify `GEMINI_API_KEY` is set in Render environment variables

### Free Tier Limitations

**Render Free Tier:**
- Spins down after 15 minutes of inactivity
- First request after spin-down takes 30-50 seconds
- 750 hours/month free

**Vercel Free Tier:**
- 100 GB bandwidth/month
- Unlimited deployments
- Automatic HTTPS

**Recommendations:**
- Use PlanetScale for MySQL (free 5GB storage)
- Consider upgrading Render to $7/month for persistent WebSocket connections
- Use environment variables for all sensitive data

## 📝 Quick Deploy Commands

```bash
# Backend
cd backend
git init
git add .
git commit -m "Deploy backend"
git remote add origin YOUR_BACKEND_REPO
git push -u origin main

# Frontend  
cd ../frontend
git init
git add .
git commit -m "Deploy frontend"
git remote add origin YOUR_FRONTEND_REPO
git push -u origin main
```

Then connect both repos to Render and Vercel respectively.

## 🎉 Your app will be live!

- Frontend: `https://your-app.vercel.app`
- Backend: `https://your-app.onrender.com`
- SmartBot AI will work automatically with your Gemini API key!

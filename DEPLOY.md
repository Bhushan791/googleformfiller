# Form Auto Filler — Deployment & Production Guide

This guide explains how to deploy **Form Auto Filler** for production using free-tier services:
- **Backend**: [Render](https://render.com) (Node.js Web Service)
- **Frontend**: [Vercel](https://vercel.com) (Vite + React SPA)
- **Persistence (Optional)**: [Upstash Redis](https://upstash.com) (Serverless Redis)
- **Availability Monitoring**: [UptimeRobot](https://uptimerobot.com) (Prevents Render cold starts)

---

## 1. Backend Deployment (Render)

1. Sign up or log into [Render](https://render.com).
2. Click **New +** → **Blueprint** and connect your GitHub repository, **or** choose **Web Service**:
   - **Name**: `formbot-backend`
   - **Root Directory**: Leave blank (uses repo root) or `backend`
   - **Environment**: `Node`
   - **Region**: Closest to your users (e.g., Oregon or Frankfurt)
   - **Branch**: `main`
   - **Build Command**: `cd backend && npm install`
   - **Start Command**: `cd backend && npm start`
   - **Plan**: `Free`
3. Expand **Advanced Settings**:
   - **Health Check Path**: `/health`
4. Set the following **Environment Variables**:
   - `NODE_ENV`: `production`
   - `PORT`: `5000`
   - `FRONTEND_URL`: URL of your deployed Vercel frontend (e.g. `https://formbot.vercel.app`)
   - `ANTHROPIC_API_KEY`: *(Optional)* Your Anthropic API key for realistic sentiment generation.
   - `ANTHROPIC_MODEL`: `claude-haiku-5-5`
   - `REDIS_URL`: *(Optional)* Upstash Redis connection string (see section 3).
5. Click **Create Web Service**.

> [!NOTE]
> On the free plan, Render spins down inactive instances after 15 minutes. Cold starts take ~50 seconds. The frontend health polling automatically shows "Waking backend" during this period. To keep the instance warm, see Section 4 (UptimeRobot).

---

## 2. Frontend Deployment (Vercel)

1. Log into [Vercel](https://vercel.com).
2. Click **Add New…** → **Project** and import your Git repository.
3. Configure project settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click *Edit* and select `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Add **Environment Variable**:
   - `VITE_API_URL`: Your Render backend URL (e.g., `https://formbot-backend.onrender.com`).
5. Deploy!
   - Single Page Application (SPA) routing is pre-configured via `frontend/vercel.json` (`rewrites` to `/index.html`).

---

## 3. Persistent Job Storage (Upstash Redis)

If `REDIS_URL` is omitted, Form Auto Filler defaults to an **In-Memory Store** (with an explicit startup warning). When using Render free tier, server restarts will reset in-memory jobs. To survive restarts:

1. Sign up for a free account at [Upstash](https://upstash.com).
2. Click **Create Database**:
   - Name: `formbot-jobs`
   - Region: Match your Render backend region for minimal latency
   - Type: Serverless Redis
3. Under the **Connect** tab, select **ioredis** and copy the connection string:
   ```text
   rediss://default:<password>@<endpoint>.upstash.io:6379
   ```
4. Paste this value into your Render Web Service environment variables as `REDIS_URL`.

---

## 4. Keeping Render Warm (UptimeRobot)

Render free instances sleep after 15 minutes without inbound HTTP requests.

1. Create a free account at [UptimeRobot](https://uptimerobot.com).
2. Click **Add New Monitor**:
   - **Monitor Type**: `HTTP(s)`
   - **Friendly Name**: `Form Auto Filler Backend`
   - **URL (or IP)**: `https://<your-render-app>.onrender.com/health`
   - **Monitoring Interval**: Every `10 minutes` (Render sleeps after 15 min)
3. Click **Create Monitor**. The lightweight `/health` endpoint responds in < 1ms, preventing cold starts.

---

## 5. First Real Test Guide

Follow these steps to safely run your first real end-to-end test:

1. **Create a Test Google Form**:
   - Open [Google Forms](https://forms.google.com) and create a new test form.
   - Add 3 diverse questions:
     1. Short answer: *"What is your name?"*
     2. Multiple choice: *"How satisfied are you?"* (Options: *Very Satisfied*, *Neutral*, *Unsatisfied*)
     3. Date: *"Preferred session date?"*
   - Ensure form settings:
     - **Limit to 1 response**: `OFF` (Checked = requires sign-in)
     - **Collect email addresses**: `Do not collect` or verified `OFF`
   - Click the **Send** button and copy the public view link (`https://docs.google.com/forms/d/e/.../viewform`).
2. **Parse & Dry Run**:
   - Open your deployed frontend (or `http://localhost:5173`).
   - Paste the link and click **Analyze Form**.
   - Check that all 3 questions appear.
   - Click **Dry Run Preview** to inspect 5 generated sample rows without sending any HTTP requests to Google.
3. **Run a Controlled 3-Response Job**:
   - Scroll to **Start Live Submission Job**.
   - Set **Total Responses** to `3`.
   - Set **Min Delay** to `2` sec, **Max Delay** to `4` sec.
   - Check the guardrail confirmation: *"I own this form or have permission to submit test responses to it."*
   - Click **Start Submitting 3 Responses**.
4. **Monitor & Verify**:
   - Watch the live progress bar and status badge switch from `Queued` to `Running` to `Completed`.
   - Click **Export CSV** to download the generated responses and timestamps.
   - Open your Google Form's **Responses** tab: verify all 3 responses arrived with correct values!


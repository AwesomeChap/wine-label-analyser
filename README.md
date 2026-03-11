# Wine Label Analyser

A full-stack web app that analyses wine labels from photos of the front and back of a bottle. Users can upload images or capture them with the camera. The app uses OpenAI to extract structured data (name, winery, vintage, grape variety, vineyard location, country) and stores results and compressed images in Supabase.

**Live demo:** [https://wine-label-analyser.vercel.app/](https://wine-label-analyser.vercel.app/)

## Requirements

- Node.js 18+
- npm

## Stack

- **Frontend:** React (Vite), React Router
- **Backend:** Node.js (Express)
- **AI:** OpenAI (GPT-4o vision) for label extraction
- **Database & storage:** Supabase (PostgreSQL + Storage)

## Setup

### 1. Clone and install

```bash
cd wine-label-analyser
npm run install:all
```

### 2. Environment variables

**Backend** – copy and edit `backend/.env`:

```bash
cp backend/.env.example backend/.env
```

Fill in:

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | Your OpenAI API key (for GPT-4o vision) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (backend only; keep secret) |
| `SUPABASE_BUCKET_NAME` | Storage bucket name (e.g. `wine-labels`) |
| `PORT` | Backend port (default `3001`) |

**Frontend** – optional: create `frontend/.env` and set `VITE_API_BASE_URL` if the API is on another origin (e.g. `http://localhost:3001`). By default the Vite proxy forwards `/api` to the backend.

Never commit `.env` or `.env.local`; they are in `.gitignore`.

### 3. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In the **SQL Editor**, run the script in `supabase/schema.sql` to create the `wine_analyses` table and RLS policy. If the table was created before `decoded_text` was added, run `supabase/add_decoded_text.sql` to add the column.
3. In **Storage**, create a bucket named `wine-labels` (or the name you set in `SUPABASE_BUCKET_NAME`). Make it **public** so the app can display stored label images via public URLs.

### 4. Run the app

From the project root:

```bash
npm run dev
```

- Frontend: [http://localhost:5173](http://localhost:5173)
- Backend: [http://localhost:3001](http://localhost:3001)

The frontend proxies `/api` to the backend, so you can use the app without CORS issues.

## Usage

1. **Analyse** – On the home page, add **front** and **back** label images (upload or capture with camera). The “Analyse labels” button is enabled only when both are set. After analysis, extracted details are shown and the record is saved to Supabase (images are compressed before upload).
2. **History** – View all past analyses: front/back images and which fields were extracted (✓) or missing (—).

## Deploying to Vercel

The app is set up to deploy as a single Vercel project: the frontend is built to static files and the backend runs as serverless functions under `/api`.

### 1. Push your code to GitHub

Create a repo and push the project (do **not** commit `backend/.env`):

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/wine-label-analyser.git
git push -u origin main
```

### 2. Import the project on Vercel

1. Go to [vercel.com](https://vercel.com) and sign in (e.g. with GitHub).
2. Click **Add New…** → **Project**.
3. Import your **wine-label-analyser** repository.
4. Leave **Root Directory** as `.` (project root).
5. Vercel will use the existing **Build and Output Settings** from `vercel.json`:
   - **Build Command:** `cd frontend && npm install && npm run build`
   - **Output Directory:** `frontend/dist`
   - **Install Command:** `npm install && cd backend && npm install`
6. Click **Deploy** (the first deploy may fail until env vars are set; that’s normal).

### 3. Add environment variables

1. In the Vercel project, go to **Settings** → **Environment Variables**.
2. Add the same variables you use locally (for **Production**, and optionally **Preview**):

| Name | Value |
|------|--------|
| `OPENAI_API_KEY` | Your OpenAI API key |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key |
| `SUPABASE_BUCKET_NAME` | Your storage bucket name (e.g. `wine-labels`) |

3. **Redeploy:** **Deployments** → … on the latest deployment → **Redeploy**.

### 4. Check the deployment

- This project is deployed at [https://wine-label-analyser.vercel.app/](https://wine-label-analyser.vercel.app/). Your own deployment will be at `https://your-project.vercel.app`.
- The frontend is served from the root; the API is at `/api/analyze`, `/api/history`, and `/api/health`.
- No need to set `VITE_API_BASE_URL`; the frontend uses the same origin in production.

### Notes

- **Cold starts:** The first request to `/api/*` after idle time may be slower (serverless spin-up).
- **Body size:** The analyze endpoint accepts large base64 images; Vercel’s default body size limit is 4.5 MB. If you hit limits, you may need to compress images more on the client or adjust plan limits.

## Project structure

```
wine-label-analyser/
├── api/               # Vercel serverless entry (catch-all for /api/*)
├── backend/           # Express API (used by api/ and locally)
│   ├── lib/           # OpenAI, Supabase, compression
│   ├── routes/        # /api/analyze, /api/history
│   └── server.js
├── frontend/          # React (Vite)
│   └── src/
│       ├── components/
│       ├── lib/       # API client, client-side compression
│       ├── pages/     # Analyse, History
│       └── App.jsx
├── supabase/
│   └── schema.sql     # Table + RLS
├── vercel.json        # Vercel build & output config
└── README.md
```

## Security

- All secrets (OpenAI key, Supabase service role key) live in `backend/.env` and are not committed.
- The frontend only talks to your backend; it never sees API keys.
- Use the Supabase **service role** key only on the backend; do not expose it to the browser.

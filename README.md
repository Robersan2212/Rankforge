# Rankforge — SEO Page Auditor

AI-powered SEO page audit: paste a URL, crawl with Playwright, score against a rubric, and get Claude-powered recommendations.

## Architecture

- **Frontend** (`frontend/`): Next.js 14, TypeScript, TailwindCSS, shadcn/ui, Recharts
- **Backend** (`backend/`): FastAPI, Playwright, BeautifulSoup, Anthropic Claude API

## Prerequisites

- Node.js 18+
- Python 3.11+
- [Anthropic API key](https://console.anthropic.com/) (optional — audits work without AI summary enrichment)

## Setup

### Backend

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate

pip install -r requirements.txt
playwright install chromium

# Create backend/.env (not committed) with your API key:
# ANTHROPIC_API_KEY=sk-ant-...

uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
# Optional: create frontend/.env.local (not committed)
# NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The frontend calls the backend at `http://localhost:8000` by default (`NEXT_PUBLIC_API_URL`).

## API

`POST /api/audit`

```json
{ "url": "https://example.com" }
```

Returns structured audit JSON: meta tags, headings, word count, links, images, SEO score (0–100), rubric issues, and `ai_summary`.

`GET /health` — backend health check.

## SEO Scoring

Score is calculated from 100 points across title, meta description, H1 count, heading hierarchy, word count, image alt text, internal/external links, and heading depth (H2/H3). Failed checks appear as issues with severity and suggested fixes.

## Project Structure

```
Rankforge/
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    └── src/
        ├── app/page.tsx
        ├── components/   # audit UI
        └── lib/          # types, API client
```

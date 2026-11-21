# Form Auto Filler — Frontend

> React + Vite + Tailwind CSS frontend for **Form Auto Filler**, a tool that
> generates and submits test responses to Google Forms you own.

---

## Setup

```bash
cd frontend
npm install
cp .env.example .env   # edit if the backend runs elsewhere
```

## Environment Variables

| Variable       | Default                  | Description                |
| -------------- | ------------------------ | -------------------------- |
| `VITE_API_URL` | `http://localhost:5000`  | Backend API base URL       |

## Development

```bash
npm run dev          # starts Vite dev server on http://localhost:5173
```

## Production Build

```bash
npm run build        # outputs to dist/
npm run preview      # preview the production build locally
```

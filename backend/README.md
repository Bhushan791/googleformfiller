# Autofillr — Backend API

> REST API backend for **Autofillr**, a tool that generates and submits
> test responses to Google Forms you own — perfect for testing and seeding demo
> data.

Built with **Node.js**, **Express**, and **ES modules**.

---

## Tech Stack

| Layer        | Technology                              |
| ------------ | --------------------------------------- |
| Runtime      | Node.js 18+                             |
| Framework    | Express 4                               |
| Validation   | Zod                                     |
| Security     | Helmet, CORS, express-rate-limit        |
| Logging      | Morgan                                  |
| Dev tooling  | Nodemon                                 |

---

## Getting Started

### 1. Clone & install

```bash
cd backend
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your values
```

### 3. Run

```bash
# Development (auto-reload)
npm run dev

# Production
npm start
```

---

## Environment Variables

| Variable           | Required | Default              | Description                                        |
| ------------------ | -------- | -------------------- | -------------------------------------------------- |
| `PORT`             | No       | `5000`               | Port the API listens on                            |
| `NODE_ENV`         | No       | `development`        | `development` / `production` / `test`              |
| `FRONTEND_URL`     | **Yes**  | —                    | Comma-separated list of allowed CORS origins       |
| `GROQ_KEY`             | No       | —                    | Groq API key (prefix `gsk_`)                       |
| `OPENROUTER_KEY`       | No       | —                    | OpenRouter API key (prefix `sk-or-`)               |
| `LLM_API_KEYS`         | No       | —                    | Comma-separated extra API keys (e.g. `sk-or-...`)  |
| `LLM_PRIORITY`         | No       | `groq,openrouter`    | Provider fallback order                            |
| `LLM_MODEL_GROQ`       | No       | `qwen/qwen3.8-27b`   | Override Groq model                                |
| `LLM_MODEL_OPENROUTER` | No       | `baidu/ernie-5.5-flash-preview:free` | Override OpenRouter model          |
| `LLM_BASE_URL`     | No       | —                    | Base URL override for OpenAI-compatible providers  |
| `REDIS_URL`        | No       | —                    | Redis connection string (caching / queues)         |
| `ACCESS_CODE`      | No       | —                    | Optional secret access code requiring `x-access-code` header on `/api` |

---

## API Endpoints

| Method | Path        | Description              | Rate Limited |
| ------ | ----------- | ------------------------ | ------------ |
| GET    | `/health`   | Liveness / readiness     | ❌            |
| GET    | `/api/ping` | Routing & limiter check  | ✅            |

---

## Testing with curl

```bash
# Health check
curl http://localhost:5000/health

# Ping (rate-limited)
curl http://localhost:5000/api/ping

# 404 test
curl http://localhost:5000/no-such-route
```

---

## Project Structure

```
backend/
├── src/
│   ├── server.js           # Starts listener, graceful shutdown
│   ├── app.js              # Express app config (no listen)
│   ├── config/env.js       # dotenv + Zod env validation
│   ├── routes/
│   │   ├── index.js        # Mounts all route groups
│   │   └── health.routes.js
│   ├── controllers/
│   │   └── health.controller.js
│   ├── services/           # Business logic (empty for now)
│   ├── middleware/
│   │   ├── errorHandler.js
│   │   ├── notFound.js
│   │   └── rateLimiter.js
│   └── utils/
│       ├── AppError.js     # Custom error class
│       └── asyncHandler.js
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

## License

MIT


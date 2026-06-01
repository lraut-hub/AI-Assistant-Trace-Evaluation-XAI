# AI Eval Canvas

An open-source Gemini-style AI assistant with two modes:

| Mode | Description |
|------|-------------|
| **Standard Chat** | Conversational AI with streaming responses |
| **Trace** | Analysis queries become a structured decision canvas (parallel scans, gates, identity branches) |

---

## Quick Start (Development)

### Prerequisites
- Node.js 20+ and pnpm 9+
- Python 3.11+
- Docker & Docker Compose
- A [Groq](https://console.groq.com) API key (free)
- A [Supabase](https://supabase.com) project (free tier)

### 1. Clone & install

```bash
git clone https://github.com/your-org/ai-eval-canvas.git
cd ai-eval-canvas

# Install JS dependencies
pnpm install

# Install Python dependencies (backend)
cd apps/api && pip install uv && uv sync && cd ../..
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env and fill in your GROQ_API_KEY, Supabase credentials, etc.
```

### 3. Start the dev stack (DB + ChromaDB)

```bash
docker compose -f infra/docker-compose.yml up -d postgres chromadb redis
```

### 4. Run development servers

```bash
# In one terminal — backend API (port 8080)
cd apps/api && uv run uvicorn app.main:app --reload --port 8080

# In another terminal — frontend (port 3000)
cd apps/web && pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Use **Trace** at `/trace` for structured decision maps.

---

## Project Structure

```
ai-eval-canvas/
├── apps/
│   ├── web/          # Next.js 14 frontend
│   └── api/          # FastAPI backend + LangGraph agents
├── packages/
│   └── shared-types/ # Shared TypeScript types
├── infra/            # Docker Compose, Nginx configs
├── PhaseWiseArchitecture/  # Architecture docs (SSoT)
└── implementation_log.md   # Build log
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React, Vanilla CSS |
| Backend | FastAPI, LangGraph, Python 3.11 |
| LLM Serving | Groq (primary), vLLM (fallback) |
| Planner Model | Qwen3-32B / Llama 3.3-70B |
| Reasoner Model | DeepSeek R1 |
| Database | Supabase + PostgreSQL |
| Vector Store | ChromaDB |
| Graph Rendering | React Flow |

---

## Architecture

See [`PhaseWiseArchitecture/00_INDEX.md`](./PhaseWiseArchitecture/00_INDEX.md) for the full technical design.

---

## License

MIT

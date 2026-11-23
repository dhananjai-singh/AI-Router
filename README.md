# AI Router

A unified AI CLI that routes coding tasks to Gemini CLI or Claude Code using **Qwen3 running locally via Ollama**.

```
ai "add a login endpoint to my Express app"
```

---

## How It Works

```
you → ai "task" → Qwen3 (local, Ollama) → gemini | claude | hybrid → result
```

1. You run `ai "your task"`
2. Qwen3 (local, private, fast) analyzes it and picks the best model
3. The right tool launches with your task + project context injected
4. History is logged to `.ai/history.json`

---

## Routing Logic

| Route | When to use |
|---|---|
| `gemini` | Implementation: write code, build features, scaffolding, refactoring |
| `claude` | Reasoning: architecture, code review, design decisions, debugging logic |
| `gemini_then_claude` | Build first, then review/analyze |
| `claude_then_gemini` | Plan/design first, then implement |

---

## Prerequisites

| Tool | Install |
|---|---|
| Node.js 18+ | https://nodejs.org |
| Ollama | https://ollama.ai |
| Qwen3 | `ollama pull qwen3` |
| Gemini CLI | `npm install -g @google/generative-ai-cli` |
| Claude Code | `npm install -g @anthropic-ai/claude-code` |

---

## Installation

```bash
git clone https://github.com/dhananjai-singh/AI-Router.git
cd AI-Router
chmod +x install.sh
./install.sh
```

Or manually:
```bash
npm install
npm link
```

---

## Usage

### Basic
```bash
ai "add pagination to my users API"
ai "should I use Redis or Memcached for session storage?"
ai "design the auth system then implement it"
```

### Commands
```bash
ai init              # Initialize .ai/ dir in your project
ai status            # Check Ollama, Gemini CLI, Claude Code
ai history           # Show recent sessions
ai context           # Show current project context
```

### Options
```bash
ai --model gemini "task"        # Force a specific model
ai --force "task"               # Run even if Ollama is down (uses default)
ai --dry-run "task"             # Show routing decision without launching
ai --non-interactive "task"     # One-shot mode (no interactive session)
```

---

## Project Context

The `.ai/` directory in your project stores shared context:

```
.ai/
├── context.md    ← Edit this! Injected into every AI call
├── history.json  ← Auto-managed session log
└── handoff.md    ← Auto-managed model-to-model handoff notes
```

**context.md example:**
```markdown
# Project Context

## Stack
Node.js, Express, PostgreSQL, React

## Goals
Build a SaaS dashboard for analytics

## Notes
- Use TypeScript everywhere
- REST API, no GraphQL
- Deploy target: Railway
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama API URL |
| `OLLAMA_MODEL` | `qwen3` | Model for routing decisions |

---

## Web Dashboard (Nexus Gate)

The project also has a small web app with sign-up/login and a dashboard that shows your routing history.

```bash
npm run server        # http://localhost:3000
```

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Port for the web server |
| `MONGODB_URI` | `mongodb://localhost:27017/auth_db` | MongoDB connection string |
| `JWT_SECRET` | dev placeholder | **Set this to a long random string in any real deployment** |

- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` (JWT in an HTTP-only cookie, passwords hashed with bcrypt)
- `GET /api/router/history` returns the routing history for the dashboard
- `db/schema.sql` holds an equivalent PostgreSQL schema, and `db/mock_users.json` holds sample test users

---

## Architecture

```
index.js       — CLI entry point (Commander)
server.js      — Express web server (auth + dashboard API)
context-builder.js — Builds/updates project context after sessions
router.js      — Qwen3 routing via Ollama API
memory.js      — Context/history management
config.js      — Central configuration
public/        — Login page + dashboard (HTML/CSS/JS)
db/            — User model, SQL schema, mock users
models/
  gemini.js    — Gemini CLI launcher
  claude.js    — Claude Code launcher
.ai/
  context.md   — Project context (you edit this)
  history.json — Session log
  handoff.md   — Model handoff notes
```

---

## Extending

To add a new model (e.g. local LLM via Ollama):

1. Add to `config.js` under `models`
2. Create `models/yourmodel.js` following the same `launchX / checkX` pattern
3. Add a case in `dispatch()` in `index.js`
4. Update the routing prompt in `router.js` to include the new model

---

## Troubleshooting

**Routing fails / Ollama unreachable**
```bash
ollama serve          # Start Ollama
ollama pull qwen3     # Download model
ai status             # Verify everything
```

**Model not launching**
```bash
which gemini          # Check Gemini CLI in PATH
which claude          # Check Claude Code in PATH
ai status             # Full diagnostic
```

**Use a different local model for routing**
```bash
OLLAMA_MODEL=llama3 ai "your task"
```

---

## License

MIT

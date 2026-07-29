# Glassbox 🔍

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg)](https://fastapi.tiangolo.com/)
[![Next.js 16](https://img.shields.io/badge/Frontend-Next.js%2016-000000.svg)](https://nextjs.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

> Open-source time-travel debugger for multi-agent AI systems. See every step your AI takes. Catch mistakes. Replay just the broken part.

Repository: [https://github.com/alianassyed84-sys/GlassBox](https://github.com/alianassyed84-sys/GlassBox)

---

## 🌟 Overview

When building complex multi-agent LLM pipelines (Planner/Worker/Aggregator pattern), debugging intermediate steps is historically difficult. If step 5 of a 6-step workflow fails or outputs unexpected JSON, developers usually have to rerun the entire pipeline from scratch.

**Glassbox** solves this by modeling agent execution as a transparent, persistent Directed Acyclic Graph (DAG). You can inspect prompts, outputs, execution latencies, and OpenTelemetry spans for every node — and **time-travel replay** execution from any broken node with revised parameters.

---

## ✨ Key Features

- 🕸️ **Visual Execution Graph**: Real-time graph visualization powered by React Flow with active node streaming.
- ⏳ **Time-Travel Replay**: Fork and re-execute pipeline runs from any historic DAG node without re-running prior successful steps.
- 🤝 **Interactive Clarification System**: Agents can pause pipeline execution to request human user input before proceeding.
- 👁️ **Dual View Modes**:
  - **Simple Mode**: Non-technical progress view for business stakeholders.
  - **Developer Mode**: Deep technical view with prompt/response JSON viewer, token counts, and span telemetry.
- 🏆 **Challenge Mode & Public Leaderboard**: Submit agent prompts to adversarial community evaluation benchmarks.
- 🔌 **Google Workspace Integrations**: Built-in tools for live Google Docs, Sheets, Gmail, and Calendar interactions.
- 📱 **PWA & Offline Support**: Service worker caching and IndexedDB offline state persistence via `idb`.

---

## 🏗️ Architecture

```
                      +-------------------+
                      |   FastAPI Main    |
                      +---------+---------+
                                |
             +------------------+------------------+
             |                                     |
             v                                     v
   +-------------------+                 +-------------------+
   | ThreadPoolWorker  |                 | Arq Redis Worker  |
   | (Local Dev MVP)   |                 | (Durable Prod Job)|
   +---------+---------+                 +---------+---------+
                                |
                                v
                      +-------------------+
                      | ConnectionManager |
                      |   (ws_manager)    |
                      +---------+---------+
                                | WS Broadcast
                                v
                      +-------------------+
                      |  React Frontend   |
                      +-------------------+
```

For detailed technical design specifications (including `traced_call()` wrappers, DAG schema, replay cascade algorithms, and IndexedDB sync strategy), see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## 🚀 Quickstart & Local Setup

### Prerequisites
- **Python**: 3.11 or higher
- **Node.js**: 20.x or higher
- **Groq API Key**: Obtain from [Groq Console](https://console.groq.com)

### 1. Clone the Repository
```bash
git clone https://github.com/alianassyed84-sys/GlassBox.git
cd GlassBox
```

### 2. Backend Setup
```bash
cd backend
python -m venv .venv

# Activate virtual environment
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
```

Edit `backend/.env` and set your `GROQ_API_KEY`:
```ini
GROQ_API_KEY=gsk_your_actual_groq_key
DEV_AUTH_BYPASS=true
```

Start the backend server:
```bash
uvicorn main:app --reload --port 8000
```

### 3. Frontend Setup
Open a new terminal window:
```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🌐 Deployment Guide

- **Backend (Render)**: Deploy using the included [render.yaml](backend/render.yaml) infrastructure spec or [Procfile](backend/Procfile) with Gunicorn:
  ```bash
  web: gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT
  ```
- **Frontend (Vercel)**: Import `frontend` into Vercel using [vercel.json](frontend/vercel.json) and set `NEXT_PUBLIC_API_URL` to your backend URL.

---

## 🛣️ Roadmap

- [ ] Multi-framework support (LangGraph, CrewAI, AutoGen adapters)
- [ ] Mobile app (React Native)
- [ ] Team workspaces (share runs with your team)
- [ ] Custom agent framework SDK
- [ ] Regression testing (compare run quality across model versions)
- [ ] Automated eval scoring pipeline
- [ ] VS Code extension for inline debugging

---

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a PR.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

MIT License — see [LICENSE](LICENSE) file for details.

---

## 👨‍💻 Author

Built by **Ali Anass Syed**
- **GitHub**: [alianassyed84-sys](https://github.com/alianassyed84-sys)
- **LinkedIn**: [LinkedIn Profile](https://linkedin.com/in/alianassyed)
- **Twitter/X**: [@alianassyed](https://x.com/alianassyed)

---

## 🙏 Acknowledgements

- [Groq](https://groq.com) for blazing-fast LLM inference
- [React Flow](https://reactflow.dev) for graph visualization primitives
- [Clerk](https://clerk.com) for authentication infrastructure
- [Framer Motion](https://framer.com/motion) for smooth UI animations
- The open-source AI developer community

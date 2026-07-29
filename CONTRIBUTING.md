# Contributing to Glassbox

First off, thank you for considering contributing to Glassbox! Contributions are welcome from everyone.

Please review the guidelines below to make the contribution process smooth for everyone.

---

## 🛠️ Dev Environment Setup

### Prerequisites
- Python 3.11+
- Node.js 20+ and `npm`
- Git

### 1. Fork & Clone
```bash
git clone https://github.com/YOUR_USERNAME/GlassBox.git
cd GlassBox
```

### 2. Backend Setup
```bash
cd backend
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
```

### 3. Frontend Setup
```bash
cd ../frontend
npm install
cp .env.local.example .env.local
```

### 4. Running Locally
- Start the Backend: `uvicorn main:app --reload --port 8000` (in `backend/`)
- Start the Frontend: `npm run dev` (in `frontend/`)

---

## 🎨 Code Style Guidelines

- **Python Backend**: Follow PEP 8 guidelines. Format code using [Black](https://github.com/psf/black) and [isort](https://github.com/PyCQA/isort).
  ```bash
  black backend/
  ```
- **TypeScript Frontend**: Use standard React & Next.js idioms. Format code using [Prettier](https://prettier.io/).
  ```bash
  npm run lint
  ```

---

## 🧪 Running Tests

### Backend Tests
```bash
cd backend
python test_user_isolation.py
```

### Frontend Type Check & Build
```bash
cd frontend
npx tsc --noEmit
npm run build
```

---

## 🔀 Pull Request Guidelines & Conventions

1. **Branch Naming**: Use clear prefix conventions:
   - `feat/amazing-feature`
   - `fix/websocket-reconnect-bug`
   - `docs/update-architecture`
   - `chore/upgrade-deps`

2. **Commit Message Format**:
   - `feat: add custom agent framework SDK adapter`
   - `fix: resolve CORS origin mismatch for production domain`
   - `docs: update setup steps in README`

3. **PR Process**:
   - Ensure all tests and type checks pass locally before opening a PR.
   - Fill out the PR template completely.
   - Request review from project maintainers.

---

## 🐛 Reporting Issues

Before opening a new issue, please search the existing issues to ensure it hasn't already been reported.

When creating a bug report or feature request, use the provided GitHub issue templates:
- **Bug Report**: Provide clear steps to reproduce, expected vs. actual behavior, OS/Browser specs, and relevant logs.
- **Feature Request**: Explain the core problem solved, proposed solution, and alternative designs considered.

---
name: 📋 New Contributor Checklist
about: Checklist for new contributors to get started with RSM Studio
title: "New Contributor Onboarding: [Your Name]"
labels: ["onboarding", "contributor"]
assignees: []
---

# Welcome to RSM Studio! 🚀

Thank you for your interest in contributing to RSM Studio! This checklist will help you get started and ensure you have everything you need to make successful contributions.

## 📋 Pre-Development Setup

### Repository Setup
- [ ] **Fork the repository** to your GitHub account
- [ ] **Clone your fork** locally: `git clone https://github.com/YOUR_USERNAME/aris.git`
- [ ] **Add upstream remote**: `git remote add upstream https://github.com/ORIGINAL_OWNER/aris.git`

### Development Environment

#### Backend Setup (Python)
- [ ] **Install Python 3.13+** (check with `python --version`)
- [ ] **Install uv package manager**: Follow [uv installation guide](https://docs.astral.sh/uv/)
- [ ] **Navigate to backend**: `cd backend`
- [ ] **Install dependencies**: `uv sync`
- [ ] **Set up database**: `alembic upgrade head`
- [ ] **Test backend setup**: `uvicorn main:app --reload`
- [ ] **Verify API docs**: Visit http://localhost:8000/docs

#### Frontend Setup (Vue.js)
- [ ] **Install Node.js 18+** (check with `node --version`)
- [ ] **Navigate to frontend**: `cd frontend`
- [ ] **Install dependencies**: `npm install`
- [ ] **Test frontend setup**: `npm run dev`
- [ ] **Verify frontend**: Visit http://localhost:5173

### Testing Setup
- [ ] **Run backend tests**: `cd backend && uv run pytest`
- [ ] **Run frontend tests**: `cd frontend && npm test`
- [ ] **Run linting tools**:
  - Backend: `cd backend && uv run ruff check`
  - Frontend: `cd frontend && npm run lint`

## 📚 Documentation & Guidelines

### Reading & Understanding
- [ ] **Read README.md** - Understand project overview and setup
- [ ] **Read CONTRIBUTING.md** - Understand development workflow and standards
- [ ] **Read CODE_OF_CONDUCT.md** - Understand community standards
- [ ] **Review API documentation** at http://localhost:8000/docs
- [ ] **Explore the codebase** structure in both `backend/` and `frontend/`

### Architecture Understanding
- [ ] **Backend**: Understand FastAPI + SQLAlchemy structure
- [ ] **Frontend**: Understand Vue 3 Composition API patterns
- [ ] **Database**: Review models in `backend/aris/models/models.py`
- [ ] **API Routes**: Review route handlers in `backend/aris/routes/`
- [ ] **CRUD Operations**: Review database operations in `backend/aris/crud/`

## 🛠️ First Contribution

### Getting Started
- [ ] **Look for "good first issue" labels** in the Issues tab
- [ ] **Choose an issue** that matches your skill level and interests
- [ ] **Comment on the issue** to express interest and ask questions
- [ ] **Wait for assignment** or confirmation from maintainers

### Development Process
- [ ] **Create a feature branch**: `git checkout -b feat/your-feature-name`
- [ ] **Make your changes** following the coding standards
- [ ] **Write tests** for new functionality
- [ ] **Run all tests** to ensure nothing breaks
- [ ] **Commit changes** using conventional commit format:
  - `feat: add user authentication endpoint`
  - `fix: resolve database connection timeout`
  - `docs: update API documentation`

### Submission Process
- [ ] **Push your branch**: `git push origin feat/your-feature-name`
- [ ] **Create a Pull Request** on GitHub
- [ ] **Fill out the PR template** completely
- [ ] **Link the related issue** in your PR description
- [ ] **Wait for code review** and address feedback
- [ ] **Celebrate your contribution!** 🎉

## 🔧 Development Tools & Tips

### Recommended Tools
- [ ] **IDE/Editor**: VS Code, PyCharm, or your preferred editor
- [ ] **API Testing**: Use the built-in FastAPI docs or tools like Postman
- [ ] **Database Browser**: SQLite Browser for local development
- [ ] **Git GUI**: GitHub Desktop, SourceTree, or command line

### Useful Commands
```bash
# Backend development
cd backend
uv run pytest                    # Run tests
uv run pytest --cov=aris        # Run tests with coverage
uv run ruff check               # Lint code
uv run mypy aris/               # Type checking

# Frontend development
cd frontend
npm run dev                     # Start dev server
npm test                        # Run tests
npm run lint                    # Lint code
npm run build                   # Build for production

# Database operations
cd backend
alembic revision --autogenerate -m "description"  # Create migration
alembic upgrade head            # Apply migrations
```

## 🤝 Community & Support

### Getting Help
- [ ] **Join discussions** in GitHub Discussions
- [ ] **Ask questions** in your issue or PR comments
- [ ] **Read existing issues** and PRs for context
- [ ] **Follow the project** to stay updated

### Communication Guidelines
- [ ] **Be respectful** and follow the Code of Conduct
- [ ] **Ask questions** when you're stuck - we're here to help!
- [ ] **Provide context** when reporting issues or asking for help
- [ ] **Be patient** with code reviews - maintainers are volunteers

## ✅ Ready to Contribute!

Once you've completed this checklist, you're ready to start contributing to RSM Studio!

### Quick Verification
- [ ] **Environment works**: Both backend and frontend run successfully
- [ ] **Tests pass**: All existing tests are passing
- [ ] **Understanding**: You understand the project structure and workflow
- [ ] **Issue selected**: You have an issue to work on
- [ ] **Branch created**: You're ready to start coding

### Next Steps
1. Start working on your selected issue
2. Follow the development process outlined above
3. Don't hesitate to ask questions in your issue or PR
4. Have fun contributing to open source! 🚀

---

**Questions or stuck on any step?** Comment below and a maintainer will help you out!

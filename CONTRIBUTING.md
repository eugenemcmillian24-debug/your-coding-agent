# Contributing to Forge Agent

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/your-coding-agent.git`
3. Create a feature branch: `git checkout -b feature/your-feature`
4. Make your changes
5. Run tests: `cd backend && pytest -v`
6. Commit: `git commit -m "feat: your feature description"`
7. Push: `git push origin feature/your-feature`
8. Open a Pull Request

## Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — new feature
- `fix:` — bug fix
- `docs:` — documentation only
- `refactor:` — code refactoring
- `test:` — adding/fixing tests
- `chore:` — maintenance tasks

## Code Style

- Python: Follow PEP 8, use type hints
- TypeScript: Follow project conventions
- All code must pass CI checks before merge

## Reporting Issues

Use GitHub Issues with a clear title and description. Include:
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, Docker version, etc.)

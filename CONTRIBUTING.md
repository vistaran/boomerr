# Contributing to Boomerr

Thank you for your interest in contributing to Boomerr! We welcome contributions from developers, designers, sysadmins, and technical writers of all experience levels.

---

## Code of Conduct

By participating in this project, you agree to abide by the principles outlined in our [Code of Conduct](CODE_OF_CONDUCT.md). Please treat all contributors with respect, courtesy, and professionalism.

---

## How Can You Contribute?

* **Reporting Bugs:** If you discover an issue, check existing GitHub Issues first. If it has not been reported, open a new issue using our Bug Report template with steps to reproduce, logs, and your environment details.
* **Suggesting Features:** We welcome proposals for new monitoring capabilities, alert channels, and dashboard improvements. Open an issue using the Feature Request template.
* **Submitting Pull Requests:** Whether fixing a typo in documentation, addressing a known bug, or adding a new integration, pull requests are warmly appreciated.

---

## Development Environment Setup

Boomerr uses Docker Compose to provide an identical development environment across platforms.

### Prerequisites
* Docker Engine 24+ and Docker Compose v2+
* Node.js 20+ (for local frontend development)
* PHP 8.2+ and Composer (for local CLI development)

### Quick Start
1. Fork and clone the repository:
   ```bash
   git clone https://github.com/<your-username>/boomerr.git
   cd boomerr
   ```
2. Create your feature branch:
   ```bash
   git checkout -b feature/my-new-feature
   ```
3. Set up the local environment:
   ```bash
   chmod +x setup.sh
   ./setup.sh
   ```
4. Access the application at `http://localhost:8080`.

---

## Testing Guidelines

Before opening a pull request, verify that your changes pass all test suites:

### 1. Backend Syntax & Unit Tests
```bash
# Run PHP syntax checks
cd backend
php -l app/Services/PlanLimitService.php

# Run unit tests
php artisan test --testsuite=Unit
```

### 2. Frontend Type Checking & Production Build
```bash
cd frontend
npm run build
```

### 3. Self-Hosting Diagnostic Check
```bash
docker compose exec api php artisan boomerr:doctor
```

---

## Pull Request Guidelines

1. **Keep PRs Focused:** Aim for single-responsibility pull requests. If working on multiple unrelated features or fixes, submit them in separate PRs.
2. **Follow Coding Conventions:**
   * Backend: Follow PSR-12 and standard Laravel conventions.
   * Frontend: Follow React best practices with strict TypeScript types and Tailwind CSS.
3. **Include Tests:** Add unit or feature tests for any new business logic, security helpers, or plan limit changes.
4. **Update Documentation:** If you introduce new configuration variables or change operational behavior, update the relevant files in `docs/`.
5. **Write Clear Commit Messages:** Use descriptive, imperative commit messages (e.g., `Add Telegram webhook retry backoff`, `Fix SSL expiry alert calculation`).

---

## Questions and Support

If you need guidance or have questions before starting work on a feature, feel free to open a GitHub Discussion or join our community chat.

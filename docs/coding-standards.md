# Coding Standards

## General

* TypeScript only
* Strong typing preferred over any
* Prefer composition over inheritance
* Keep components focused and small
* Favor readability over cleverness

## Framework

* SvelteKit
* Progressive Web App first
* Mobile-first design

## Project Structure

src/
lib/
components/
stores/
services/
types/
routes/

docs/

static/

## Documentation Workflow

Before beginning work:

1. Read project-context.md
2. Read architecture.md
3. Read current-task.md
4. Read decisions.md

After completing work:

1. Update decisions.md if needed
2. Update current-task.md
3. Update next-steps.md

## Git Workflow

* Small commits
* Descriptive commit messages
* Feature branches for major work

## Dependency Philosophy

Before adding a dependency:

* Verify the need
* Consider bundle size
* Consider long-term maintenance
* Prefer native platform capabilities where reasonable

## AI Agent Rules

All AI agents must:

* Read project documentation before implementation
* Preserve existing architectural decisions
* Update documentation when major decisions change
* Avoid introducing unnecessary complexity
* Avoid introducing premium-only concepts or monetization assumptions

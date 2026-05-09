# Contributing to Codanium (Ai-Team Studio)

First off, thank you for considering contributing to Codanium! It's people like you that make open source such a great community.

## Code of Conduct

By participating in this project, you are expected to uphold our Code of Conduct. Please be respectful and considerate of others when interacting in the community.

## How Can I Contribute?

### Reporting Bugs

- Ensure the bug was not already reported by searching on GitHub under Issues.
- If you're unable to find an open issue addressing the problem, open a new one. Be sure to include a title and clear description, as much relevant information as possible, and a code sample or an executable test case demonstrating the expected behavior that is not occurring.

### Suggesting Enhancements

- Open a new issue with the label `enhancement`.
- Provide a clear and detailed explanation of the feature you want. Explain why this enhancement would be useful to most users.

### Pull Requests

1. Fork the repo and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. If you've changed APIs, update the documentation.
4. Ensure the test suite passes.
5. Make sure your code lints (`npm run lint`).
6. Issue that pull request!

## Local Development Setup

1. Fork and clone the repository.
2. Install dependencies with `npm install`.
3. Set up your environment variables based on `.env.example`.
4. Run `docker compose up -d db redis` to start the required services.
5. Setup the database with `npx prisma db push` and `npx prisma db seed`.
6. Start the development server with `npm run dev`.

Thank you for contributing!

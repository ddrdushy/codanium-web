# Local Development Setup

To contribute to Codanium or run it locally, follow these steps.

## Prerequisites

- **Node.js**: v18 or higher
- **Docker**: For running PostgreSQL and Redis containers.
- **Git**

## 1. Clone the Repository

```bash
git clone https://github.com/AiSenseiMY/Ai-Team_studio.git
cd Ai-Team_studio
```

## 2. Install Dependencies

```bash
npm install
```

## 3. Environment Variables

Copy the example environment file and configure your keys.

```bash
cp .env.example .env
```

At a minimum, you will need to provide an `ENCRYPTION_KEY` (a 32-byte hex string) and `INTERNAL_TASK_SECRET` (any random string) for the application to boot. To use the AI features, add either an `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`. If you don't provide one, the system will fall back to the internal `Mock` provider.

## 4. Start Infrastructure

Start the PostgreSQL database and Redis queue via Docker Compose:

```bash
docker compose up -d db redis
```

## 5. Database Setup

Push the Prisma schema to your local database and seed it with the default agents, SDLC stages, and demo users:

```bash
npx prisma db push
npx prisma db seed
```

*Note: The demo user is `user@demo.com` with password `password123`.*

## 6. Run the Application

Start the Next.js development server (using Turbopack):

```bash
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000).

## Running Tests

To run the Vitest unit/integration suite:
```bash
npm run test
```

To run Playwright end-to-end tests:
```bash
npx playwright test
```

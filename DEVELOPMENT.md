# Local Development Guide — Atlased

This guide covers setting up Atlased for local development using SQLite (no database server needed) or PostgreSQL with Docker.

## Option A: SQLite (Fastest Setup, Recommended)

SQLite is a file-based database with zero server overhead. Perfect for rapid local development and testing.

### Setup (5 minutes)

```bash
cd backend
npm install
```

That's it! The `.env.local` file is pre-configured for SQLite.

### Running the Backend

**Option 1: PowerShell (Recommended on Windows)**

```bash
cd backend
./dev.ps1
```

**Option 2: Command Prompt**

```bash
cd backend
dev.bat
```

**Option 3: Manual environment setup (Linux/Mac or advanced)**

```bash
export DATABASE_PROVIDER=sqlite
export DATABASE_URL="file:./atlased-dev.db"
export JWT_SECRET="+iqzhgengiac3yPQotwJPEbovE6B2nC1iUqs90QZYG2PcN6AxX4XMTfUhfVqhR9B"
export CORS_ORIGIN="http://localhost:5173"
npm run dev
```

The backend starts on `http://localhost:4000`. The SQLite database file (`atlased-dev.db`) is created automatically in the `backend/` directory on first run.

### Seeding with Countries & Cities

```bash
cd backend
npm run db:seed
```

This populates ~250 countries and ~1,000 cities from the static JSON files in `backend/prisma/data/`.

### Importing Full City Coverage (GeoNames)

If you want country lists with very broad city coverage (similar to travel tracker apps that ship large offline place catalogs), import a GeoNames city dump.

1. Download a GeoNames cities file (for example `cities500.txt`) from https://download.geonames.org/export/dump/
2. Put it somewhere on disk (for example `backend/prisma/data/cities500.txt`)
3. Run:

```bash
cd backend
GEONAMES_FILE=./prisma/data/cities500.txt npm run db:import:geonames
```

Optional environment variables:

```bash
GEONAMES_MIN_POP=500        # default 500
GEONAMES_BATCH_SIZE=2000    # default 2000
GEONAMES_REPLACE=true       # delete existing cities before import (default true)
GEONAMES_MAX_ROWS=0         # 0 = no cap; set for test runs
```

### Running the Frontend

In a new terminal:

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Testing Auth Flow

1. Go to [http://localhost:5173/signup](http://localhost:5173/signup)
2. Create an account with any email/password (minimum 8 chars)
3. Login redirects to home page
4. Toggle theme with the moon/sun icon
5. Logout returns to login page

### Database Inspector (SQLite)

To inspect the SQLite database directly:

```bash
cd backend
npx prisma studio
```

This opens a web UI at `http://localhost:5555` showing all tables and records.

---

## Option B: PostgreSQL + Docker (Full Testing)

Use this if you want to test against PostgreSQL (same as production on the Pi).

### Prerequisites

- Docker Desktop installed and running

### Setup (10 minutes)

```bash
# 1. Copy environment template
cp .env.example .env

# 2. Edit .env and set:
#    - DATABASE_PROVIDER=postgresql
#    - DATABASE_URL=postgresql://atlased_user:change_me@localhost:5432/atlased
#    - POSTGRES_PASSWORD=your-strong-password
```

### Start the Database

```bash
docker compose -f docker-compose.dev.yml up -d
```

Verify it's running:

```bash
docker ps  # Should show postgres container
```

### Initialize Database

```bash
cd backend
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

### Running Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Cleanup

When done with PostgreSQL:

```bash
docker compose -f docker-compose.dev.yml down -v
```

The `-v` flag removes the database volume, giving you a clean slate next time.

---

## Switching Between SQLite and PostgreSQL

### From PostgreSQL to SQLite

```bash
# 1. Backup any data you care about (Prisma Studio or DB export)
# 2. Delete the old database file if it exists
rm backend/atlased-dev.db
# 3. Stop PostgreSQL container
docker compose -f docker-compose.dev.yml down
# 4. Load .env.local
cd backend
# Edit .env if needed, or just ensure DATABASE_PROVIDER=sqlite
npm run dev
```

### From SQLite to PostgreSQL

```bash
# 1. Stop backend
# 2. Update .env (or .env.local equivalent):
export DATABASE_PROVIDER=postgresql
export DATABASE_URL=postgresql://atlased_user:password@localhost:5432/atlased
# 3. Start PostgreSQL
docker compose -f docker-compose.dev.yml up -d
# 4. Run migrations
cd backend
npx prisma migrate dev
npm run db:seed
npm run dev
```

---

## Common Issues

### Backend won't start: "Invalid or missing environment variables"

**SQLite:** Copy the `.env.local` file from the project root into `backend/` if it's missing, or ensure `DATABASE_PROVIDER` and `DATABASE_URL` are set.

**PostgreSQL:** Verify `docker compose -f docker-compose.dev.yml up -d` is running and all env vars are set in `.env`.

### Frontend shows "Loading..." forever

Check browser console (F12) for errors. Common causes:

- Backend not running (should see error in console)
- CORS_ORIGIN mismatch (ensure `http://localhost:5173` in `.env` or `.env.local`)

### Database file not persisting (SQLite)

The file `backend/atlased-dev.db` should exist after first run. If it doesn't:

```bash
cd backend
ls -la atlased-dev.db  # Check if it exists
```

If missing, Prisma will create it on next `npm run dev`.

### Docker container won't start

```bash
docker compose -f docker-compose.dev.yml logs
```

Common issues:

- Port 5432 already in use: Change `DB_PORT` in `.env`
- Permission denied: Run with `sudo` or fix Docker permissions

---

## Environment Files

### `.env.local` (Pre-configured for SQLite)

Provided in the repo, ready to use. No edits needed unless you want to change ports or secrets.

### `.env` (For PostgreSQL)

Copy from `.env.example` and edit as needed:

```bash
cp .env.example .env
# Edit .env with your values
```

**Never commit `.env`** — it's in `.gitignore` for security.

---

## Project Structure (Backend)

```
backend/
├── src/
│   ├── index.ts           # Express app setup
│   ├── config.ts          # Environment validation
│   ├── middleware/        # Auth, validation, rate limiting
│   └── routes/            # API endpoints
├── prisma/
│   ├── schema.prisma      # Database schema (supports SQLite + PostgreSQL)
│   ├── seed.ts            # Seeding script
│   ├── migrations/        # Database migrations (auto-generated)
│   └── data/
│       ├── countries.json # ~250 countries with metadata
│       └── cities.json    # ~1,000 cities with lat/lng
├── scripts/
│   └── fetchCountries.ts  # One-time fetch from restcountries.com
├── package.json
└── tsconfig.json
```

---

## Next Steps

- **Phase 5:** Add react-globe.gl for 3D globe visualization
- **Phase 6:** Build country detail panel and city checklist
- **Phase 7:** Add list/grid view alternatives
- **Phase 8:** Full integration test with Docker + deployment

For more details, see the main [README.md](./README.md).

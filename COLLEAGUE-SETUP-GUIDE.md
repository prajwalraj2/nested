# 🚀 Project Setup Guide for Colleagues

## Prerequisites
Make sure you have these installed:
- **Node.js** (v18.17+ recommended)
- **Git** 
- **PostgreSQL** database (local or cloud)

## Step 1: Clone the Repository

```bash
# Clone the repository (replace with your actual GitHub URL)
git clone https://github.com/your-username/your-repo-name.git

# Navigate to the project directory
cd nested-app
```

## Step 2: Install Dependencies

```bash
# Install all project dependencies
npm install
```

## Step 3: Database Setup

### Option A: Local PostgreSQL
1. Install PostgreSQL locally
2. Create a new database:
   ```sql
   CREATE DATABASE nested_app_db;
   ```

### Option B: Cloud Database (Recommended)
Use a free PostgreSQL service like:
- **Neon** (https://neon.tech) - Free tier with 500MB
- **Supabase** (https://supabase.com) - Free tier with 500MB
- **Railway** (https://railway.app) - Free tier available

## Step 4: Environment Variables

Create a `.env` file in the root directory:

```bash
# Copy the example (if exists) or create new
touch .env
```

Add the following environment variables to `.env`:

```env
# Database Connection
DATABASE_URL="postgresql://username:password@localhost:5432/nested_app_db"
# For cloud databases, use the connection string provided by your service

# Authentication Secret (generate a random string)
NEXTAUTH_SECRET="your-super-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"

# Optional: Add other environment variables as needed
NODE_ENV="development"
```

**🔐 To generate a secure secret:**
```bash
# Run this command to generate a random secret
openssl rand -base64 32
```

## Step 5: Database Migration & Seeding

```bash
# Generate Prisma client
npx prisma generate

# Apply the migration history to create the tables.
# Use `migrate deploy`, NOT `db push`: `db push` syncs the schema without recording
# anything in _prisma_migrations, which is how this project ended up with no migration
# history at all and two entire feature schemas missing from it.
npx prisma migrate deploy
```

### Create your admin account

The tables exist but there are no users yet, and there is no way to sign in until one
exists — `POST /api/admin/users` requires you to already be an admin. So this step is
**not optional** on a fresh database.

You must supply the credentials yourself; the script has no default and will refuse to
run without them.

```bash
# bash / git bash
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='<a strong password>' npm run seed:admin
```

```powershell
# PowerShell — note there is no inline VAR=value prefix in PowerShell
$env:ADMIN_EMAIL='you@example.com'; $env:ADMIN_PASSWORD='<a strong password>'; npm run seed:admin
```

The password must satisfy the same policy the admin panel enforces: at least 8
characters with an uppercase letter, a lowercase letter, a number and a special
character. Prefer passing the variables on the command line rather than adding them to
`.env`, so the password does not sit on disk after you are done.

> **Why no default?** This script used to ship with `admin@example.com` / `Admin123!`
> hardcoded, behind a `// ← Change this` comment nobody acted on. That account went live
> on production and stayed usable for about ten months. A convenient default is exactly
> how that happens, so there deliberately isn't one.

## Step 6: Run the Development Server

```bash
# Start the development server
npm run dev
```

The application will be available at: **http://localhost:3000**

## Step 7: Verify Setup

1. **Database**: Check if tables are created by running:
   ```bash
   npx prisma studio
   ```
   This opens a database browser at http://localhost:5555

2. **Application**: Visit http://localhost:3000 to see the app running

## 🛠️ Available Scripts

```bash
# Development server with Turbopack (faster)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint

# Database operations
npx prisma generate         # Generate Prisma client
npx prisma migrate deploy   # Apply pending migrations (use this, not `db push`)
npx prisma migrate status   # Show which migrations are applied / pending
npx prisma studio           # Open database browser

# Create the first admin. Requires ADMIN_EMAIL and ADMIN_PASSWORD — no defaults.
npm run seed:admin
```

> ⚠️ `npm run build` runs `prisma generate`, **not** `prisma migrate deploy`, so
> migrations do **not** apply themselves on deploy. When a migration adds columns the new
> code reads, apply it to the target database *before* shipping the code.

## 📁 Project Structure

```
nested-app/
├── src/
│   ├── app/              # Next.js App Router pages
│   ├── components/       # React components
│   │   ├── ui/          # shadcn/ui components
│   │   ├── admin/       # Admin interface components
│   │   └── domain/      # Domain-specific components
│   ├── lib/             # Utility libraries
│   └── types/           # TypeScript type definitions
├── prisma/
│   ├── schema.prisma    # Database schema
│   └── migrations/      # Database migrations
└── public/              # Static assets
```

## 🔧 Common Issues & Solutions

### Issue: "Module not found" errors
**Solution:** Delete node_modules and reinstall
```bash
rm -rf node_modules package-lock.json
npm install
```

### Issue: Database connection errors
**Solution:** 
1. Check your DATABASE_URL in `.env`
2. Ensure PostgreSQL is running
3. Verify database credentials

### Issue: Prisma client errors
**Solution:**
```bash
npx prisma generate
npx prisma db push
```

### Issue: Port 3000 already in use
**Solution:** 
```bash
# Use a different port
npm run dev -- -p 3001
```

## 🚀 Next Steps

1. **Admin Access**: The app includes an admin panel at `/admin`
2. **Authentication**: Login system is set up with user management
3. **Tables**: Dynamic table system for data management
4. **Domain Management**: Multi-domain content management

## 📞 Need Help?

If you encounter any issues:
1. Check the console for error messages
2. Verify all environment variables are set correctly
3. Ensure the database is accessible
4. Contact the project maintainer with specific error details

---

**Happy Coding! 🎉**

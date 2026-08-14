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

# Run database migrations to create tables
npx prisma db push

# (Optional) Seed the database with initial data
npm run seed:admin
```

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
npx prisma generate     # Generate Prisma client
npx prisma db push     # Push schema changes to database
npx prisma studio      # Open database browser
npm run seed           # Seed database
npm run seed:admin     # Seed admin data
```

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

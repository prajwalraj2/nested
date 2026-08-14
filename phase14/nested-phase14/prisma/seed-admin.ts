import { PrismaClient } from '../src/generated/prisma'
import { PasswordUtils } from '../src/lib/password'

const prisma = new PrismaClient()

async function createFirstAdmin() {
  try {
    console.log('🔐 Creating first admin user...')

    // Admin user details - UPDATE THESE WITH YOUR PREFERRED CREDENTIALS
    const adminData = {
      email: 'admin@example.com',           // ← Change this to your email
      name: 'Admin User',                   // ← Change this to your name  
      password: 'Admin123!',                // ← Change this to your preferred password
    }

    // Check if admin already exists
    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminData.email }
    })

    if (existingAdmin) {
      console.log(`✅ Admin user already exists: ${adminData.email}`)
      console.log('   Use this email to login to the admin panel')
      return
    }

    // Hash the password
    const hashedPassword = await PasswordUtils.hash(adminData.password)

    // Create the admin user
    const adminUser = await prisma.user.create({
      data: {
        email: adminData.email,
        name: adminData.name,
        password: hashedPassword,
        isAdmin: true,
        isActive: true,
      }
    })

    console.log('✅ First admin user created successfully!')
    console.log('')
    console.log('📋 Login Credentials:')
    console.log(`   Email: ${adminData.email}`)
    console.log(`   Password: ${adminData.password}`)
    console.log('')
    console.log('🚀 Next steps:')
    console.log('   1. Start your dev server: npm run dev')
    console.log('   2. Visit: http://localhost:3000/admin')
    console.log('   3. Login with the credentials above')
    console.log('')

  } catch (error) {
    console.error('❌ Error creating admin user:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

createFirstAdmin()

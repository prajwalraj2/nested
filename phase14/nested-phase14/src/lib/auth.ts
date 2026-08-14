import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { PasswordUtils } from "./password"
import { prisma } from "./prisma"
import { z } from "zod"

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        try {
          const { email, password } = loginSchema.parse(credentials)

          // Find user in database
          const user = await prisma.user.findUnique({
            where: { email: email.toLowerCase() },
            select: {
              id: true,
              email: true,
              name: true,
              password: true,
              isAdmin: true,
              isActive: true,
            }
          })

          if (!user) {
            return null
          }

          // Check if user is active
          if (!user.isActive) {
            return null
          }

          // Verify password
          const isPasswordValid = await PasswordUtils.verify(password, user.password)
          if (!isPasswordValid) {
            return null
          }

          // Update last login time
          await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() }
          })

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            isAdmin: user.isAdmin,
            isActive: user.isActive,
          }
        } catch (error) {
          console.error('Auth error:', error)
          return null
        }
      }
    })
  ],
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  callbacks: {
    async session({ session, token }) {
      if (session?.user && token) {
        session.user.id = token.sub as string
        session.user.isAdmin = token.isAdmin || false
        session.user.isActive = token.isActive || false
      }
      return session
    },
    async jwt({ token, user }) {
      if (user) {
        token.isAdmin = user.isAdmin
        token.isActive = user.isActive
      }
      return token
    }
  },
  pages: {
    signIn: "/login",
    signOut: "/login"
  },
  trustHost: true, // Allow localhost in production
  debug: process.env.NODE_ENV === "development",
})
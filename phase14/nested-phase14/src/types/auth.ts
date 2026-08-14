import { DefaultSession } from "next-auth"
import { DefaultJWT } from "next-auth/jwt"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      isAdmin: boolean
      isActive: boolean
    } & DefaultSession["user"]
  }

  interface User {
    id: string
    email: string
    name?: string | null
    image?: string | null
    isAdmin: boolean
    isActive: boolean
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    isAdmin: boolean
    isActive: boolean
  }
}

export interface CreateUserData {
  email: string
  name?: string
  password: string
  isAdmin?: boolean
}

export interface UpdateUserData {
  email?: string
  name?: string
  password?: string
  isAdmin?: boolean
  isActive?: boolean
}

export interface LoginFormData {
  email: string
  password: string
}

export interface RegisterFormData {
  email: string
  name: string
  password: string
  confirmPassword: string
}

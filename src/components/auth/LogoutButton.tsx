'use client'

import { useState } from 'react'
import { signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { LogOut, Loader2 } from 'lucide-react'

interface LogoutButtonProps {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  className?: string
  showIcon?: boolean
  children?: React.ReactNode
}

export default function LogoutButton({ 
  variant = 'outline',
  size = 'default',
  className = '',
  showIcon = true,
  children
}: LogoutButtonProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleLogout = async () => {
    setIsLoading(true)
    
    // Progress `console.log`s were removed from this function. They narrated each step
    // ("Starting logout process...", "NextAuth signOut completed", …) to every user's
    // console on every logout. The `console.error` calls below are kept — a FAILING
    // logout is worth reporting; a succeeding one is not.
    try {
      // Method 1: Try NextAuth signOut first
      try {
        await signOut({
          callbackUrl: '/login',
          redirect: false
        })
      } catch (signOutError) {
        console.error('NextAuth signOut failed:', signOutError)
      }

      // Method 2: Call manual logout API as backup
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'include'
        })
      } catch (apiError) {
        console.error('Manual logout API failed:', apiError)
      }
      
      // Method 3: Clear browser storage
      if (typeof window !== 'undefined') {
        localStorage.clear()
        sessionStorage.clear()
        
        // Clear all cookies manually
        document.cookie.split(";").forEach(cookie => {
          const eqPos = cookie.indexOf("=")
          const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim()
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`
        })
      }
      
      // Force redirect to login page
      window.location.href = '/login'
      
    } catch (error) {
      console.error('Complete logout process failed:', error)
      
      // Ultimate fallback - just redirect
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleLogout}
      disabled={isLoading}
      className={className}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        showIcon && <LogOut className="h-4 w-4" />
      )}
      {children || (
        <span className={showIcon ? 'ml-2' : ''}>
          {isLoading ? 'Signing out...' : 'Sign Out'}
        </span>
      )}
    </Button>
  )
}

'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/admin'

  /**
   * Turn the error code from `authorize()` into something a human can act on.
   *
   * WHERE `code` COMES FROM: `authorize()` in src/lib/auth.ts throws a
   * `CredentialsSignin` subclass carrying a `code`. Auth.js puts that string in the
   * response, which `signIn({ redirect: false })` hands back as `result.code`.
   *
   * ⚠️ `result.error` is NOT useful for this. It is always the generic string
   * `"CredentialsSignin"` for any credentials failure, which is why the old code could
   * only ever print "Invalid email or password" — it had nothing else to go on.
   *
   * The lockout code carries the remaining minutes as a suffix (`locked-8`) so the
   * message can state a real number instead of a vague "try later". Parsed with a
   * regex rather than `split('-')` so a malformed value falls through to the generic
   * message instead of rendering "try again in undefined minutes".
   */
  const describeError = (code: string | undefined): string => {
    const locked = code?.match(/^locked-(\d+)$/)
    if (locked) {
      const minutes = Number(locked[1])
      return `Too many failed attempts. This account is locked for security. ` +
        `Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`
    }

    // Everything else — unknown email, wrong password, deactivated account — is
    // deliberately one message. The server sends a single code for all three so that
    // the response body cannot be used to discover which emails have accounts.
    return 'Invalid email or password'
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError(describeError(result.code))
      } else if (result?.ok) {
        router.push(callbackUrl)
        router.refresh()
      }
    } catch {
      // Reaching here means the request itself failed (offline, network error) rather
      // than the credentials being rejected — a different situation, different message.
      setError('An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    // `bg-gray-50` was hardcoded here: a permanently light page behind a themed Card, so
    // in dark mode the card would have gone dark while the page around it stayed pale
    // grey. `bg-muted` is the token equivalent — subtly off-background in both themes.
    <div className="min-h-screen flex items-center justify-center bg-muted py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center">
            Admin Login
          </CardTitle>
          <p className="text-sm text-muted-foreground text-center">
            Enter your credentials to access the admin panel
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                required
                disabled={isLoading}
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  disabled={isLoading}
                  autoComplete="current-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

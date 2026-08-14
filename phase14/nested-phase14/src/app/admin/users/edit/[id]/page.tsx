'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import UserForm from '@/components/admin/users/UserForm'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Loader2 } from 'lucide-react'
import Link from 'next/link'

interface User {
  id: string
  email: string
  name: string | null
  isAdmin: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
  lastLoginAt: string | null
}

type UserFormData = {
  email: string
  name: string
  password?: string
  confirmPassword?: string
  isAdmin: boolean
}

interface PageParams {
  params: Promise<{ id: string }>
}

export default function EditUserPage({ params }: PageParams) {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  // Unwrap params
  useEffect(() => {
    params.then(({ id }) => setUserId(id))
  }, [params])

  // Fetch user data
  useEffect(() => {
    if (!userId) return

    const fetchUser = async () => {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`/api/admin/users/${userId}`)
        
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('User not found')
          }
          throw new Error('Failed to fetch user')
        }

        const data = await response.json()
        setUser(data.user)
      } catch (err: any) {
        setError(err.message || 'Failed to load user')
      } finally {
        setLoading(false)
      }
    }

    fetchUser()
  }, [userId])

  const handleUpdateUser = async (userData: UserFormData) => {
    if (!userId) return

    try {
      setSaving(true)
      setError(null)

      // Remove undefined/empty password fields
      const updateData = { ...userData }
      if (!updateData.password) {
        delete updateData.password
        delete updateData.confirmPassword
      }

      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update user')
      }

      // Redirect to users list on success
      router.push('/admin/users?success=User updated successfully')
    } catch (err: any) {
      setError(err.message || 'Failed to update user')
      throw err
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-6 max-w-2xl">
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>Loading user data...</span>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error && !user) {
    return (
      <div className="container mx-auto py-6 max-w-2xl">
        <Link href="/admin/users">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Users
          </Button>
        </Link>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
            <Link href="/admin/users">
              <Button className="mt-4">
                Return to Users List
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 max-w-2xl">
      {/* Header with back button */}
      <div className="mb-6">
        <Link href="/admin/users">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Users
          </Button>
        </Link>
        
        <h1 className="text-2xl font-bold text-gray-900">Edit User</h1>
        <p className="text-gray-600 mt-1">
          Update user information and permissions
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* User Form */}
      {user && (
        <UserForm 
          user={user}
          onSubmit={handleUpdateUser}
          loading={saving}
          mode="edit"
        />
      )}
    </div>
  )
}

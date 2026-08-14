'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import UserForm from '@/components/admin/users/UserForm'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

type UserFormData = {
  email: string
  name: string
  password?: string
  confirmPassword?: string
  isAdmin: boolean
}

export default function NewUserPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreateUser = async (userData: UserFormData) => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create user')
      }

      // Redirect to users list on success
      router.push('/admin/users?success=User created successfully')
    } catch (err: any) {
      setError(err.message || 'Failed to create user')
      throw err
    } finally {
      setLoading(false)
    }
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
        
        <h1 className="text-2xl font-bold text-gray-900">Create New Admin User</h1>
        <p className="text-gray-600 mt-1">
          Add a new administrator to manage the system
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* User Form */}
      <UserForm 
        onSubmit={handleCreateUser}
        loading={loading}
        mode="create"
      />
    </div>
  )
}

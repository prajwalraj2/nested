'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Eye, EyeOff, Loader2, User, Mail, Lock } from 'lucide-react'

// Validation schema
const userFormSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(1, 'Name is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
  isAdmin: z.boolean().default(true)
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

// For edit mode, make password optional
const editUserFormSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(1, 'Name is required'),
  password: z.string().optional(),
  confirmPassword: z.string().optional(),
  isAdmin: z.boolean().default(true)
}).refine((data: any) => {
  if (data.password && data.confirmPassword) {
    return data.password === data.confirmPassword
  }
  return true
}, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

type UserFormData = z.infer<typeof userFormSchema>
type EditUserFormData = z.infer<typeof editUserFormSchema>

interface User {
  id: string
  email: string
  name: string | null
  isAdmin: boolean
  isActive: boolean
}

interface UserFormProps {
  user?: User | null // For edit mode
  onSubmit: (data: UserFormData | EditUserFormData) => Promise<void>
  loading?: boolean
  mode?: 'create' | 'edit'
}

export default function UserForm({ 
  user = null, 
  onSubmit, 
  loading = false,
  mode = 'create'
}: UserFormProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const isEditMode = mode === 'edit' && user

  const form = useForm({
    resolver: zodResolver(isEditMode ? editUserFormSchema : userFormSchema),
    defaultValues: {
      email: user?.email || '',
      name: user?.name || '',
      password: '',
      confirmPassword: '',
      isAdmin: user?.isAdmin ?? true
    }
  })

  const handleSubmit = async (data: any) => {
    try {
      setSubmitError(null)
      
      // Remove empty password fields for edit mode
      if (isEditMode) {
        const editData = { ...data }
        if (!editData.password) {
          delete editData.password
          delete editData.confirmPassword
        }
        await onSubmit(editData)
      } else {
        await onSubmit(data as UserFormData)
      }
    } catch (error: any) {
      setSubmitError(error.message || 'Failed to save user')
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <User className="h-5 w-5" />
          <span>{isEditMode ? 'Edit User' : 'Create New Admin User'}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(handleSubmit as any)} className="space-y-4">
          {submitError && (
            <Alert variant="destructive">
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          )}

          {/* Email Field */}
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                className="pl-10"
                disabled={loading}
                {...form.register('email')}
              />
            </div>
            {form.formState.errors.email && (
              <p className="text-sm text-red-500">{form.formState.errors.email.message}</p>
            )}
          </div>

          {/* Name Field */}
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                className="pl-10"
                disabled={loading}
                {...form.register('name')}
              />
            </div>
            {form.formState.errors.name && (
              <p className="text-sm text-red-500">{form.formState.errors.name.message}</p>
            )}
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <Label htmlFor="password">
              Password {isEditMode && <span className="text-gray-500">(leave blank to keep current)</span>}
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder={isEditMode ? "Enter new password (optional)" : "Enter password"}
                className="pl-10 pr-10"
                disabled={loading}
                {...form.register('password')}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
                disabled={loading}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            {form.formState.errors.password && (
              <p className="text-sm text-red-500">{form.formState.errors.password.message}</p>
            )}
          </div>

          {/* Confirm Password Field */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">
              Confirm Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm password"
                className="pl-10 pr-10"
                disabled={loading}
                {...form.register('confirmPassword')}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={loading}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            {form.formState.errors.confirmPassword && (
              <p className="text-sm text-red-500">{form.formState.errors.confirmPassword.message}</p>
            )}
          </div>

          {/* Admin Checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="isAdmin"
              checked={form.watch('isAdmin')}
              onCheckedChange={(checked) => form.setValue('isAdmin', !!checked)}
              disabled={loading}
            />
            <Label htmlFor="isAdmin" className="text-sm font-medium">
              Admin privileges
            </Label>
          </div>
          <p className="text-xs text-gray-500 ml-6">
            Admin users can access the admin panel and manage other users
          </p>

          {/* Submit Button */}
          <Button 
            type="submit" 
            className="w-full" 
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isEditMode ? 'Updating...' : 'Creating...'}
              </>
            ) : (
              isEditMode ? 'Update User' : 'Create User'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

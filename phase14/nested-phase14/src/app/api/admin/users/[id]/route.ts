import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PasswordUtils } from '@/lib/password'
import { z } from 'zod'

// Validation schemas
const updateUserSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).optional(),
  password: z.string().min(8).optional(),
  isAdmin: z.boolean().optional(),
  isActive: z.boolean().optional()
})

interface PageParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/admin/users/[id]
 * Get single user details
 */
export async function GET(
  request: NextRequest,
  { params }: PageParams
) {
  try {
    // Check admin authentication
    const session = await auth()
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { id } = await params

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        isAdmin: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        createdBy: true,
        createdByUser: {
          select: {
            name: true,
            email: true
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ user })

  } catch (error) {
    console.error('Error fetching user:', error)
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/users/[id]
 * Update user details
 */
export async function PUT(
  request: NextRequest,
  { params }: PageParams
) {
  try {
    // Check admin authentication
    const session = await auth()
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const updates = updateUserSchema.parse(body)

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id }
    })

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Prevent users from deactivating themselves
    if (session.user.id === id && updates.isActive === false) {
      return NextResponse.json(
        { error: 'You cannot deactivate your own account' },
        { status: 400 }
      )
    }

    // Prevent users from removing their own admin status
    if (session.user.id === id && updates.isAdmin === false) {
      return NextResponse.json(
        { error: 'You cannot remove your own admin privileges' },
        { status: 400 }
      )
    }

    // Check email uniqueness if email is being updated
    if (updates.email && updates.email !== existingUser.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email: updates.email.toLowerCase() }
      })

      if (emailExists) {
        return NextResponse.json(
          { error: 'User with this email already exists' },
          { status: 409 }
        )
      }
    }

    // Prepare update data
    const updateData: any = { ...updates }

    // Hash password if provided
    if (updates.password) {
      const passwordValidation = PasswordUtils.validatePassword(updates.password)
      if (!passwordValidation.isValid) {
        return NextResponse.json(
          { error: 'Password validation failed', details: passwordValidation.errors },
          { status: 400 }
        )
      }
      updateData.password = await PasswordUtils.hash(updates.password)
    }

    // Lowercase email if provided
    if (updates.email) {
      updateData.email = updates.email.toLowerCase()
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        isAdmin: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        createdBy: true
      }
    })

    return NextResponse.json({
      message: 'User updated successfully',
      user: updatedUser
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('Error updating user:', error)
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/users/[id]
 * Deactivate or delete user
 */
export async function DELETE(
  request: NextRequest,
  { params }: PageParams
) {
  try {
    // Check admin authentication
    const session = await auth()
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { id } = await params
    const url = new URL(request.url)
    const hardDelete = url.searchParams.get('hard') === 'true'

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id }
    })

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Prevent users from deleting themselves
    if (session.user.id === id) {
      return NextResponse.json(
        { error: 'You cannot delete your own account' },
        { status: 400 }
      )
    }

    if (hardDelete) {
      // Hard delete (permanent)
      await prisma.user.delete({
        where: { id }
      })

      return NextResponse.json({
        message: 'User permanently deleted'
      })
    } else {
      // Soft delete (deactivate)
      const deactivatedUser = await prisma.user.update({
        where: { id },
        data: { isActive: false },
        select: {
          id: true,
          email: true,
          name: true,
          isAdmin: true,
          isActive: true
        }
      })

      return NextResponse.json({
        message: 'User deactivated successfully',
        user: deactivatedUser
      })
    }

  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    )
  }
}

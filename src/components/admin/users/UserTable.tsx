'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { 
  MoreHorizontal, 
  Search, 
  Edit2, 
  UserX, 
  Trash2,
  UserCheck,
  Mail,
  Calendar
} from 'lucide-react'

interface User {
  id: string
  email: string
  name: string | null
  isAdmin: boolean
  isActive: boolean
  createdAt: string | Date
  updatedAt: string | Date
  lastLoginAt: string | Date | null
  createdBy: string | null
  createdByUser?: {
    name: string | null
    email: string
  } | null
}

interface UserTableProps {
  users: User[]
  loading?: boolean
  searchTerm: string
  onSearchChange: (term: string) => void
  onEditUser: (user: User) => void
  onDeleteUser: (user: User) => void
  onToggleUserStatus: (user: User) => void
  currentUserId?: string
}

export default function UserTable({
  users,
  loading = false,
  searchTerm,
  onSearchChange,
  onEditUser,
  onDeleteUser,
  onToggleUserStatus,
  currentUserId
}: UserTableProps) {
  
  /**
   * Dates are formatted with an explicit locale AND time zone.
   *
   * ⚠️ THIS IS PRE-EMPTIVE, NOT A BUG FIX — a correction to my own earlier claim.
   * ==========================================================================
   * I first wrote this up as the cause of a hydration-mismatch badge the user saw on
   * `/admin/users`, reasoning from the pattern that bit `TablesManager`: a client component
   * formatting dates renders them twice, and `date-fns`'s `format()` — while immune to the
   * *locale* problem, since its pattern is fixed — renders in the runtime's **local time
   * zone**, so server (UTC) and browser (IST) would disagree by 5:30 on every timestamp.
   *
   * **That reasoning does not apply here.** `UserManager` fetches the user list in a
   * `useEffect`, so these rows **never exist in the server-rendered HTML** — there is no first
   * render for the second one to disagree with. Verified: no formatted date appears in the
   * server HTML for this page at all. So this was never the badge's cause, and the badge's
   * actual cause is still unknown.
   *
   * The pinning is kept anyway, because it is correct on its own terms: it makes the output
   * deterministic, and it removes a **latent** hazard — the moment this list is server-rendered
   * (which is the natural fix for its client-side fetch) the mismatch would appear for real.
   *
   * ⚠️ The generalisable lesson stands even though the diagnosis did not: my earlier sweep
   * grepped for `toLocaleDateString` / `toLocaleString` and `date-fns` never appears in that
   * grep. **The hazard is "formatting a date in a component that renders on both sides", not
   * "calling a particular API".**
   *
   * `Intl` rather than `date-fns-tz`, which is not installed — not worth a dependency when
   * `Intl.DateTimeFormat` takes `timeZone` directly. `en-US` keeps the existing
   * "Jul 26, 2026" look; a month *name* is unambiguous in any locale.
   */
  const formatDate = (date: string | Date | null) => {
    if (!date) return 'Never'
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      timeZone: 'UTC',
    })
  }

  const formatDateTime = (date: string | Date | null) => {
    if (!date) return 'Never'

    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'UTC',
    })
  }

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder="Search users by name or email..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Users Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role & Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead>Created By</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-current"></div>
                    <span className="ml-2">Loading users...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  {searchTerm ? 'No users found matching your search.' : 'No users found.'}
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id} className={!user.isActive ? 'opacity-50' : ''}>
                  {/* User Info */}
                  <TableCell>
                    <div className="flex flex-col">
                      <div className="flex items-center space-x-2">
                        <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-full text-sm font-medium">
                          {user.name?.charAt(0)?.toUpperCase() || user.email.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {user.name || 'No Name'}
                            {user.id === currentUserId && (
                              <Badge variant="outline" className="ml-2 text-xs">
                                You
                              </Badge>
                            )}
                          </p>
                          <p className="text-muted-foreground flex items-center text-xs">
                            <Mail className="w-3 h-3 mr-1" />
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </div>
                  </TableCell>

                  {/* Role & Status */}
                  <TableCell>
                    <div className="flex flex-col space-y-1">
                      <Badge variant={user.isAdmin ? 'default' : 'secondary'} className="w-fit">
                        {user.isAdmin ? 'Admin' : 'User'}
                      </Badge>
                      <Badge 
                        variant={user.isActive ? 'default' : 'destructive'} 
                        className="w-fit"
                      >
                        {user.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </TableCell>

                  {/* Created Date */}
                  <TableCell>
                    <div className="text-muted-foreground flex items-center text-sm">
                      <Calendar className="w-3 h-3 mr-1" />
                      {formatDate(user.createdAt)}
                    </div>
                  </TableCell>

                  {/* Last Login */}
                  <TableCell>
                    <div className="text-muted-foreground text-sm">
                      {formatDateTime(user.lastLoginAt)}
                    </div>
                  </TableCell>

                  {/* Created By */}
                  <TableCell>
                    <div className="text-muted-foreground text-sm">
                      {user.createdByUser?.name || user.createdByUser?.email || 'System'}
                    </div>
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEditUser(user)}>
                          <Edit2 className="mr-2 h-4 w-4" />
                          Edit User
                        </DropdownMenuItem>
                        
                        {user.id !== currentUserId && (
                          <>
                            <DropdownMenuItem 
                              onClick={() => onToggleUserStatus(user)}
                            >
                              {user.isActive ? (
                                <>
                                  <UserX className="mr-2 h-4 w-4" />
                                  Deactivate
                                </>
                              ) : (
                                <>
                                  <UserCheck className="mr-2 h-4 w-4" />
                                  Activate
                                </>
                              )}
                            </DropdownMenuItem>
                            
                            <DropdownMenuItem 
                              onClick={() => onDeleteUser(user)}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete User
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

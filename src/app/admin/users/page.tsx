import { Suspense } from 'react'
import UserManager from '@/components/admin/users/UserManager'

export default function AdminUsersPage() {
  return (
    <>
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-current"></div>
          <span className="ml-2">Loading user management...</span>
        </div>
      }>
        <UserManager />
      </Suspense>
    </>
  )
}

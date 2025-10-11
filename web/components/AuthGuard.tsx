'use client'

import { ReactNode } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { LoginPage } from '@/components/LoginPage'

interface AuthGuardProps {
  children: ReactNode
}

export const AuthGuard = ({ children }: AuthGuardProps) => {
  const { user, loading, signInWithGoogle } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="relative">
          <div className="animate-spin rounded-full h-20 w-20 border-4 border-blue-200/30"></div>
          <div className="animate-spin rounded-full h-20 w-20 border-t-4 border-blue-500 absolute top-0 left-0"></div>
        </div>
      </div>
    )
  }

  if (!user) {
    return <LoginPage onSignIn={signInWithGoogle} />
  }

  return <>{children}</>
}


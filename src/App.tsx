import { useState } from 'react'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { BottomNav } from './components/BottomNav'
import { ConfigureSupabaseGate, LoginGate } from './components/LoginGate'
import { Dashboard } from './pages/Dashboard'
import { IncomePage } from './pages/Income'
import { ExpensesPage } from './pages/Expenses'
import { ReceiptsPage } from './pages/Receipts'
import { ReportsPage } from './pages/Reports'
import { SettingsPage } from './pages/Settings'
import type { TabId } from './types'

function LoadingScreen({ message = 'Loading…' }: { message?: string }) {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-slate-950 gap-4">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      <p className="text-sm text-slate-400">{message}</p>
    </div>
  )
}

function AppShell() {
  const { configured, user, loading, dataReady, sessionError } = useAuth()
  const [tab, setTab] = useState<TabId>('dashboard')

  if (loading) {
    return <LoadingScreen message="Checking sign-in…" />
  }

  if (!configured) {
    return <ConfigureSupabaseGate />
  }

  if (!user) {
    return <LoginGate />
  }

  if (!dataReady) {
    return <LoadingScreen message="Loading your books…" />
  }

  return (
    <div className="min-h-dvh bg-slate-950">
      {sessionError && (
        <div className="mx-auto max-w-lg px-4 pt-4">
          <div className="rounded-xl border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
            {sessionError}
          </div>
        </div>
      )}
      <div className="mx-auto max-w-lg min-h-dvh pb-20">
        <div className="bg-gradient-to-b from-brand-900/30 via-slate-950 to-slate-950 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-6">
          {tab === 'dashboard' && <Dashboard />}
          {tab === 'income' && <IncomePage />}
          {tab === 'expenses' && <ExpensesPage />}
          {tab === 'receipts' && <ReceiptsPage />}
          {tab === 'reports' && <ReportsPage />}
          {tab === 'settings' && <SettingsPage />}
        </div>
      </div>
      <BottomNav active={tab} onChange={setTab} />
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  )
}

export default App

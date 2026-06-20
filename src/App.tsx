import { useEffect, useState } from 'react'
import { AuthProvider } from './hooks/useAuth'
import { BottomNav } from './components/BottomNav'
import { Dashboard } from './pages/Dashboard'
import { IncomePage } from './pages/Income'
import { ExpensesPage } from './pages/Expenses'
import { ReceiptsPage } from './pages/Receipts'
import { ReportsPage } from './pages/Reports'
import { SettingsPage } from './pages/Settings'
import { seedDatabase } from './db/database'
import { initializeBusinessData } from './lib/seedBusinessData'
import type { TabId } from './types'

function AppShell() {
  const [tab, setTab] = useState<TabId>('dashboard')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    seedDatabase()
      .then(() => initializeBusinessData())
      .then(() => setReady(true))
  }, [])

  if (!ready) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center bg-slate-950 gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
        <p className="text-sm text-slate-400">Loading Junk Of Urs…</p>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-slate-950">
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

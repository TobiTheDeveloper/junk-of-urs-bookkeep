import {
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  Receipt,
  BarChart3,
  Settings,
} from 'lucide-react'
import type { TabId } from '../types'

interface BottomNavProps {
  active: TabId
  onChange: (tab: TabId) => void
}

const tabs: { id: TabId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { id: 'income', label: 'Income', icon: TrendingUp },
  { id: 'expenses', label: 'Expenses', icon: TrendingDown },
  { id: 'receipts', label: 'Receipts', icon: Receipt },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t border-slate-800 bg-slate-950/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-stretch justify-around max-w-lg mx-auto">
        {tabs.map(({ id, label, icon: Icon }) => {
          const isActive = active === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 px-1 transition-colors ${
                isActive ? 'text-brand-400' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

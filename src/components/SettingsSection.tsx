import type { LucideIcon } from 'lucide-react'

interface SettingsSectionProps {
  icon: LucideIcon
  title: string
  description?: string
  children: React.ReactNode
  variant?: 'default' | 'accent' | 'muted'
}

const variants = {
  default: 'border-slate-800 bg-slate-900/50',
  accent: 'border-brand-900/40 bg-brand-950/15',
  muted: 'border-slate-800/80 bg-slate-900/30',
}

export function SettingsSection({
  icon: Icon,
  title,
  description,
  children,
  variant = 'default',
}: SettingsSectionProps) {
  return (
    <section className={`rounded-2xl border overflow-hidden ${variants[variant]}`}>
      <div className="flex items-start gap-3 px-4 pt-4 pb-3 border-b border-slate-800/60">
        <div className="shrink-0 p-2 rounded-xl bg-slate-800/80 text-brand-400">
          <Icon size={18} />
        </div>
        <div className="min-w-0 pt-0.5">
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          {description && <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{description}</p>}
        </div>
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

interface SettingsActionProps {
  icon: LucideIcon
  label: string
  hint?: string
  onClick: () => void
  disabled?: boolean
}

export function SettingsAction({ icon: Icon, label, hint, onClick, disabled }: SettingsActionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-start gap-3 w-full text-left rounded-xl border border-slate-700/80 bg-slate-800/40 hover:bg-slate-800 hover:border-slate-600 px-3.5 py-3 transition-colors disabled:opacity-50"
    >
      <div className="shrink-0 p-2 rounded-lg bg-slate-900/80 text-slate-300">
        <Icon size={16} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-200">{label}</p>
        {hint && <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{hint}</p>}
      </div>
    </button>
  )
}

export function SettingsStatPill({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string
  tone?: 'default' | 'brand' | 'amber'
}) {
  const tones = {
    default: 'border-slate-700 bg-slate-800/50 text-white',
    brand: 'border-brand-800/50 bg-brand-950/30 text-brand-200',
    amber: 'border-amber-900/40 bg-amber-950/20 text-amber-200',
  }
  return (
    <div className={`rounded-xl border px-3 py-2.5 text-center ${tones[tone]}`}>
      <p className="text-[10px] uppercase tracking-wide text-slate-500 font-medium">{label}</p>
      <p className="text-sm font-bold mt-0.5 truncate">{value}</p>
    </div>
  )
}

export function SettingsToggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description?: string
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-slate-800 bg-slate-800/30 px-3.5 py-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-slate-800 text-brand-500 focus:ring-brand-500"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-slate-200">{label}</span>
        {description && <span className="block text-xs text-slate-500 mt-0.5">{description}</span>}
      </span>
    </label>
  )
}

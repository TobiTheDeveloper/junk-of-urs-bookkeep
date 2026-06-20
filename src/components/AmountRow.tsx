import type { ReactNode } from 'react'

interface AmountRowProps {
  label: ReactNode
  amount: string
  amountClassName?: string
}

export function AmountRow({ label, amount, amountClassName = 'text-white' }: AmountRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div className="min-w-0 flex-1">{label}</div>
      <span
        className={`shrink-0 text-base font-bold tabular-nums sm:text-sm ${amountClassName}`}
      >
        {amount}
      </span>
    </div>
  )
}

import { formatCurrency } from '../lib/format'
import { formatPercent } from '../lib/taxEngine'
import type { HstBreakdown, TaxBreakdown } from '../lib/taxEngine'

function Line({
  label,
  value,
  currency,
  hint,
  bold,
  color,
}: {
  label: string
  value: number
  currency: string
  hint?: string
  bold?: boolean
  color?: string
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className={`text-sm ${bold ? 'font-semibold text-slate-200' : 'text-slate-400'}`}>
          {label}
        </p>
        {hint && <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{hint}</p>}
      </div>
      <span
        className={`shrink-0 tabular-nums ${bold ? 'font-bold text-base' : 'font-semibold text-sm'} ${color ?? 'text-white'}`}
      >
        {formatCurrency(value, currency)}
      </span>
    </div>
  )
}

export function TaxBreakdownPanel({
  tax,
  hst,
  currency,
  compact = false,
}: {
  tax: TaxBreakdown
  hst?: HstBreakdown
  currency: string
  compact?: boolean
}) {
  return (
    <div className="space-y-3">
      <Line
        label="Business profit"
        value={tax.netProfit}
        currency={currency}
        hint="Income minus deductible expenses (meals at 50%)"
      />
      {tax.otherIncome > 0 && (
        <Line
          label="Other income (T4)"
          value={tax.otherIncome}
          currency={currency}
          hint="Entered in Settings — used so tax brackets are right"
        />
      )}
      <Line
        label="CPP (you pay both halves)"
        value={tax.cpp.total}
        currency={currency}
        hint={`Base ${formatCurrency(tax.cpp.cpp1, currency)}${tax.cpp.cpp2 ? ` + CPP2 ${formatCurrency(tax.cpp.cpp2, currency)}` : ''}. About half of base CPP is deducted from income; the rest is a tax credit.`}
        color="text-amber-300"
      />
      <Line
        label="Taxable income"
        value={tax.taxableIncome}
        currency={currency}
        hint="Profit + other income − CPP deduction"
      />

      {!compact && (
        <>
          <div className="border-t border-slate-800 pt-3 space-y-3">
            <Line label="Federal income tax" value={tax.federalTax} currency={currency} />
            <Line
              label="Ontario income tax"
              value={tax.ontarioTax}
              currency={currency}
              hint={
                tax.ontarioSurtax > 0
                  ? `Includes Ontario surtax of ${formatCurrency(tax.ontarioSurtax, currency)}`
                  : undefined
              }
            />
            <Line
              label="Ontario Health Premium"
              value={tax.ontarioHealthPremium}
              currency={currency}
              hint="Paid with your tax return when taxable income is over $20,000"
            />
          </div>
        </>
      )}

      <div className="rounded-xl bg-amber-950/40 border border-amber-900/40 px-3 py-2.5 space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-amber-100">Set aside for income tax + CPP</span>
          <span className="text-base font-bold text-amber-300 tabular-nums">
            {formatCurrency(tax.totalTaxReserve, currency)}
          </span>
        </div>
        <p className="text-[11px] text-amber-100/70">
          {formatPercent(tax.effectiveRate)} of business profit
          {tax.netProfit > 0
            ? ` · next dollar taxed at about ${formatPercent(tax.marginalCombinedRate)} (income tax only)`
            : ''}
        </p>
      </div>

      {hst?.registered && (
        <div className="rounded-xl bg-sky-950/40 border border-sky-900/40 px-3 py-2.5 space-y-2">
          <p className="text-xs font-semibold text-sky-200">HST (13%) — separate from income tax</p>
          <Line label="HST collected on sales" value={hst.collected} currency={currency} />
          <Line label="HST paid on expenses (ITCs)" value={hst.inputTaxCredits} currency={currency} />
          <Line
            label="HST to remit"
            value={hst.netHstOwing}
            currency={currency}
            bold
            color={hst.netHstOwing >= 0 ? 'text-sky-300' : 'text-emerald-400'}
          />
        </div>
      )}

      {hst && !hst.registered && hst.approachingThreshold && (
        <p className="text-[11px] text-amber-200/80 leading-relaxed">
          {hst.overThreshold
            ? `Trailing 12-month sales (${formatCurrency(hst.trailingRevenue, currency)}) are over the $30,000 HST small-supplier limit. Register for HST with the CRA, then turn on HST in Settings.`
            : `Trailing 12-month sales (${formatCurrency(hst.trailingRevenue, currency)}) are approaching the $30,000 HST registration threshold.`}
        </p>
      )}
    </div>
  )
}

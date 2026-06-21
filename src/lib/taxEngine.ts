/**
 * Ontario sole proprietorship — tax reserve for planning.
 *
 * A sole prop has no separate business tax rate: profit is personal income.
 * Reserve = net profit × planning rate (covers income tax + CPP set-aside).
 *
 * 2026 reference brackets (not used for reserve math):
 *   Federal: 14% to $58,523, 20.5% to $117,045
 *   Ontario: 5.05% to $53,891, 9.15% to $107,785
 *   Combined marginal ≈ 19%–25% on net profit, plus CPP (both portions).
 */

export interface TaxBreakdown {
  netProfit: number
  /** Planning rate applied to net profit (0.25, 0.29, or 0.30) */
  planningRate: number
  planningTierLabel: string
  totalTaxReserve: number
  effectiveRate: number
  /** Estimated CPP (Schedule 8) — for reference; included in planning rate, not added on top */
  cppReference: number
  /** Combined federal + Ontario marginal at this profit — reference only */
  marginalCombinedReference: number
}

export const PLANNING_THRESHOLDS = {
  mid: 60_000,
  high: 100_000,
} as const

export const PLANNING_RATES = {
  /** Under $60k net profit */
  standard: 0.25,
  /** $60k–$100k net profit */
  mid: 0.29,
  /** Over $100k net profit */
  high: 0.3,
} as const

/** CRA 2026 marginal brackets — reference display only */
export const REFERENCE_BRACKETS_2026 = {
  federal: [
    { upTo: 58_523, rate: 0.14, label: '14% on first $58,523' },
    { upTo: 117_045, rate: 0.205, label: '20.5% up to $117,045' },
  ],
  ontario: [
    { upTo: 53_891, rate: 0.0505, label: '5.05% on first $53,891' },
    { upTo: 107_785, rate: 0.0915, label: '9.15% on next bracket' },
  ],
} as const

export function getPlanningTaxRate(netProfit: number): number {
  if (netProfit < PLANNING_THRESHOLDS.mid) return PLANNING_RATES.standard
  if (netProfit < PLANNING_THRESHOLDS.high) return PLANNING_RATES.mid
  return PLANNING_RATES.high
}

export function getPlanningTierLabel(netProfit: number): string {
  if (netProfit < PLANNING_THRESHOLDS.mid) {
    return 'Under $60k net profit — 25% reserve is usually safe'
  }
  if (netProfit < PLANNING_THRESHOLDS.high) {
    return '$60k–$100k net profit — 29% reserve (increase toward 28–30%)'
  }
  return 'Over $100k net profit — 30% reserve; consider incorporation'
}

/** Schedule 8 CPP reference — not added to reserve (planning rate already covers it). */
export function estimateCppReference(netSelfEmploymentIncome: number): number {
  if (netSelfEmploymentIncome <= 0) return 0

  const basicExemption = 3_500
  const ympe = 74_600
  const yampe = 85_000

  const cpp1Base = Math.max(0, Math.min(netSelfEmploymentIncome, ympe) - basicExemption)
  const cpp1 = Math.min(cpp1Base * 0.119, 8_460.9)

  const cpp2Base = Math.max(0, Math.min(netSelfEmploymentIncome, yampe) - ympe)
  const cpp2 = Math.min(cpp2Base * 0.08, 832)

  return cpp1 + cpp2
}

function referenceMarginalCombined(netProfit: number): number {
  if (netProfit <= 0) return 0.1905 // 14% + 5.05% at lowest brackets
  const federal =
    netProfit <= 58_523 ? 0.14 : netProfit <= 117_045 ? 0.205 : 0.26
  const ontario =
    netProfit <= 53_891 ? 0.0505 : netProfit <= 107_785 ? 0.0915 : 0.1116
  return federal + ontario
}

/**
 * Tax reserve for planning: net profit × tiered rate.
 * Example: $2,563 profit × 25% = $640.75
 */
export function calculateOntarioSolePropTax(netProfit: number): TaxBreakdown {
  const safeNet = Math.max(0, netProfit)
  const planningRate = getPlanningTaxRate(safeNet)
  const totalTaxReserve = safeNet * planningRate

  return {
    netProfit: safeNet,
    planningRate,
    planningTierLabel: getPlanningTierLabel(safeNet),
    totalTaxReserve,
    effectiveRate: planningRate,
    cppReference: estimateCppReference(safeNet),
    marginalCombinedReference: referenceMarginalCombined(safeNet),
  }
}

export function getSolePropTaxExplanation(): string {
  return (
    'Sole proprietorship profit is taxed as personal income (Revenue − Expenses = Profit). ' +
    'For planning: set aside net profit × 25% under $60k, × 29% for $60k–$100k, × 30% over $100k. ' +
    'That reserve covers federal + Ontario income tax and CPP (you pay both employee and employer portions). ' +
    '2026 reference: federal 14% on first $58,523, Ontario 5.05% on first $53,891 — combined roughly 19%–25% on net profit before CPP. ' +
    'HST (13%) is separate if you register at $30k revenue. Not tax advice.'
  )
}

/** @deprecated use getSolePropTaxExplanation */
export function getOntarioTaxEngineExplanation(): string {
  return getSolePropTaxExplanation()
}

export function formatPlanningRate(rate: number): string {
  return `${(rate * 100).toFixed(0)}%`
}

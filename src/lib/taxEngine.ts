/**
 * Ontario sole proprietorship tax estimates — CRA 2026 figures.
 * Sources: canada.ca tax rates, CPP contribution tables, T4032-ON payroll guide.
 * Estimates only; excludes HST/GST, RRSP, other credits, and Ontario surtax above ~$93k taxable.
 */

export interface TaxBracket {
  upTo: number
  rate: number
}

export interface TaxBreakdown {
  netProfit: number
  cpp1: number
  cpp2: number
  cppContributions: number
  cppDeduction: number
  taxableIncome: number
  federalIncomeTax: number
  ontarioIncomeTax: number
  ontarioHealthPremium: number
  incomeTax: number
  totalTaxReserve: number
  effectiveRate: number
  marginalCombinedRate: number
}

/** CRA 2026 — indexed brackets and credits */
export const CRA_2026 = {
  federal: {
    brackets: [
      { upTo: 58_523, rate: 0.14 },
      { upTo: 117_045, rate: 0.205 },
      { upTo: 181_440, rate: 0.26 },
      { upTo: 258_482, rate: 0.29 },
      { upTo: Infinity, rate: 0.33 },
    ] satisfies TaxBracket[],
    maxBasicPersonalAmount: 16_452,
    minBasicPersonalAmount: 14_829,
    bpaPhaseOutStart: 181_440,
    bpaPhaseOutEnd: 258_482,
    lowestRate: 0.14,
  },
  ontario: {
    brackets: [
      { upTo: 53_891, rate: 0.0505 },
      { upTo: 107_785, rate: 0.0915 },
      { upTo: 150_000, rate: 0.1116 },
      { upTo: 220_000, rate: 0.1216 },
      { upTo: Infinity, rate: 0.1316 },
    ] satisfies TaxBracket[],
    basicPersonalAmount: 12_989,
    lowestRate: 0.0505,
  },
  cpp: {
    basicExemption: 3_500,
    ympe: 74_600,
    yampe: 85_000,
    cpp1RateSelfEmployed: 0.119,
    cpp2RateSelfEmployed: 0.08,
    maxCpp1: 8_460.9,
    maxCpp2: 832,
  },
} as const

export function calculateMarginalTax(taxableIncome: number, brackets: TaxBracket[]): number {
  if (taxableIncome <= 0) return 0

  let tax = 0
  let previousCeiling = 0

  for (const bracket of brackets) {
    const taxableInBracket = Math.min(taxableIncome, bracket.upTo) - previousCeiling
    if (taxableInBracket <= 0) break
    tax += taxableInBracket * bracket.rate
    previousCeiling = bracket.upTo
    if (taxableIncome <= bracket.upTo) break
  }

  return tax
}

export function federalBasicPersonalAmount(taxableIncome: number): number {
  const { maxBasicPersonalAmount, minBasicPersonalAmount, bpaPhaseOutStart, bpaPhaseOutEnd } =
    CRA_2026.federal

  if (taxableIncome <= bpaPhaseOutStart) return maxBasicPersonalAmount
  if (taxableIncome >= bpaPhaseOutEnd) return minBasicPersonalAmount

  const phaseRange = bpaPhaseOutEnd - bpaPhaseOutStart
  const reduction =
    ((taxableIncome - bpaPhaseOutStart) / phaseRange) *
    (maxBasicPersonalAmount - minBasicPersonalAmount)
  return maxBasicPersonalAmount - reduction
}

/** Schedule 8 — self-employed CPP1 + CPP2 (both employer and employee portions). */
export function calculateSelfEmployedCpp(netSelfEmploymentIncome: number): {
  cpp1: number
  cpp2: number
  total: number
  deductibleEmployerShare: number
} {
  if (netSelfEmploymentIncome <= 0) {
    return { cpp1: 0, cpp2: 0, total: 0, deductibleEmployerShare: 0 }
  }

  const { basicExemption, ympe, yampe, cpp1RateSelfEmployed, cpp2RateSelfEmployed, maxCpp1, maxCpp2 } =
    CRA_2026.cpp

  const cpp1Base = Math.max(0, Math.min(netSelfEmploymentIncome, ympe) - basicExemption)
  const cpp1 = Math.min(cpp1Base * cpp1RateSelfEmployed, maxCpp1)

  const cpp2Base = Math.max(0, Math.min(netSelfEmploymentIncome, yampe) - ympe)
  const cpp2 = Math.min(cpp2Base * cpp2RateSelfEmployed, maxCpp2)

  const total = cpp1 + cpp2
  return { cpp1, cpp2, total, deductibleEmployerShare: total / 2 }
}

/** Ontario Health Premium — 2026 tiers on taxable income. */
export function calculateOntarioHealthPremium(taxableIncome: number): number {
  if (taxableIncome <= 20_000) return 0
  if (taxableIncome <= 36_000) return 300
  if (taxableIncome <= 48_000) return 450
  if (taxableIncome <= 72_000) return 600
  if (taxableIncome <= 200_000) return 750
  return 900
}

export function combinedMarginalRate(taxableIncome: number): number {
  const federal = marginalRateForBrackets(taxableIncome, CRA_2026.federal.brackets)
  const ontario = marginalRateForBrackets(taxableIncome, CRA_2026.ontario.brackets)
  return federal + ontario
}

function marginalRateForBrackets(income: number, brackets: TaxBracket[]): number {
  for (const bracket of brackets) {
    if (income <= bracket.upTo) return bracket.rate
  }
  return brackets[brackets.length - 1]?.rate ?? 0
}

/**
 * Estimate total tax set-aside for an Ontario sole proprietor with only business income.
 * netProfit = gross business income minus tax-deductible expenses (meals at 50%, etc.).
 */
export function calculateOntarioSolePropTax(netProfit: number): TaxBreakdown {
  const safeNet = Math.max(0, netProfit)
  const cpp = calculateSelfEmployedCpp(safeNet)
  const taxableIncome = Math.max(0, safeNet - cpp.deductibleEmployerShare)

  const federalBeforeCredits = calculateMarginalTax(taxableIncome, CRA_2026.federal.brackets)
  const ontarioBeforeCredits = calculateMarginalTax(taxableIncome, CRA_2026.ontario.brackets)

  const federalBpa = federalBasicPersonalAmount(taxableIncome)
  const federalCredit = federalBpa * CRA_2026.federal.lowestRate
  const ontarioCredit = CRA_2026.ontario.basicPersonalAmount * CRA_2026.ontario.lowestRate

  const federalIncomeTax = Math.max(0, federalBeforeCredits - federalCredit)
  const ontarioIncomeTax = Math.max(0, ontarioBeforeCredits - ontarioCredit)
  const ontarioHealthPremium = calculateOntarioHealthPremium(taxableIncome)

  const incomeTax = federalIncomeTax + ontarioIncomeTax + ontarioHealthPremium
  const totalTaxReserve = incomeTax + cpp.total

  return {
    netProfit: safeNet,
    cpp1: cpp.cpp1,
    cpp2: cpp.cpp2,
    cppContributions: cpp.total,
    cppDeduction: cpp.deductibleEmployerShare,
    taxableIncome,
    federalIncomeTax,
    ontarioIncomeTax,
    ontarioHealthPremium,
    incomeTax,
    totalTaxReserve,
    effectiveRate: safeNet > 0 ? totalTaxReserve / safeNet : 0,
    marginalCombinedRate: combinedMarginalRate(taxableIncome),
  }
}

export function formatEffectiveRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`
}

export function getOntarioTaxEngineExplanation(): string {
  return (
    'CRA 2026 estimate: federal brackets (14%–33%) plus Ontario brackets (5.05%–13.16%), ' +
    'basic personal amount credits ($16,452 federal / $12,989 Ontario), CPP at 11.9% up to $74,600 ' +
    'and 8% on $74,600–$85,000 (Schedule 8), and Ontario Health Premium when taxable income exceeds $20,000. ' +
    'HST (13%) is separate if you register at $30,000 revenue. Not tax advice — confirm with CRA or an accountant.'
  )
}

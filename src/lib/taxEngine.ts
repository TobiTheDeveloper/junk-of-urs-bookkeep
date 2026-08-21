/**
 * Ontario sole proprietorship tax estimate — 2026 tax year.
 *
 * Assumes:
 *   - Ontario resident
 *   - Calendar year
 *   - Junk Of Urs profit (Stage subcontract + junk jobs) is self-employment income
 *   - Optional T4 wages in Settings only — Stage pay is NOT T4
 *   - Only the basic personal amount (no spouse, dependents, RRSP, tuition, etc.)
 *
 * Figures confirmed to CRA / Ontario 2026:
 *   Federal brackets & 14% lowest rate, BPA $16,452, CEA $1,501
 *   Ontario brackets, BPA $12,989, surtax $5,818 / $7,446, OTR basic $300
 *   CPP YMPE $74,600, YAMPE $85,000, self-employed 11.9% + CPP2 8%
 *   Ontario HST 13%, small-supplier threshold $30,000
 *
 * This is a planning estimate, not tax advice or a filed T1.
 */

import { roundCents } from './money'

export const TAX_YEAR = 2026

export const FEDERAL_BRACKETS_2026 = [
  { upTo: 58_523, rate: 0.14 },
  { upTo: 117_045, rate: 0.205 },
  { upTo: 181_440, rate: 0.26 },
  { upTo: 258_482, rate: 0.29 },
  { upTo: Infinity, rate: 0.33 },
] as const

export const ONTARIO_BRACKETS_2026 = [
  { upTo: 53_891, rate: 0.0505 },
  { upTo: 107_785, rate: 0.0915 },
  { upTo: 150_000, rate: 0.1116 },
  { upTo: 220_000, rate: 0.1216 },
  { upTo: Infinity, rate: 0.1316 },
] as const

export const FEDERAL_BPA = {
  max: 16_452,
  min: 14_829,
  phaseOutStart: 181_440,
  phaseOutEnd: 258_482,
  creditRate: 0.14,
} as const

export const ONTARIO_BPA = {
  amount: 12_989,
  creditRate: 0.0505,
} as const

export const ONTARIO_SURTAX = {
  firstThreshold: 5_818,
  firstRate: 0.2,
  secondThreshold: 7_446,
  secondRate: 0.36,
} as const

/** ON428 line 74 basic reduction (2026, indexed). */
export const ONTARIO_TAX_REDUCTION_BASIC = 300

/** Federal Canada employment amount — T4 wages only, not self-employment. */
export const CANADA_EMPLOYMENT_AMOUNT = 1_501

export const CPP_2026 = {
  basicExemption: 3_500,
  ympe: 74_600,
  yampe: 85_000,
  selfEmployedRate: 0.119,
  selfEmployedMax: 8_460.9,
  /** Original (base) CPP — half is a non-refundable credit, half is deductible. */
  baseRate: 0.099,
  employeeBaseRate: 0.0495,
  /** First additional CPP (enhancement) — fully deductible for the self-employed. */
  firstAdditionalRate: 0.02,
  cpp2Rate: 0.08,
  cpp2Max: 832,
} as const

export const ONTARIO_HST_RATE = 0.13
export const HST_SMALL_SUPPLIER_THRESHOLD = 30_000

export interface CppBreakdown {
  cpp1: number
  cpp2: number
  total: number
  deductible: number
  creditBase: number
}

export interface TaxBreakdown {
  /** Net business profit before the CPP deduction. */
  netProfit: number
  /** Other T4 / employment income entered in Settings. */
  otherIncome: number
  /** Line 26000-style taxable income after the CPP deduction. */
  taxableIncome: number
  cpp: CppBreakdown
  federalTax: number
  ontarioTaxBeforeSurtax: number
  ontarioSurtax: number
  ontarioTax: number
  ontarioHealthPremium: number
  /** Federal + Ontario (incl. surtax) + health premium — not CPP. */
  incomeTax: number
  /** Income tax + self-employed CPP — the amount to set aside. */
  totalTaxReserve: number
  /** totalTaxReserve / netProfit (0 if no profit). */
  effectiveRate: number
  /** Combined federal + Ontario marginal rate on the next dollar of profit (incl. surtax, excl. CPP). */
  marginalCombinedRate: number
  /** @deprecated alias of effectiveRate — kept so older UI does not crash */
  planningRate: number
  planningTierLabel: string
  /** @deprecated alias of cpp.total */
  cppReference: number
  /** @deprecated alias of marginalCombinedRate */
  marginalCombinedReference: number
}

export interface HstBreakdown {
  registered: boolean
  rate: number
  collected: number
  inputTaxCredits: number
  netHstOwing: number
  trailingRevenue: number
  smallSupplierThreshold: number
  approachingThreshold: boolean
  overThreshold: boolean
}

export function taxOnBrackets(
  income: number,
  brackets: readonly { upTo: number; rate: number }[],
): number {
  if (income <= 0) return 0
  let tax = 0
  let previous = 0
  for (const bracket of brackets) {
    if (income <= previous) break
    const slice = Math.min(income, bracket.upTo) - previous
    tax += slice * bracket.rate
    previous = bracket.upTo
  }
  return roundCents(tax)
}

export function federalBasicPersonalAmount(netIncome: number): number {
  if (netIncome <= FEDERAL_BPA.phaseOutStart) return FEDERAL_BPA.max
  if (netIncome >= FEDERAL_BPA.phaseOutEnd) return FEDERAL_BPA.min
  const span = FEDERAL_BPA.phaseOutEnd - FEDERAL_BPA.phaseOutStart
  const reduced =
    FEDERAL_BPA.max -
    ((FEDERAL_BPA.max - FEDERAL_BPA.min) * (netIncome - FEDERAL_BPA.phaseOutStart)) / span
  return roundCents(reduced)
}

/**
 * Self-employed CPP (Schedule 8).
 * Employment pensionable earnings (T4) reduce remaining YMPE/YAMPE room
 * and use up the $3,500 basic exemption first.
 */
export function calculateCpp(
  netSelfEmploymentIncome: number,
  employmentPensionable = 0,
): CppBreakdown {
  const se = Math.max(0, netSelfEmploymentIncome)
  const t4 = Math.min(Math.max(0, employmentPensionable), CPP_2026.yampe)

  if (se <= 0) {
    return { cpp1: 0, cpp2: 0, total: 0, deductible: 0, creditBase: 0 }
  }

  const exemptionRemaining = Math.max(0, CPP_2026.basicExemption - Math.min(t4, CPP_2026.basicExemption))
  const cpp1Room = Math.max(0, CPP_2026.ympe - t4)
  const cpp1Base = Math.min(Math.max(se - exemptionRemaining, 0), cpp1Room)
  const cpp1 = roundCents(Math.min(cpp1Base * CPP_2026.selfEmployedRate, CPP_2026.selfEmployedMax))

  const pensionableThroughCpp1 = t4 + Math.min(se, cpp1Room)
  const cpp2Room = Math.max(0, CPP_2026.yampe - Math.max(pensionableThroughCpp1, CPP_2026.ympe))
  const seAboveYmpe = Math.max(0, se - cpp1Room)
  const cpp2Base = Math.min(seAboveYmpe, cpp2Room)
  const cpp2 = roundCents(Math.min(cpp2Base * CPP_2026.cpp2Rate, CPP_2026.cpp2Max))

  const employeeBaseForCredit = roundCents(cpp1Base * CPP_2026.employeeBaseRate)
  const total = roundCents(cpp1 + cpp2)
  const deductible = roundCents(Math.max(0, total - employeeBaseForCredit))

  return {
    cpp1,
    cpp2,
    total,
    deductible,
    creditBase: employeeBaseForCredit,
  }
}

/** @deprecated use calculateCpp */
export function estimateCppReference(netSelfEmploymentIncome: number): number {
  return calculateCpp(netSelfEmploymentIncome).total
}

export function ontarioHealthPremium(taxableIncome: number): number {
  const ti = Math.max(0, taxableIncome)
  if (ti <= 20_000) return 0
  if (ti <= 36_000) return roundCents(Math.min(300, 0.06 * (ti - 20_000)))
  if (ti <= 48_000) return roundCents(Math.min(450, 300 + 0.06 * (ti - 36_000)))
  if (ti <= 72_000) return roundCents(Math.min(600, 450 + 0.25 * (ti - 48_000)))
  if (ti <= 200_000) return roundCents(Math.min(750, 600 + 0.25 * (ti - 72_000)))
  return roundCents(Math.min(900, 750 + 0.25 * (ti - 200_000)))
}

/**
 * ON428 Ontario tax reduction: twice the basic amount minus Ontario tax,
 * capped at tax payable, nil once tax exceeds twice the basic amount.
 */
export function ontarioTaxReduction(ontarioTaxBeforeReduction: number): number {
  if (ontarioTaxBeforeReduction <= 0) return 0
  const reduction = 2 * ONTARIO_TAX_REDUCTION_BASIC - ontarioTaxBeforeReduction
  return roundCents(Math.min(ontarioTaxBeforeReduction, Math.max(0, reduction)))
}

function ontarioSurtax(ontarioTaxAfterReduction: number): number {
  const first = Math.max(0, ontarioTaxAfterReduction - ONTARIO_SURTAX.firstThreshold) * ONTARIO_SURTAX.firstRate
  const second =
    Math.max(0, ontarioTaxAfterReduction - ONTARIO_SURTAX.secondThreshold) * ONTARIO_SURTAX.secondRate
  return roundCents(first + second)
}

export function combinedMarginalRate(taxableIncome: number): number {
  if (taxableIncome <= 0) return FEDERAL_BRACKETS_2026[0].rate + ONTARIO_BRACKETS_2026[0].rate

  const federal = FEDERAL_BRACKETS_2026.find((b) => taxableIncome <= b.upTo)?.rate ?? 0.33
  const ontario = ONTARIO_BRACKETS_2026.find((b) => taxableIncome <= b.upTo)?.rate ?? 0.1316

  const grossOntario = taxOnBrackets(taxableIncome, ONTARIO_BRACKETS_2026)
  const ontarioAfterCredits = Math.max(
    0,
    roundCents(grossOntario - ONTARIO_BPA.amount * ONTARIO_BPA.creditRate),
  )
  let ontarioEffective = ontario
  if (ontarioAfterCredits > ONTARIO_SURTAX.secondThreshold) {
    ontarioEffective = ontario * (1 + ONTARIO_SURTAX.firstRate + ONTARIO_SURTAX.secondRate)
  } else if (ontarioAfterCredits > ONTARIO_SURTAX.firstThreshold) {
    ontarioEffective = ontario * (1 + ONTARIO_SURTAX.firstRate)
  }

  return Math.round((federal + ontarioEffective) * 10000) / 10000
}

function describeReserve(netProfit: number, effectiveRate: number, totalTax: number): string {
  if (netProfit <= 0 || totalTax <= 0) {
    return 'No tax to set aside yet — expenses meet or exceed income.'
  }
  const pct = (effectiveRate * 100).toFixed(1)
  return `Set aside ${pct}% of net profit for federal + Ontario income tax, the Ontario Health Premium, and CPP.`
}

export function calculateOntarioSolePropTax(
  netProfit: number,
  otherIncome = 0,
): TaxBreakdown {
  const businessProfit = roundCents(netProfit)
  const employment = roundCents(Math.max(0, otherIncome))
  const cpp = calculateCpp(Math.max(0, businessProfit), employment)

  const taxableIncome = roundCents(Math.max(0, businessProfit + employment - cpp.deductible))
  const netIncomeForBpa = taxableIncome

  const federalGross = taxOnBrackets(taxableIncome, FEDERAL_BRACKETS_2026)
  const federalBpaCredit = roundCents(federalBasicPersonalAmount(netIncomeForBpa) * FEDERAL_BPA.creditRate)
  const federalCppCredit = roundCents(cpp.creditBase * FEDERAL_BPA.creditRate)
  const cea = roundCents(Math.min(CANADA_EMPLOYMENT_AMOUNT, employment))
  const federalCeaCredit = employment > 0 ? roundCents(cea * FEDERAL_BPA.creditRate) : 0
  const federalTax = roundCents(
    Math.max(0, federalGross - federalBpaCredit - federalCppCredit - federalCeaCredit),
  )

  const ontarioGross = taxOnBrackets(taxableIncome, ONTARIO_BRACKETS_2026)
  const ontarioBpaCredit = roundCents(ONTARIO_BPA.amount * ONTARIO_BPA.creditRate)
  const ontarioCppCredit = roundCents(cpp.creditBase * ONTARIO_BPA.creditRate)
  const ontarioAfterCredits = roundCents(Math.max(0, ontarioGross - ontarioBpaCredit - ontarioCppCredit))
  const reduction = ontarioTaxReduction(ontarioAfterCredits)
  const ontarioBeforeSurtax = roundCents(Math.max(0, ontarioAfterCredits - reduction))
  const surtax = ontarioSurtax(ontarioBeforeSurtax)
  const ontarioTax = roundCents(ontarioBeforeSurtax + surtax)
  const healthPremium = ontarioHealthPremium(taxableIncome)

  const incomeTax = roundCents(federalTax + ontarioTax + healthPremium)
  const totalTaxReserve = roundCents(incomeTax + cpp.total)
  const effectiveRate = businessProfit > 0 ? totalTaxReserve / businessProfit : 0
  const marginal = combinedMarginalRate(taxableIncome)

  return {
    netProfit: businessProfit,
    otherIncome: employment,
    taxableIncome,
    cpp,
    federalTax,
    ontarioTaxBeforeSurtax: ontarioBeforeSurtax,
    ontarioSurtax: surtax,
    ontarioTax,
    ontarioHealthPremium: healthPremium,
    incomeTax,
    totalTaxReserve,
    effectiveRate,
    marginalCombinedRate: marginal,
    planningRate: effectiveRate,
    planningTierLabel: describeReserve(businessProfit, effectiveRate, totalTaxReserve),
    cppReference: cpp.total,
    marginalCombinedReference: marginal,
  }
}

export function splitHst(
  amount: number,
  includesHst: boolean,
  rate = ONTARIO_HST_RATE,
): { net: number; hst: number } {
  const safe = Math.max(0, amount)
  if (!includesHst) {
    return { net: roundCents(safe), hst: roundCents(safe * rate) }
  }
  const net = roundCents(safe / (1 + rate))
  return { net, hst: roundCents(safe - net) }
}

export function calculateHst(options: {
  registered: boolean
  amountsIncludeHst: boolean
  incomeAmounts: number[]
  deductibleExpenseAmounts: number[]
  trailingRevenue: number
  /** When set, used instead of assuming 13% HST on every expense. */
  inputTaxCredits?: number
}): HstBreakdown {
  const {
    registered,
    amountsIncludeHst,
    incomeAmounts,
    deductibleExpenseAmounts,
    trailingRevenue,
    inputTaxCredits: inputTaxCreditsOverride,
  } = options

  if (!registered) {
    return {
      registered: false,
      rate: ONTARIO_HST_RATE,
      collected: 0,
      inputTaxCredits: 0,
      netHstOwing: 0,
      trailingRevenue: roundCents(trailingRevenue),
      smallSupplierThreshold: HST_SMALL_SUPPLIER_THRESHOLD,
      approachingThreshold: trailingRevenue >= HST_SMALL_SUPPLIER_THRESHOLD * 0.8,
      overThreshold: trailingRevenue > HST_SMALL_SUPPLIER_THRESHOLD,
    }
  }

  const collected = roundCents(
    incomeAmounts.reduce((sum, amount) => sum + splitHst(amount, amountsIncludeHst).hst, 0),
  )
  const inputTaxCredits = roundCents(
    inputTaxCreditsOverride ??
      deductibleExpenseAmounts.reduce(
        (sum, amount) => sum + splitHst(amount, amountsIncludeHst).hst,
        0,
      ),
  )

  return {
    registered: true,
    rate: ONTARIO_HST_RATE,
    collected,
    inputTaxCredits,
    netHstOwing: roundCents(collected - inputTaxCredits),
    trailingRevenue: roundCents(trailingRevenue),
    smallSupplierThreshold: HST_SMALL_SUPPLIER_THRESHOLD,
    approachingThreshold: trailingRevenue >= HST_SMALL_SUPPLIER_THRESHOLD * 0.8,
    overThreshold: trailingRevenue > HST_SMALL_SUPPLIER_THRESHOLD,
  }
}

export function businessAmountForIncomeTax(
  amount: number,
  hstRegistered: boolean,
  amountsIncludeHst: boolean,
): number {
  if (hstRegistered && amountsIncludeHst) {
    return splitHst(amount, true).net
  }
  return roundCents(Math.max(0, amount))
}

export function getSolePropTaxExplanation(): string {
  return (
    'Junk Of Urs is one sole proprietorship: Stage subcontract pay and junk-removal jobs are both self-employment income ' +
    '(T2125 / T4A — not a T4 job). Profit = income − CRA-allowed expenses. Gas, dump fees, and marketing are deductible; ' +
    'meals are 50%; vehicle costs are actual expenses × your business-use % (mileage is the log, not a second deduction). ' +
    'This app estimates 2026 federal tax, Ontario tax (including surtax and the Ontario tax reduction), the Ontario Health Premium, ' +
    'and self-employed CPP (both halves). Half of base CPP is a tax credit; the rest is deducted from income. ' +
    'HST (13%) is separate: collect/remit only if registered, usually once taxable sales pass $30,000. Meals ITCs are 50%; insurance has no HST. ' +
    'Only the basic personal amount is applied — RRSP, dependents, or other credits would lower tax. Not tax advice.'
  )
}

/** @deprecated use getSolePropTaxExplanation */
export function getOntarioTaxEngineExplanation(): string {
  return getSolePropTaxExplanation()
}

export function formatPlanningRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`
}

export function formatPercent(rate: number, digits = 1): string {
  return `${(rate * 100).toFixed(digits)}%`
}

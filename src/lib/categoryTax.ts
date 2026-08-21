import type { Category } from '../types'

/**
 * CRA treatment for Junk Of Urs expense categories (T2125 + GST/HST).
 *
 * Sole proprietors deduct actual vehicle costs × business-use %, not a
 * per-kilometre allowance (that rate is for employee reimbursements).
 * Mileage entries are the logbook, not a second deduction on top of gas.
 */
export type ExpenseTaxKind =
  | 'standard'
  | 'meals'
  | 'vehicle'
  | 'phone'
  | 'hst_exempt'
  | 'mileage_log'

export interface CategoryTaxRule {
  kind: ExpenseTaxKind
  /** Portion allowed as an income-tax deduction after any ITC (meals 50%). */
  deductFraction: number
  /** Portion of HST allowed as an input tax credit (meals 50%). */
  itcFraction: number
  /** False for GST-exempt supplies such as insurance. */
  chargesHst: boolean
  /** Apply the matching business-use % from Settings. */
  useBasis: 'full' | 'vehicle' | 'phone'
  /** False for mileage logs — they support the vehicle % , they are not T2125 line 9281. */
  incomeTaxDeductible: boolean
}

const STANDARD: CategoryTaxRule = {
  kind: 'standard',
  deductFraction: 1,
  itcFraction: 1,
  chargesHst: true,
  useBasis: 'full',
  incomeTaxDeductible: true,
}

function includesAll(name: string, parts: string[]): boolean {
  return parts.every((part) => name.includes(part))
}

export function categoryTaxRule(category: Category | undefined): CategoryTaxRule {
  const name = (category?.name ?? '').toLowerCase()

  if (name.includes('mileage') || name.includes('kilometre') || name.includes('kilometer')) {
    return {
      kind: 'mileage_log',
      deductFraction: 0,
      itcFraction: 0,
      chargesHst: false,
      useBasis: 'full',
      incomeTaxDeductible: false,
    }
  }

  if (name.includes('meal') || name.includes('entertainment')) {
    return {
      kind: 'meals',
      deductFraction: 0.5,
      itcFraction: 0.5,
      chargesHst: true,
      useBasis: 'full',
      incomeTaxDeductible: true,
    }
  }

  if (
    name.includes('fuel') ||
    name.includes('gas') ||
    includesAll(name, ['vehicle', 'maintenance']) ||
    includesAll(name, ['vehicle', 'repair'])
  ) {
    return {
      kind: 'vehicle',
      deductFraction: 1,
      itcFraction: 1,
      chargesHst: true,
      useBasis: 'vehicle',
      incomeTaxDeductible: true,
    }
  }

  if (name.includes('phone') || name.includes('internet')) {
    return {
      kind: 'phone',
      deductFraction: 1,
      itcFraction: 1,
      chargesHst: true,
      useBasis: 'phone',
      incomeTaxDeductible: true,
    }
  }

  if (name.includes('insurance')) {
    return {
      kind: 'hst_exempt',
      deductFraction: 1,
      itcFraction: 0,
      chargesHst: false,
      useBasis: 'full',
      incomeTaxDeductible: true,
    }
  }

  return STANDARD
}

export function isMealsCategory(category: Category | undefined): boolean {
  return categoryTaxRule(category).kind === 'meals'
}

export function isMileageLogCategory(category: Category | undefined): boolean {
  return categoryTaxRule(category).kind === 'mileage_log'
}

export function deductionBadgeLabel(
  category: Category | undefined,
  vehicleBusinessUsePercent: number,
  phoneInternetBusinessUsePercent: number,
): string | null {
  const rule = categoryTaxRule(category)
  if (!rule.incomeTaxDeductible) return 'Log only — not a deduction'
  if (rule.kind === 'meals') return '50% deductible'
  if (rule.useBasis === 'vehicle' && vehicleBusinessUsePercent < 100) {
    return `${vehicleBusinessUsePercent}% business use`
  }
  if (rule.useBasis === 'phone' && phoneInternetBusinessUsePercent < 100) {
    return `${phoneInternetBusinessUsePercent}% business use`
  }
  return 'Deductible'
}

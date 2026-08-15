import assert from 'node:assert/strict'
import { calculateSummary } from '../src/lib/calculations.ts'
import { roundCents } from '../src/lib/money.ts'
import {
  calculateCpp,
  calculateHst,
  calculateOntarioSolePropTax,
  combinedMarginalRate,
  CPP_2026,
  federalBasicPersonalAmount,
  ontarioHealthPremium,
  ONTARIO_BPA,
  ONTARIO_SURTAX,
  splitHst,
  taxOnBrackets,
  FEDERAL_BRACKETS_2026,
  ONTARIO_BRACKETS_2026,
} from '../src/lib/taxEngine.ts'
import type { Category, Settings, Transaction } from '../src/types/index.ts'

function almost(actual: number, expected: number, cents = 1) {
  assert.ok(
    Math.abs(actual - expected) <= cents / 100,
    `expected ${expected}, got ${actual}`,
  )
}

function tx(
  partial: Partial<Transaction> & Pick<Transaction, 'type' | 'amount' | 'date'>,
): Transaction {
  return {
    id: crypto.randomUUID(),
    description: '',
    categoryId: null,
    incomeSource: partial.type === 'income' ? 'junk_removal' : null,
    vendor: '',
    client: '',
    receiptId: null,
    isTaxDeductible: partial.type === 'expense',
    notes: '',
    importKey: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...partial,
  }
}

function run() {
  assert.equal(calculateOntarioSolePropTax(0).totalTaxReserve, 0)
  assert.equal(calculateCpp(0).total, 0)
  assert.equal(calculateCpp(3_500).total, 0)

  const maxCpp = calculateCpp(90_000)
  almost(maxCpp.cpp1, CPP_2026.selfEmployedMax)
  almost(maxCpp.cpp2, CPP_2026.cpp2Max)
  almost(maxCpp.total, 9_292.9)

  const cpp50 = calculateCpp(50_000)
  almost(cpp50.cpp1, roundCents((50_000 - 3_500) * 0.119))
  almost(cpp50.creditBase, roundCents((50_000 - 3_500) * 0.0495))
  almost(cpp50.deductible, roundCents(cpp50.total - cpp50.creditBase))

  const t4Max = calculateCpp(20_000, 85_000)
  assert.equal(t4Max.total, 0)

  const t4Partial = calculateCpp(20_000, 40_000)
  almost(t4Partial.cpp1, roundCents(20_000 * 0.119))
  assert.equal(t4Partial.cpp2, 0)

  assert.equal(ontarioHealthPremium(20_000), 0)
  almost(ontarioHealthPremium(25_000), 300)
  almost(ontarioHealthPremium(40_000), 450)
  almost(ontarioHealthPremium(50_000), 600)
  almost(ontarioHealthPremium(80_000), 750)
  almost(ontarioHealthPremium(250_000), 900)

  assert.equal(federalBasicPersonalAmount(50_000), 16_452)
  assert.equal(federalBasicPersonalAmount(258_482), 14_829)

  const low = calculateOntarioSolePropTax(10_000)
  assert.equal(low.federalTax, 0)
  assert.equal(low.ontarioTax, 0)
  assert.equal(low.ontarioHealthPremium, 0)
  almost(low.totalTaxReserve, low.cpp.total)

  const otr = calculateOntarioSolePropTax(15_000)
  assert.equal(otr.ontarioTax, 0)
  assert.ok(otr.cpp.total > 0)

  const onlyBpaSurtaxStart = calculateOntarioSolePropTax(0, 94_907)
  almost(onlyBpaSurtaxStart.ontarioTaxBeforeSurtax, ONTARIO_SURTAX.firstThreshold, 100)
  assert.ok(onlyBpaSurtaxStart.ontarioSurtax < 2)

  const mid = calculateOntarioSolePropTax(50_000)
  assert.ok(mid.federalTax > 3_000)
  assert.ok(mid.ontarioTax > 1_000)
  almost(mid.ontarioHealthPremium, 450)
  assert.ok(mid.effectiveRate > 0.2 && mid.effectiveRate < 0.28)
  almost(mid.totalTaxReserve, roundCents(mid.incomeTax + mid.cpp.total))
  almost(mid.taxableIncome, roundCents(50_000 - mid.cpp.deductible))

  const high = calculateOntarioSolePropTax(120_000)
  assert.ok(high.ontarioSurtax > 0)
  assert.ok(high.marginalCombinedRate > 0.33)

  almost(combinedMarginalRate(40_000), 0.14 + 0.0505)
  almost(taxOnBrackets(53_891, ONTARIO_BRACKETS_2026), roundCents(53_891 * 0.0505))
  almost(taxOnBrackets(58_523, FEDERAL_BRACKETS_2026), roundCents(58_523 * 0.14))

  const hst = splitHst(113, true)
  almost(hst.net, 100)
  almost(hst.hst, 13)

  const unregistered = calculateHst({
    registered: false,
    amountsIncludeHst: false,
    incomeAmounts: [40_000],
    deductibleExpenseAmounts: [5_000],
    trailingRevenue: 40_000,
  })
  assert.equal(unregistered.collected, 0)
  assert.equal(unregistered.overThreshold, true)

  const registered = calculateHst({
    registered: true,
    amountsIncludeHst: true,
    incomeAmounts: [113],
    deductibleExpenseAmounts: [113],
    trailingRevenue: 100,
  })
  almost(registered.collected, 13)
  almost(registered.inputTaxCredits, 13)
  almost(registered.netHstOwing, 0)

  const bpaCredit = roundCents(ONTARIO_BPA.amount * ONTARIO_BPA.creditRate)
  almost(bpaCredit, 655.94, 2)

  const meals: Category = {
    id: 'meals',
    name: 'Meals (50% deductible)',
    icon: 'utensils',
    color: '#f43f5e',
    isDefault: true,
    updatedAt: new Date().toISOString(),
  }
  const settings: Settings = {
    id: 'main',
    businessName: 'Test',
    businessStartDate: '2026-01-01',
    incomeTaxRate: 0,
    selfEmploymentRate: 0,
    fiscalYearStart: 1,
    currency: 'CAD',
    quarterlyRemindersEnabled: true,
    dismissedReminderKey: null,
    lastSyncedAt: null,
    updatedAt: new Date().toISOString(),
    hstRegistered: false,
    amountsIncludeHst: false,
    otherAnnualIncome: 0,
  }
  const books: Transaction[] = [
    tx({ type: 'income', amount: 8_000, date: '2026-01-15', incomeSource: 'subcontractor' }),
    tx({ type: 'income', amount: 8_000, date: '2026-06-15', incomeSource: 'junk_removal' }),
    tx({ type: 'expense', amount: 100, date: '2026-06-20', categoryId: 'meals', isTaxDeductible: true }),
  ]
  const june = calculateSummary(books, [meals], settings, 2026, 6)
  const year = calculateSummary(books, [meals], settings, 2026)

  almost(june.deductibleExpenses, 50)
  almost(june.grossIncome, 8_000)
  almost(year.grossIncome, 16_000)
  almost(year.deductibleExpenses, 50)
  almost(year.netProfit, 15_950)
  assert.ok(june.taxReserve > 0)
  assert.ok(june.taxReserve < year.taxReserve)
  almost(year.taxReserve, year.taxBreakdown.totalTaxReserve)

  console.log('Ontario 2026 tax engine checks passed')
}

run()

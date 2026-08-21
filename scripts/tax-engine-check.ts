import assert from 'node:assert/strict'
import { calculateSummary, deductibleAmount, expenseTaxLine } from '../src/lib/calculations.ts'
import { roundCents } from '../src/lib/money.ts'
import {
  calculateCpp,
  calculateHst,
  calculateOntarioSolePropTax,
  CANADA_EMPLOYMENT_AMOUNT,
  combinedMarginalRate,
  CPP_2026,
  federalBasicPersonalAmount,
  ontarioHealthPremium,
  ontarioTaxReduction,
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

function cat(id: string, name: string): Category {
  return {
    id,
    name,
    icon: 'tag',
    color: '#64748b',
    isDefault: true,
    updatedAt: new Date().toISOString(),
  }
}

const meals = cat('meals', 'Meals (50% deductible)')
const fuel = cat('fuel', 'Fuel & Gas')
const mileage = cat('mileage', 'Mileage')
const dump = cat('dump', 'Dump & Disposal Fees')
const marketing = cat('marketing', 'Marketing')
const insurance = cat('insurance', 'Insurance')
const phone = cat('phone', 'Phone & Internet')

function baseSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    id: 'main',
    businessName: 'Junk Of Urs',
    businessStartDate: '2026-06-01',
    incomeTaxRate: 0,
    selfEmploymentRate: 0,
    fiscalYearStart: 1,
    currency: 'CAD',
    quarterlyRemindersEnabled: true,
    dismissedReminderKey: null,
    lastSyncedAt: null,
    updatedAt: new Date().toISOString(),
    hstRegistered: false,
    amountsIncludeHst: true,
    otherAnnualIncome: 0,
    vehicleBusinessUsePercent: 100,
    phoneInternetBusinessUsePercent: 100,
    ...overrides,
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

  assert.equal(ontarioTaxReduction(0), 0)
  assert.equal(ontarioTaxReduction(250), 250)
  almost(ontarioTaxReduction(400), 200)
  assert.equal(ontarioTaxReduction(600), 0)
  assert.equal(ontarioTaxReduction(700), 0)

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

  const t4Only = calculateOntarioSolePropTax(0, 20_000)
  const ceaCredit = roundCents(CANADA_EMPLOYMENT_AMOUNT * 0.14)
  assert.ok(ceaCredit > 200)
  assert.ok(t4Only.federalTax > 0)
  assert.ok(t4Only.cpp.total === 0)

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

  const settings = baseSettings()
  const books: Transaction[] = [
    tx({ type: 'income', amount: 8_000, date: '2026-01-15', incomeSource: 'subcontractor', client: 'Stage' }),
    tx({ type: 'income', amount: 8_000, date: '2026-06-15', incomeSource: 'junk_removal' }),
    tx({ type: 'expense', amount: 100, date: '2026-06-20', categoryId: 'meals', isTaxDeductible: true }),
    tx({ type: 'expense', amount: 760, date: '2026-06-19', categoryId: 'mileage', isTaxDeductible: true }),
    tx({ type: 'expense', amount: 80, date: '2026-06-18', categoryId: 'dump', isTaxDeductible: true }),
    tx({ type: 'expense', amount: 40, date: '2026-06-21', categoryId: 'marketing', isTaxDeductible: true }),
  ]
  const cats = [meals, fuel, mileage, dump, marketing, insurance, phone]
  const june = calculateSummary(books, cats, settings, 2026, 6)
  const year = calculateSummary(books, cats, settings, 2026)

  almost(june.deductibleExpenses, 50 + 80 + 40)
  almost(june.grossIncome, 8_000)
  almost(year.grossIncome, 16_000)
  almost(year.subcontractorIncome, 8_000)
  almost(year.junkRemovalIncome, 8_000)
  almost(year.deductibleExpenses, 170)
  almost(year.netProfit, 15_830)
  assert.equal(deductibleAmount(books[3], cats, settings), 0)
  assert.ok(june.taxReserve > 0)
  assert.ok(june.taxReserve < year.taxReserve)
  almost(year.taxReserve, year.taxBreakdown.totalTaxReserve)

  const mealHst = expenseTaxLine(
    tx({ type: 'expense', amount: 113, date: '2026-06-01', categoryId: 'meals' }),
    meals,
    baseSettings({ hstRegistered: true, amountsIncludeHst: true }),
  )
  almost(mealHst.inputTaxCredit, 6.5)
  almost(mealHst.incomeTaxDeduction, 53.25)

  const gasHalf = expenseTaxLine(
    tx({ type: 'expense', amount: 100, date: '2026-06-01', categoryId: 'fuel' }),
    fuel,
    baseSettings({ vehicleBusinessUsePercent: 50 }),
  )
  almost(gasHalf.incomeTaxDeduction, 50)

  const phoneHalf = expenseTaxLine(
    tx({ type: 'expense', amount: 80, date: '2026-06-01', categoryId: 'phone' }),
    phone,
    baseSettings({ phoneInternetBusinessUsePercent: 50 }),
  )
  almost(phoneHalf.incomeTaxDeduction, 40)

  const insured = expenseTaxLine(
    tx({ type: 'expense', amount: 113, date: '2026-06-01', categoryId: 'insurance' }),
    insurance,
    baseSettings({ hstRegistered: true, amountsIncludeHst: true }),
  )
  almost(insured.incomeTaxDeduction, 113)
  almost(insured.inputTaxCredit, 0)

  const dumpFee = expenseTaxLine(
    tx({ type: 'expense', amount: 226, date: '2026-06-01', categoryId: 'dump' }),
    dump,
    baseSettings({ hstRegistered: true, amountsIncludeHst: true }),
  )
  almost(dumpFee.inputTaxCredit, 26)
  almost(dumpFee.incomeTaxDeduction, 200)

  console.log('Ontario 2026 tax engine checks passed')
}

run()

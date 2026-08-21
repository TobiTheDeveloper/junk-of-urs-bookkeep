import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Plus,
  Trash2,
  Info,
  FileSpreadsheet,
  Upload,
  Database,
  Building2,
  Tags,
  FolderInput,
  FileDown,
  Receipt,
  ChevronDown,
  BriefcaseBusiness,
} from 'lucide-react'
import {
  FieldLabel,
  GhostButton,
  PrimaryButton,
  TextInput,
} from '../components/FormFields'
import {
  SettingsAction,
  SettingsSection,
  SettingsStatPill,
  SettingsToggle,
} from '../components/SettingsSection'
import { SupabaseAuthPanel } from '../components/SupabaseAuth'
import {
  addCategory,
  deleteCategory,
  updateSettings,
  useCategories,
  useSettings,
  useTransactions,
} from '../hooks/useData'
import { db } from '../db/database'
import { calculateSummary } from '../lib/calculations'
import { normalizeCategoryName } from '../lib/dedupe'
import {
  exportTransactionsCsv,
  exportYearEndAccountantPackage,
  getAvailableExportYears,
} from '../lib/export'
import { displayCurrency } from '../lib/format'
import {
  analyzeExpensifyCsv,
  importExpensifyCsv,
  seedJune2026BusinessData,
} from '../lib/seedBusinessData'
import { summarizeImportResult } from '../lib/expensifyImport'
import { getOntarioTaxExplanation } from '../lib/taxReminders'
import { TaxBreakdownPanel } from '../components/TaxBreakdownPanel'

export function SettingsPage() {
  const settings = useSettings()
  const categories = useCategories()
  const transactions = useTransactions()
  const [newCategory, setNewCategory] = useState('')
  const [saved, setSaved] = useState(false)
  const [tipsOpen, setTipsOpen] = useState(false)
  const [categoriesOpen, setCategoriesOpen] = useState(true)

  const [businessName, setBusinessName] = useState('')
  const [businessStartDate, setBusinessStartDate] = useState('2026-06-01')
  const [quarterlyRemindersEnabled, setQuarterlyRemindersEnabled] = useState(true)
  const [hstRegistered, setHstRegistered] = useState(false)
  const [amountsIncludeHst, setAmountsIncludeHst] = useState(true)
  const [otherAnnualIncome, setOtherAnnualIncome] = useState('0')
  const [vehicleBusinessUsePercent, setVehicleBusinessUsePercent] = useState('100')
  const [phoneInternetBusinessUsePercent, setPhoneInternetBusinessUsePercent] = useState('100')
  const [importMessage, setImportMessage] = useState('')
  const [exportYear, setExportYear] = useState(new Date().getFullYear())
  const [exportingPackage, setExportingPackage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const year = new Date().getFullYear()
  const ytdSummary = useMemo(() => {
    if (!settings) return null
    return calculateSummary(transactions, categories, settings, year)
  }, [transactions, categories, settings, year])

  const uniqueCategoryCount = useMemo(() => {
    return new Set(categories.map((c) => normalizeCategoryName(c.name))).size
  }, [categories])

  const exportYears = useMemo(() => getAvailableExportYears(transactions), [transactions])

  useEffect(() => {
    if (settings) {
      setBusinessName(settings.businessName)
      setBusinessStartDate(settings.businessStartDate ?? '2026-06-01')
      setQuarterlyRemindersEnabled(settings.quarterlyRemindersEnabled)
      setHstRegistered(settings.hstRegistered ?? false)
      setAmountsIncludeHst(settings.amountsIncludeHst ?? true)
      setOtherAnnualIncome(String(settings.otherAnnualIncome ?? 0))
      setVehicleBusinessUsePercent(String(settings.vehicleBusinessUsePercent ?? 100))
      setPhoneInternetBusinessUsePercent(String(settings.phoneInternetBusinessUsePercent ?? 100))
    }
  }, [settings])

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    await updateSettings({
      businessName,
      businessStartDate,
      quarterlyRemindersEnabled,
      dismissedReminderKey: quarterlyRemindersEnabled ? settings?.dismissedReminderKey ?? null : null,
      hstRegistered,
      amountsIncludeHst,
      otherAnnualIncome: Math.max(0, parseFloat(otherAnnualIncome) || 0),
      vehicleBusinessUsePercent: Math.min(100, Math.max(0, parseFloat(vehicleBusinessUsePercent) || 0)),
      phoneInternetBusinessUsePercent: Math.min(
        100,
        Math.max(0, parseFloat(phoneInternetBusinessUsePercent) || 0),
      ),
      currency: 'CAD',
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleAddCategory = async () => {
    const name = newCategory.trim()
    if (!name) return
    try {
      await addCategory(name)
      setNewCategory('')
    } catch (err) {
      console.error('Failed to add category:', err)
    }
  }

  const handleExportJson = async () => {
    const data = {
      exportedAt: new Date().toISOString(),
      settings: await db.settings.toArray(),
      categories: await db.categories.toArray(),
      transactions: await db.transactions.toArray(),
      receipts: await db.receipts.toArray().then((rows) =>
        rows.map((row) => {
          const { imageData: _omit, ...rest } = row
          void _omit
          return rest
        }),
      ),
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `junk-of-urs-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleExportCsv = () => {
    if (!settings) return
    exportTransactionsCsv(transactions, categories, settings.businessName)
  }

  const handleExpensifyImport = async (file: File) => {
    if (!settings) return
    try {
      const text = await file.text()
      const preview = analyzeExpensifyCsv(text, businessStartDate)
      const result = await importExpensifyCsv(text, businessStartDate)
      setImportMessage(
        `${summarizeImportResult(result)} Preview: ${preview.business} business / ${preview.personal} personal.`,
      )
    } catch (err) {
      setImportMessage(err instanceof Error ? err.message : 'Import failed.')
    }
  }

  const handleReloadJuneData = async () => {
    try {
      const result = await seedJune2026BusinessData()
      setImportMessage(result.messages.join(' ') + ` (${result.duplicates} skipped.)`)
    } catch (err) {
      setImportMessage(err instanceof Error ? err.message : 'Could not reload June data.')
    }
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  const currency = displayCurrency(settings.currency)
  const effectiveTaxRate = ytdSummary?.effectiveTaxRate ?? 0
  const incomeCount = transactions.filter((t) => t.type === 'income').length
  const expenseCount = transactions.filter((t) => t.type === 'expense').length

  const handleYearEndExport = async () => {
    if (!settings) return
    setExportingPackage(true)
    try {
      await exportYearEndAccountantPackage(exportYear, transactions, categories, settings)
    } catch (err) {
      console.error('Year-end export failed:', err)
    } finally {
      setExportingPackage(false)
    }
  }

  return (
    <div className="space-y-5 pb-2">
      <header className="space-y-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-brand-400">Settings</p>
          <h1 className="text-2xl font-bold text-white mt-1">{businessName || 'Junk Of Urs'}</h1>
          <p className="text-sm text-slate-400 mt-1">Ontario sole proprietorship · CAD</p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <SettingsStatPill label="Transactions" value={String(transactions.length)} />
          <SettingsStatPill
            label="Tax reserve"
            value={`${effectiveTaxRate.toFixed(1)}%`}
            tone="amber"
          />
          <SettingsStatPill label="Storage" value="Cloud + local" tone="brand" />
        </div>
      </header>

      <SupabaseAuthPanel />

      <SettingsSection
        icon={Building2}
        title="Business & tax"
        description="Profile, HST, other income, and CRA instalment reminders"
      >
        <form onSubmit={handleSaveSettings} className="space-y-4">
          <div className="space-y-3">
            <div>
              <FieldLabel>Business name</FieldLabel>
              <TextInput value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
            </div>
            <div>
              <FieldLabel>Business start date</FieldLabel>
              <TextInput
                type="date"
                value={businessStartDate}
                onChange={(e) => setBusinessStartDate(e.target.value)}
              />
              <p className="text-[11px] text-slate-500 mt-1.5">
                Expensify imports only include expenses on or after this date.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              {year} Ontario tax estimate
            </p>
            {ytdSummary && (
              <TaxBreakdownPanel
                tax={ytdSummary.taxBreakdown}
                hst={ytdSummary.hst}
                currency={currency}
              />
            )}
          </div>

          <div>
            <FieldLabel>Other T4 wages this year (not Stage)</FieldLabel>
            <TextInput
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={otherAnnualIncome}
              onChange={(e) => setOtherAnnualIncome(e.target.value)}
            />
            <p className="text-[11px] text-slate-500 mt-1.5">
              Leave $0 unless you also have a job that issues a T4 with tax and CPP already taken
              off. Stage subcontract pay is business income — log it under Income, do not enter it
              here.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel>Vehicle business-use %</FieldLabel>
              <TextInput
                type="number"
                inputMode="decimal"
                step="1"
                min="0"
                max="100"
                value={vehicleBusinessUsePercent}
                onChange={(e) => setVehicleBusinessUsePercent(e.target.value)}
              />
              <p className="text-[11px] text-slate-500 mt-1.5">
                Business km ÷ total km from your log. Applied to fuel and vehicle maintenance — not
                to a second mileage dollar amount.
              </p>
            </div>
            <div>
              <FieldLabel>Phone & internet business-use %</FieldLabel>
              <TextInput
                type="number"
                inputMode="decimal"
                step="1"
                min="0"
                max="100"
                value={phoneInternetBusinessUsePercent}
                onChange={(e) => setPhoneInternetBusinessUsePercent(e.target.value)}
              />
              <p className="text-[11px] text-slate-500 mt-1.5">
                Only the business share of a mixed personal/work phone or internet bill.
              </p>
            </div>
          </div>

          <SettingsToggle
            checked={hstRegistered}
            onChange={setHstRegistered}
            label="HST registered"
            description="Ontario 13% — usually required after $30,000 in taxable sales"
          />

          {hstRegistered && (
            <SettingsToggle
              checked={amountsIncludeHst}
              onChange={setAmountsIncludeHst}
              label="Amounts I enter already include HST"
              description="On for receipt and invoice totals (gas, dump fees, Stage invoices). Off only if you type pre-tax prices."
            />
          )}

          <SettingsToggle
            checked={quarterlyRemindersEnabled}
            onChange={setQuarterlyRemindersEnabled}
            label="CRA instalment reminders"
            description="Mar 15 · Jun 15 · Sep 15 · Dec 15"
          />

          <details className="group rounded-xl border border-amber-900/30 bg-amber-950/20">
            <summary className="flex items-center gap-2 cursor-pointer list-none px-3.5 py-2.5 text-xs text-amber-200/90">
              <Info size={14} className="shrink-0" />
              <span className="flex-1">Tax rate details</span>
              <ChevronDown size={14} className="shrink-0 transition-transform group-open:rotate-180" />
            </summary>
            <p className="px-3.5 pb-3 text-[11px] text-amber-100/70 leading-relaxed">
              {getOntarioTaxExplanation()}
            </p>
          </details>

          <PrimaryButton type="submit">{saved ? 'Saved!' : 'Save changes'}</PrimaryButton>
        </form>
      </SettingsSection>

      <SettingsSection
        icon={Tags}
        title="Expense categories"
        description={`${uniqueCategoryCount} categories · ${expenseCount} expenses logged`}
      >
        <div className="flex gap-2 mb-3">
          <TextInput
            placeholder="Add category…"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCategory())}
            className="flex-1"
          />
          <GhostButton type="button" onClick={handleAddCategory} className="shrink-0 px-3">
            <Plus size={18} />
          </GhostButton>
        </div>

        <button
          type="button"
          onClick={() => setCategoriesOpen((o) => !o)}
          className="flex items-center justify-between w-full text-xs text-slate-500 mb-2 hover:text-slate-300"
        >
          <span>{categoriesOpen ? 'Hide list' : 'Show list'}</span>
          <ChevronDown
            size={14}
            className={`transition-transform ${categoriesOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {categoriesOpen && (
          <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1 -mr-1">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between rounded-lg border border-slate-800/80 bg-slate-800/30 px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="text-sm text-slate-200 truncate">{cat.name}</span>
                  {cat.isDefault && (
                    <span className="text-[9px] uppercase tracking-wide text-slate-600 shrink-0">
                      default
                    </span>
                  )}
                </div>
                {!cat.isDefault && (
                  <button
                    type="button"
                    onClick={() => deleteCategory(cat.id)}
                    className="p-1.5 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-950/30 shrink-0"
                    aria-label={`Delete ${cat.name}`}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </SettingsSection>

      <SettingsSection
        icon={FolderInput}
        title="Import data"
        description="Bring in Expensify exports or reload your June 2026 books"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleExpensifyImport(file)
            e.target.value = ''
          }}
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <SettingsAction
            icon={Upload}
            label="Import Expensify CSV"
            hint="Duplicates blocked · personal filtered out"
            onClick={() => fileInputRef.current?.click()}
          />
          <SettingsAction
            icon={Database}
            label="Reload June 2026 data"
            hint="Sync seed income & expenses"
            onClick={handleReloadJuneData}
          />
        </div>
        {importMessage && (
          <p className="mt-3 text-xs text-brand-300 bg-brand-950/30 border border-brand-900/30 rounded-lg px-3 py-2">
            {importMessage}
          </p>
        )}
      </SettingsSection>

      <SettingsSection
        icon={FileDown}
        title="Export & backup"
        description={`${incomeCount} income · ${expenseCount} expenses`}
      >
        <div className="rounded-xl border border-brand-900/40 bg-brand-950/15 p-3.5 mb-3 space-y-3">
          <div className="flex items-start gap-3">
            <BriefcaseBusiness size={18} className="text-brand-400 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-brand-200">Accountant year-end package</p>
              <p className="text-[11px] text-brand-100/60 mt-0.5 leading-relaxed">
                One ZIP: summary, categories, and all transactions for the selected year.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <select
              value={exportYear}
              onChange={(e) => setExportYear(Number(e.target.value))}
              className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white"
            >
              {exportYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <PrimaryButton
              type="button"
              disabled={exportingPackage}
              onClick={handleYearEndExport}
              className="shrink-0 px-4"
            >
              {exportingPackage ? '…' : 'Download ZIP'}
            </PrimaryButton>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <SettingsAction
            icon={FileSpreadsheet}
            label="Transactions CSV"
            hint="For your accountant"
            onClick={handleExportCsv}
          />
          <SettingsAction
            icon={FileDown}
            label="Full JSON backup"
            hint="Complete local backup"
            onClick={handleExportJson}
          />
        </div>
        {settings.lastSyncedAt && (
          <p className="mt-3 text-[11px] text-slate-500 text-center">
            Last cloud sync · {new Date(settings.lastSyncedAt).toLocaleString()}
          </p>
        )}
      </SettingsSection>

      <SettingsSection
        icon={Receipt}
        title="Record keeping"
        description="What to use when you don't have a receipt"
        variant="muted"
      >
        <button
          type="button"
          onClick={() => setTipsOpen((o) => !o)}
          className="flex items-center justify-between w-full text-sm text-slate-300 hover:text-white"
        >
          <span>{tipsOpen ? 'Hide tips' : 'Show CRA-friendly proof tips'}</span>
          <ChevronDown size={16} className={`transition-transform ${tipsOpen ? 'rotate-180' : ''}`} />
        </button>
        {tipsOpen && (
          <ul className="mt-3 space-y-2.5 text-xs text-slate-400 border-t border-slate-800 pt-3">
            <li>
              <strong className="text-slate-300">Bank statements</strong> — date, vendor, amount
              (Expensify counts).
            </li>
            <li>
              <strong className="text-slate-300">Mileage log</strong> — date, destination, purpose,
              business km and total km (proves vehicle %). Do not also enter that km as a dollar
              deduction on top of gas.
            </li>
            <li>
              <strong className="text-slate-300">Invoices & emails</strong> — subcontractor invoices,
              job confirmations.
            </li>
            <li>
              <strong className="text-slate-300">Notes on expenses</strong> — e.g. &quot;Proof: TD Visa
              Jun 14&quot; until you attach a photo.
            </li>
          </ul>
        )}
      </SettingsSection>

      <p className="text-center text-[11px] text-slate-600 pt-1">
        Junk Of Urs Bookkeeper · Sign in required
      </p>
    </div>
  )
}

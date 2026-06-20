import { useEffect, useRef, useState } from 'react'
import { Plus, Trash2, Download, Info, FileSpreadsheet, Upload, Database } from 'lucide-react'
import {
  FieldLabel,
  GhostButton,
  PrimaryButton,
  TextInput,
} from '../components/FormFields'
import { SupabaseAuthPanel } from '../components/SupabaseAuth'
import { RecordKeepingTips } from '../components/RecordKeepingTips'
import {
  addCategory,
  deleteCategory,
  updateSettings,
  useCategories,
  useSettings,
  useTransactions,
} from '../hooks/useData'
import { db } from '../db/database'
import { exportTransactionsCsv } from '../lib/export'
import {
  analyzeExpensifyCsv,
  importExpensifyCsv,
  seedJune2026BusinessData,
} from '../lib/seedBusinessData'
import { summarizeImportResult } from '../lib/expensifyImport'
import { getOntarioTaxExplanation, ONTARIO_SOLE_PROP_TAX } from '../lib/taxReminders'
import { useAuth } from '../hooks/useAuth'

export function SettingsPage() {
  const settings = useSettings()
  const categories = useCategories()
  const transactions = useTransactions()
  const { user } = useAuth()
  const [newCategory, setNewCategory] = useState('')
  const [saved, setSaved] = useState(false)

  const [businessName, setBusinessName] = useState('')
  const [businessStartDate, setBusinessStartDate] = useState('2026-06-01')
  const [incomeTaxRate, setIncomeTaxRate] = useState('')
  const [selfEmploymentRate, setSelfEmploymentRate] = useState('')
  const [quarterlyRemindersEnabled, setQuarterlyRemindersEnabled] = useState(true)
  const [importMessage, setImportMessage] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (settings) {
      setBusinessName(settings.businessName)
      setBusinessStartDate(settings.businessStartDate ?? '2026-06-01')
      setIncomeTaxRate(String(settings.incomeTaxRate))
      setSelfEmploymentRate(String(settings.selfEmploymentRate))
      setQuarterlyRemindersEnabled(settings.quarterlyRemindersEnabled)
    }
  }, [settings])

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    await updateSettings({
      businessName,
      businessStartDate,
      incomeTaxRate: parseFloat(incomeTaxRate) || ONTARIO_SOLE_PROP_TAX.incomeTaxRate,
      selfEmploymentRate: parseFloat(selfEmploymentRate) || ONTARIO_SOLE_PROP_TAX.cppRate,
      quarterlyRemindersEnabled,
      dismissedReminderKey: quarterlyRemindersEnabled ? settings?.dismissedReminderKey ?? null : null,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleAddCategory = async () => {
    const name = newCategory.trim()
    if (!name) return
    await addCategory(name)
    setNewCategory('')
  }

  const handleExportJson = async () => {
    const data = {
      exportedAt: new Date().toISOString(),
      settings: await db.settings.toArray(),
      categories: await db.categories.toArray(),
      transactions: await db.transactions.toArray(),
      receipts: await db.receipts.toArray().then((r) =>
        r.map(({ imageData: _, ...rest }) => rest),
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
    const text = await file.text()
    const preview = analyzeExpensifyCsv(text, businessStartDate)
    const result = await importExpensifyCsv(text, businessStartDate)
    setImportMessage(
      `${summarizeImportResult(result)} Preview had ${preview.business} business / ${preview.personal} personal from ${preview.totalRows} rows.`,
    )
  }

  const handleReloadJuneData = async () => {
    const result = await seedJune2026BusinessData()
    setImportMessage(result.messages.join(' ') + ` (${result.duplicates} already existed.)`)
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  const combinedRate = (parseFloat(incomeTaxRate) || 0) + (parseFloat(selfEmploymentRate) || 0)

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm text-slate-400 mt-0.5">Business info, tax rates, sync, and exports</p>
      </header>

      <SupabaseAuthPanel />

      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
        <h2 className="text-sm font-semibold text-slate-300 mb-4">Business Profile</h2>
        <form onSubmit={handleSaveSettings} className="space-y-4">
          <div>
            <FieldLabel>Business Name</FieldLabel>
            <TextInput value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
          </div>

          <div>
            <FieldLabel>Business Start Date</FieldLabel>
            <TextInput
              type="date"
              value={businessStartDate}
              onChange={(e) => setBusinessStartDate(e.target.value)}
            />
            <p className="text-xs text-slate-500 mt-1">
              Expensify imports only include expenses on or after this date.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Federal + Ontario Tax (%)</FieldLabel>
              <TextInput
                type="number"
                step="0.1"
                min="0"
                max="50"
                value={incomeTaxRate}
                onChange={(e) => setIncomeTaxRate(e.target.value)}
              />
            </div>
            <div>
              <FieldLabel>CPP Contributions (%)</FieldLabel>
              <TextInput
                type="number"
                step="0.1"
                min="0"
                max="50"
                value={selfEmploymentRate}
                onChange={(e) => setSelfEmploymentRate(e.target.value)}
              />
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={quarterlyRemindersEnabled}
              onChange={(e) => setQuarterlyRemindersEnabled(e.target.checked)}
              className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-brand-500 focus:ring-brand-500"
            />
            <span className="text-sm text-slate-300">
              CRA instalment reminders (Mar 15, Jun 15, Sep 15, Dec 15)
            </span>
          </label>

          <div className="rounded-xl bg-amber-950/30 border border-amber-900/40 p-3 flex gap-2">
            <Info size={16} className="text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-100/80">
              Combined tax reserve: <strong>{combinedRate.toFixed(2)}%</strong> (
              {ONTARIO_SOLE_PROP_TAX.incomeTaxRate}% income + {ONTARIO_SOLE_PROP_TAX.cppRate}% CPP).
              {getOntarioTaxExplanation()} Meals are 50% deductible.
            </p>
          </div>

          <PrimaryButton type="submit">{saved ? 'Saved!' : 'Save Settings'}</PrimaryButton>
        </form>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
        <h2 className="text-sm font-semibold text-slate-300 mb-3">Expense Categories</h2>
        <div className="flex gap-2 mb-4">
          <TextInput
            placeholder="New category name"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="flex-1"
          />
          <GhostButton type="button" onClick={handleAddCategory} className="shrink-0">
            <Plus size={18} />
          </GhostButton>
        </div>
        <div className="space-y-2">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-800/50 px-3 py-2.5"
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: cat.color }}
                />
                <span className="text-sm text-slate-200">{cat.name}</span>
                {cat.isDefault && (
                  <span className="text-[10px] text-slate-500">default</span>
                )}
              </div>
              {!cat.isDefault && (
                <button
                  type="button"
                  onClick={() => deleteCategory(cat.id)}
                  className="p-1 text-slate-500 hover:text-red-400"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <RecordKeepingTips />

      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
        <h2 className="text-sm font-semibold text-slate-300">Import from Expensify</h2>
        <p className="text-xs text-slate-500">
          Duplicates are blocked automatically. Personal expenses are filtered out.
        </p>
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
        <GhostButton
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex items-center justify-center gap-2"
        >
          <Upload size={16} />
          Import Expensify CSV
        </GhostButton>
        <GhostButton
          type="button"
          onClick={handleReloadJuneData}
          className="w-full flex items-center justify-center gap-2"
        >
          <Database size={16} />
          Reload June 2026 Business Data
        </GhostButton>
        {importMessage && <p className="text-xs text-brand-300">{importMessage}</p>}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
        <h2 className="text-sm font-semibold text-slate-300">Export for Accountant</h2>
        <p className="text-xs text-slate-500">
          {transactions.length} transactions stored {user ? 'locally and in cloud' : 'locally'}.
        </p>
        <GhostButton
          type="button"
          onClick={handleExportCsv}
          className="w-full flex items-center justify-center gap-2"
        >
          <FileSpreadsheet size={16} />
          Export Transactions (CSV)
        </GhostButton>
        <GhostButton
          type="button"
          onClick={handleExportJson}
          className="w-full flex items-center justify-center gap-2"
        >
          <Download size={16} />
          Export Full Backup (JSON)
        </GhostButton>
        {settings.lastSyncedAt && (
          <p className="text-[10px] text-slate-600 text-center">
            Last cloud sync: {new Date(settings.lastSyncedAt).toLocaleString()}
          </p>
        )}
      </section>

      <p className="text-center text-xs text-slate-600 pb-4">
        Junk Of Urs Bookkeeper · Offline-first PWA
      </p>
    </div>
  )
}

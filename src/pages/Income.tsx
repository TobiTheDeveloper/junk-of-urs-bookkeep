import { useState } from 'react'
import { Plus, Briefcase, Truck, Trash2 } from 'lucide-react'
import { Modal } from '../components/Modal'
import {
  EmptyState,
  FieldLabel,
  PrimaryButton,
  TextArea,
  TextInput,
} from '../components/FormFields'
import { addTransaction, deleteTransaction, useSettings, useTransactions } from '../hooks/useData'
import { formatCurrency, formatDate, todayISO } from '../lib/format'
import type { IncomeSource } from '../types'

export function IncomePage() {
  const transactions = useTransactions()
  const settings = useSettings()
  const [modalOpen, setModalOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO())
  const [description, setDescription] = useState('')
  const [client, setClient] = useState('')
  const [incomeSource, setIncomeSource] = useState<IncomeSource>('subcontractor')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const incomeList = transactions.filter((t) => t.type === 'income')
  const currency = settings?.currency ?? 'USD'

  const resetForm = () => {
    setAmount('')
    setDate(todayISO())
    setDescription('')
    setClient('')
    setIncomeSource('subcontractor')
    setNotes('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = parseFloat(amount)
    if (!parsed || parsed <= 0) return

    setSaving(true)
    try {
      await addTransaction({
        type: 'income',
        amount: parsed,
        date,
        description,
        categoryId: null,
        incomeSource,
        vendor: '',
        client,
        receiptId: null,
        isTaxDeductible: false,
        notes,
        importKey: null,
      })
      resetForm()
      setModalOpen(false)
    } finally {
      setSaving(false)
    }
  }

  const sourceLabel = (source: IncomeSource | null) => {
    if (source === 'subcontractor') return 'Subcontractor'
    if (source === 'junk_removal') return 'Junk Removal'
    return 'Other'
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Income</h1>
          <p className="text-sm text-slate-400 mt-0.5">Track payments from gigs & subcontract work</p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold px-4 py-2.5 transition-colors"
        >
          <Plus size={18} />
          Add
        </button>
      </header>

      {incomeList.length === 0 ? (
        <EmptyState
          title="No income recorded yet"
          description="Log subcontractor payments and junk removal gig payments here."
        />
      ) : (
        <div className="space-y-2">
          {incomeList.map((tx) => (
            <div
              key={tx.id}
              className="rounded-xl border border-slate-800 bg-slate-900/50 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {tx.incomeSource === 'subcontractor' ? (
                      <Briefcase size={14} className="text-indigo-400 shrink-0" />
                    ) : (
                      <Truck size={14} className="text-lime-400 shrink-0" />
                    )}
                    <span className="text-xs font-medium text-slate-400">
                      {sourceLabel(tx.incomeSource)}
                    </span>
                  </div>
                  <p className="font-semibold text-white mt-1 truncate">
                    {tx.description || 'Payment received'}
                  </p>
                  {tx.client && (
                    <p className="text-sm text-slate-400 truncate">From: {tx.client}</p>
                  )}
                  <p className="text-xs text-slate-500 mt-1">{formatDate(tx.date)}</p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className="text-lg font-bold text-emerald-400">
                    +{formatCurrency(tx.amount, currency)}
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteTransaction(tx.id)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/30"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Income">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <FieldLabel>Income Source</FieldLabel>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIncomeSource('subcontractor')}
                className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-sm ${
                  incomeSource === 'subcontractor'
                    ? 'border-indigo-500 bg-indigo-950/40 text-white'
                    : 'border-slate-700 text-slate-400'
                }`}
              >
                <Briefcase size={16} /> Subcontractor Work
              </button>
              <button
                type="button"
                onClick={() => setIncomeSource('junk_removal')}
                className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-sm ${
                  incomeSource === 'junk_removal'
                    ? 'border-lime-500 bg-lime-950/40 text-white'
                    : 'border-slate-700 text-slate-400'
                }`}
              >
                <Truck size={16} /> Junk Removal Gig
              </button>
            </div>
          </div>

          <div>
            <FieldLabel>Amount</FieldLabel>
            <TextInput
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div>
            <FieldLabel>Date Received</FieldLabel>
            <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>

          <div>
            <FieldLabel>Description</FieldLabel>
            <TextInput
              placeholder="e.g. Weekly subcontractor payment"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div>
            <FieldLabel>Client / Company</FieldLabel>
            <TextInput
              placeholder="Who paid you?"
              value={client}
              onChange={(e) => setClient(e.target.value)}
            />
          </div>

          <div>
            <FieldLabel>Notes</FieldLabel>
            <TextArea rows={2} placeholder="Optional notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <PrimaryButton type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save Income'}
          </PrimaryButton>
        </form>
      </Modal>
    </div>
  )
}

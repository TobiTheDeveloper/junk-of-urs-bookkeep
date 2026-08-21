import { useMemo, useState } from 'react'
import { Plus, Briefcase, Truck, Trash2, Pencil } from 'lucide-react'
import { Modal } from '../components/Modal'
import {
  EmptyState,
  FieldLabel,
  GhostButton,
  PrimaryButton,
  TextArea,
  TextInput,
} from '../components/FormFields'
import {
  addTransaction,
  deleteTransaction,
  updateTransaction,
  useSettings,
  useTransactions,
} from '../hooks/useData'
import { displayCurrency, formatCurrency, formatDate, todayISO } from '../lib/format'
import { roundCents } from '../lib/money'
import type { IncomeSource, Transaction } from '../types'

const emptyForm = {
  amount: '',
  date: todayISO(),
  description: '',
  client: '',
  incomeSource: 'subcontractor' as IncomeSource,
  notes: '',
}

export function IncomePage() {
  const transactions = useTransactions()
  const settings = useSettings()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const incomeList = transactions.filter((t) => t.type === 'income')
  const currency = displayCurrency(settings?.currency)
  const monthTotal = useMemo(() => {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    return roundCents(
      incomeList
        .filter((t) => {
          const d = new Date(t.date + 'T12:00:00')
          return d.getFullYear() === year && d.getMonth() + 1 === month
        })
        .reduce((sum, t) => sum + t.amount, 0),
    )
  }, [incomeList])

  const openAdd = () => {
    setEditing(null)
    setForm({ ...emptyForm, date: todayISO() })
    setModalOpen(true)
  }

  const openEdit = (tx: Transaction) => {
    setEditing(tx)
    setForm({
      amount: tx.amount.toFixed(2),
      date: tx.date,
      description: tx.description,
      client: tx.client,
      incomeSource: tx.incomeSource ?? 'subcontractor',
      notes: tx.notes,
    })
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditing(null)
    setForm({ ...emptyForm, date: todayISO() })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = roundCents(parseFloat(form.amount))
    if (!parsed || parsed <= 0) return

    setSaving(true)
    try {
      if (editing) {
        await updateTransaction(editing.id, {
          amount: parsed,
          date: form.date,
          description: form.description,
          client: form.client,
          incomeSource: form.incomeSource,
          notes: form.notes,
        })
      } else {
        await addTransaction({
          type: 'income',
          amount: parsed,
          date: form.date,
          description: form.description,
          categoryId: null,
          incomeSource: form.incomeSource,
          vendor: '',
          client: form.client,
          receiptId: null,
          isTaxDeductible: false,
          notes: form.notes,
          importKey: null,
        })
      }
      closeModal()
    } catch (err) {
      console.error('Failed to save income:', err)
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    try {
      await deleteTransaction(pendingDelete.id)
    } catch (err) {
      console.error('Failed to delete income:', err)
    } finally {
      setPendingDelete(null)
    }
  }

  const sourceLabel = (source: IncomeSource | null) => {
    if (source === 'subcontractor') return 'Stage / subcontract'
    if (source === 'junk_removal') return 'Junk Of Urs'
    return 'Other'
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Income</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Stage subcontract and Junk Of Urs jobs. Both are business income.
          </p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold px-4 py-2.5 transition-colors"
        >
          <Plus size={18} />
          Add
        </button>
      </header>

      {incomeList.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-slate-400">This month</span>
          <span className="text-lg font-bold text-emerald-400 tabular-nums">
            {formatCurrency(monthTotal, currency)}
          </span>
        </div>
      )}

      {incomeList.length === 0 ? (
        <EmptyState
          title="No income recorded yet"
          description="Log Stage pay and junk-removal jobs. Both count as Junk Of Urs self-employment income."
        />
      ) : (
        <div className="space-y-2">
          {incomeList.map((tx) => (
            <div
              key={tx.id}
              className="rounded-xl border border-slate-800 bg-slate-900/50 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={() => openEdit(tx)}
                  className="min-w-0 flex-1 text-left"
                >
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
                </button>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className="text-lg font-bold text-emerald-400 tabular-nums">
                    +{formatCurrency(tx.amount, currency)}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(tx)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-sky-400 hover:bg-sky-950/30"
                      aria-label="Edit income"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(tx)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/30"
                      aria-label="Delete income"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? 'Edit income' : 'Add income'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <FieldLabel>Where did this money come from?</FieldLabel>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, incomeSource: 'subcontractor' }))}
                className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-sm ${
                  form.incomeSource === 'subcontractor'
                    ? 'border-indigo-500 bg-indigo-950/40 text-white'
                    : 'border-slate-700 text-slate-400'
                }`}
              >
                <Briefcase size={16} /> Stage / subcontract
              </button>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, incomeSource: 'junk_removal' }))}
                className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-sm ${
                  form.incomeSource === 'junk_removal'
                    ? 'border-lime-500 bg-lime-950/40 text-white'
                    : 'border-slate-700 text-slate-400'
                }`}
              >
                <Truck size={16} /> Junk Of Urs
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              Stage demolition/removal subcontracting is T4A business income for this sole prop —
              not a T4 job. Both sources are taxed together.
            </p>
          </div>

          <div>
            <FieldLabel>Amount received (CAD)</FieldLabel>
            <TextInput
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              required
            />
            {settings?.hstRegistered && (
              <p className="text-[11px] text-slate-500 mt-1.5">
                {settings.amountsIncludeHst
                  ? 'Includes 13% HST — income tax is calculated on the amount before HST.'
                  : 'Enter the amount before HST. HST collected is tracked separately.'}
              </p>
            )}
          </div>

          <div>
            <FieldLabel>Date received</FieldLabel>
            <TextInput
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              required
            />
          </div>

          <div>
            <FieldLabel>Description</FieldLabel>
            <TextInput
              placeholder="e.g. Invoice #012 — Stage weekly subcontract"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          <div>
            <FieldLabel>Client / company</FieldLabel>
            <TextInput
              placeholder={
                form.incomeSource === 'subcontractor' ? 'Stage' : 'Customer name'
              }
              value={form.client}
              onChange={(e) => setForm((f) => ({ ...f, client: e.target.value }))}
            />
          </div>

          <div>
            <FieldLabel>Notes</FieldLabel>
            <TextArea
              rows={2}
              placeholder="Optional notes"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>

          <PrimaryButton type="submit" disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Save income'}
          </PrimaryButton>
        </form>
      </Modal>

      <Modal
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        title="Delete this payment?"
      >
        <p className="text-sm text-slate-300">
          {pendingDelete
            ? `${formatCurrency(pendingDelete.amount, currency)} on ${formatDate(pendingDelete.date)} will be removed.`
            : ''}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <GhostButton type="button" onClick={() => setPendingDelete(null)}>
            Keep it
          </GhostButton>
          <button
            type="button"
            onClick={confirmDelete}
            className="w-full rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold py-3 px-4"
          >
            Delete
          </button>
        </div>
      </Modal>
    </div>
  )
}

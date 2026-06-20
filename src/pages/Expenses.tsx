import { useState } from 'react'
import { Plus, Trash2, Receipt } from 'lucide-react'
import { Modal } from '../components/Modal'
import { CategoryPicker } from '../components/CategoryPicker'
import { ReceiptCapture } from '../components/ReceiptCapture'
import {
  EmptyState,
  FieldLabel,
  PrimaryButton,
  TextArea,
  TextInput,
} from '../components/FormFields'
import {
  addReceipt,
  addTransaction,
  deleteTransaction,
  useCategories,
  useReceipts,
  useSettings,
  useTransactions,
} from '../hooks/useData'
import { formatCurrency, formatDate, todayISO } from '../lib/format'

export function ExpensesPage() {
  const transactions = useTransactions()
  const categories = useCategories()
  const receipts = useReceipts()
  const settings = useSettings()
  const [modalOpen, setModalOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO())
  const [description, setDescription] = useState('')
  const [vendor, setVendor] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [isTaxDeductible, setIsTaxDeductible] = useState(true)
  const [notes, setNotes] = useState('')
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  const [receiptData, setReceiptData] = useState<{
    dataUrl: string
    mimeType: string
    fileName: string
  } | null>(null)
  const [saving, setSaving] = useState(false)

  const expenseList = transactions.filter((t) => t.type === 'expense')
  const currency = settings?.currency ?? 'USD'

  const getCategoryName = (id: string | null) =>
    categories.find((c) => c.id === id)?.name ?? 'Uncategorized'

  const resetForm = () => {
    setAmount('')
    setDate(todayISO())
    setDescription('')
    setVendor('')
    setCategoryId(categories[0]?.id ?? '')
    setIsTaxDeductible(true)
    setNotes('')
    setReceiptPreview(null)
    setReceiptData(null)
  }

  const openModal = () => {
    if (!categoryId && categories[0]) setCategoryId(categories[0].id)
    setModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = parseFloat(amount)
    if (!parsed || parsed <= 0 || !categoryId) return

    setSaving(true)
    try {
      const tx = await addTransaction({
        type: 'expense',
        amount: parsed,
        date,
        description,
        categoryId,
        incomeSource: null,
        vendor,
        client: '',
        receiptId: null,
        isTaxDeductible,
        notes,
        importKey: null,
      })

      if (receiptData) {
        await addReceipt(tx.id, receiptData.dataUrl, receiptData.mimeType, receiptData.fileName)
      }

      resetForm()
      setModalOpen(false)
    } finally {
      setSaving(false)
    }
  }

  const hasReceipt = (receiptId: string | null) =>
    receiptId && receipts.some((r) => r.id === receiptId)

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Expenses</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Track costs with categories. No receipt? Use notes — bank statements count.
          </p>
        </div>
        <button
          type="button"
          onClick={openModal}
          className="flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold px-4 py-2.5 transition-colors"
        >
          <Plus size={18} />
          Add
        </button>
      </header>

      {expenseList.length === 0 ? (
        <EmptyState
          title="No expenses recorded yet"
          description="Log fuel, dump fees, tools, and other business costs."
        />
      ) : (
        <div className="space-y-2">
          {expenseList.map((tx) => {
            const cat = categories.find((c) => c.id === tx.categoryId)
            return (
              <div
                key={tx.id}
                className="rounded-xl border border-slate-800 bg-slate-900/50 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {cat && (
                        <span
                          className="inline-block w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                      )}
                      <span className="text-xs font-medium text-slate-400">
                        {getCategoryName(tx.categoryId)}
                      </span>
                      {hasReceipt(tx.receiptId) && (
                        <Receipt size={12} className="text-brand-400" />
                      )}
                    </div>
                    <p className="font-semibold text-white mt-1 truncate">
                      {tx.description || tx.vendor || 'Business expense'}
                    </p>
                    {tx.vendor && tx.description && (
                      <p className="text-sm text-slate-400 truncate">{tx.vendor}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-slate-500">{formatDate(tx.date)}</p>
                      {tx.isTaxDeductible && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 font-medium">
                          Deductible
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className="text-lg font-bold text-orange-400">
                      -{formatCurrency(tx.amount, currency)}
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
            )
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Add Expense">
        <form onSubmit={handleSubmit} className="space-y-4">
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
            <FieldLabel>Date</FieldLabel>
            <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>

          <div>
            <FieldLabel>Category</FieldLabel>
            <CategoryPicker categories={categories} value={categoryId} onChange={setCategoryId} />
          </div>

          <div>
            <FieldLabel>Description</FieldLabel>
            <TextInput
              placeholder="What was this expense for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div>
            <FieldLabel>Vendor / Store</FieldLabel>
            <TextInput
              placeholder="e.g. Shell, Home Depot, Transfer Station"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
            />
          </div>

          <div>
            <FieldLabel>Receipt Photo</FieldLabel>
            <ReceiptCapture
              preview={receiptPreview}
              onCapture={(dataUrl, mimeType, fileName) => {
                setReceiptPreview(dataUrl)
                setReceiptData({ dataUrl, mimeType, fileName })
              }}
              onClear={() => {
                setReceiptPreview(null)
                setReceiptData(null)
              }}
            />
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isTaxDeductible}
              onChange={(e) => setIsTaxDeductible(e.target.checked)}
              className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-brand-500 focus:ring-brand-500"
            />
            <span className="text-sm text-slate-300">Tax deductible business expense</span>
          </label>

          <div>
            <FieldLabel>Notes</FieldLabel>
            <TextArea
              rows={2}
              placeholder="Optional — e.g. Proof: TD Visa statement Jun 14"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <PrimaryButton type="submit" disabled={saving || !categoryId}>
            {saving ? 'Saving…' : 'Save Expense'}
          </PrimaryButton>
        </form>
      </Modal>
    </div>
  )
}

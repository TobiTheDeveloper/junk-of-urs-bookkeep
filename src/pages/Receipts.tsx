import { useMemo, useState } from 'react'
import { Receipt, Search } from 'lucide-react'
import { EmptyState, TextInput } from '../components/FormFields'
import { useCategories, useReceipts, useSettings, useTransactions } from '../hooks/useData'
import { formatCurrency, formatDate } from '../lib/format'

export function ReceiptsPage() {
  const receipts = useReceipts()
  const transactions = useTransactions()
  const categories = useCategories()
  const settings = useSettings()
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const currency = settings?.currency ?? 'USD'

  const receiptItems = useMemo(() => {
    return receipts
      .map((receipt) => {
        const tx = transactions.find((t) => t.id === receipt.transactionId)
        if (!tx) return null
        const category = categories.find((c) => c.id === tx.categoryId)
        return { receipt, tx, category }
      })
      .filter(Boolean) as {
      receipt: (typeof receipts)[0]
      tx: (typeof transactions)[0]
      category: (typeof categories)[0] | undefined
    }[]
  }, [receipts, transactions, categories])

  const filtered = receiptItems.filter(({ tx, category }) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      tx.description.toLowerCase().includes(q) ||
      tx.vendor.toLowerCase().includes(q) ||
      category?.name.toLowerCase().includes(q) ||
      receiptItems.find((r) => r.tx.id === tx.id)?.receipt.fileName.toLowerCase().includes(q)
    )
  })

  const selected = selectedId
    ? receiptItems.find((r) => r.receipt.id === selectedId)
    : null

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-white">Receipts</h1>
        <p className="text-sm text-slate-400 mt-0.5">
          All receipt photos attached to your expenses
        </p>
      </header>

      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <TextInput
          placeholder="Search receipts…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No receipts yet"
          description="Attach receipt photos when adding expenses to keep records for tax time."
        />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map(({ receipt, tx, category }) => (
            <button
              key={receipt.id}
              type="button"
              onClick={() => setSelectedId(receipt.id)}
              className="text-left rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden hover:border-brand-700 transition-colors"
            >
              <div className="aspect-[4/3] bg-slate-800">
                <img
                  src={receipt.imageData}
                  alt={tx.description || 'Receipt'}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-3">
                <p className="text-sm font-medium text-white truncate">
                  {tx.description || tx.vendor || 'Expense'}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">{formatDate(tx.date)}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-slate-400 truncate">{category?.name}</span>
                  <span className="text-sm font-semibold text-orange-400">
                    {formatCurrency(tx.amount, currency)}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <button
            type="button"
            className="absolute inset-0 bg-black/80"
            onClick={() => setSelectedId(null)}
            aria-label="Close"
          />
          <div className="relative w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-slate-900 border border-slate-700">
            <div className="p-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Receipt size={18} className="text-brand-400" />
                <div>
                  <p className="font-semibold text-white">
                    {selected.tx.description || selected.tx.vendor || 'Receipt'}
                  </p>
                  <p className="text-sm text-slate-400">
                    {formatDate(selected.tx.date)} · {formatCurrency(selected.tx.amount, currency)}
                  </p>
                </div>
              </div>
            </div>
            <img
              src={selected.receipt.imageData}
              alt="Receipt full view"
              className="w-full object-contain max-h-[60dvh] bg-black"
            />
            <div className="p-4 space-y-1 text-sm text-slate-400">
              {selected.category && <p>Category: {selected.category.name}</p>}
              {selected.tx.vendor && <p>Vendor: {selected.tx.vendor}</p>}
              {selected.tx.notes && <p>Notes: {selected.tx.notes}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

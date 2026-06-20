import { FileText, Gauge, Landmark, Receipt } from 'lucide-react'

export function RecordKeepingTips() {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
      <h2 className="text-sm font-semibold text-slate-300 mb-2">No receipt? You can still keep records</h2>
      <p className="text-xs text-slate-500 mb-3">
        CRA accepts reasonable supporting documents — not every expense needs a paper receipt.
      </p>
      <ul className="space-y-2.5 text-xs text-slate-400">
        <li className="flex gap-2">
          <Landmark size={14} className="text-brand-400 shrink-0 mt-0.5" />
          <span>
            <strong className="text-slate-300">Bank/credit card statement</strong> showing date, vendor,
            and amount (you already have this via Expensify).
          </span>
        </li>
        <li className="flex gap-2">
          <Gauge size={14} className="text-brand-400 shrink-0 mt-0.5" />
          <span>
            <strong className="text-slate-300">Mileage log</strong> — date, destination, business purpose,
            km or dollar total (your $760 entry counts).
          </span>
        </li>
        <li className="flex gap-2">
          <FileText size={14} className="text-brand-400 shrink-0 mt-0.5" />
          <span>
            <strong className="text-slate-300">Invoices & contracts</strong> — subcontractor invoices,
            junk removal job details, email confirmations.
          </span>
        </li>
        <li className="flex gap-2">
          <Receipt size={14} className="text-brand-400 shrink-0 mt-0.5" />
          <span>
            Add notes on each expense (e.g. &quot;Proof: TD Visa Jun 14&quot;) and attach a photo later
            when you find one — tap the expense in Receipts tab anytime.
          </span>
        </li>
      </ul>
    </section>
  )
}

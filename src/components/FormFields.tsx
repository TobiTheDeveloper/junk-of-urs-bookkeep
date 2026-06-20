import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-slate-300 mb-1.5">{children}</label>
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent ${props.className ?? ''}`}
    />
  )
}

export function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent ${props.className ?? ''}`}
    />
  )
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none ${props.className ?? ''}`}
    />
  )
}

export function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`w-full rounded-xl bg-brand-600 hover:bg-brand-500 active:bg-brand-700 text-white font-semibold py-3 px-4 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${props.className ?? ''}`}
    />
  )
}

export function GhostButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium py-2.5 px-4 transition-colors ${props.className ?? ''}`}
    />
  )
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="text-center py-12 px-4">
      <p className="text-slate-300 font-medium">{title}</p>
      <p className="text-sm text-slate-500 mt-1">{description}</p>
    </div>
  )
}

import type { Category } from '../types'

interface CategoryPickerProps {
  categories: Category[]
  value: string
  onChange: (id: string) => void
}

export function CategoryPicker({ categories, value, onChange }: CategoryPickerProps) {
  return (
    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
      {categories.map((cat) => (
        <button
          key={cat.id}
          type="button"
          onClick={() => onChange(cat.id)}
          className={`text-left rounded-xl border px-3 py-2.5 text-sm transition-all ${
            value === cat.id
              ? 'border-brand-500 bg-brand-950/50 text-white ring-1 ring-brand-500'
              : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-600'
          }`}
        >
          <span
            className="inline-block w-2 h-2 rounded-full mr-2"
            style={{ backgroundColor: cat.color }}
          />
          {cat.name}
        </button>
      ))}
    </div>
  )
}

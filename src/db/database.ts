import Dexie, { type EntityTable } from 'dexie'
import { normalizeCategoryName, removeDuplicateCategories } from '../lib/dedupe'
import type { Category, Receipt, Settings, Transaction } from '../types'

export const DEFAULT_CATEGORIES: Omit<Category, 'id' | 'updatedAt'>[] = [
  { name: 'Fuel & Gas', icon: 'fuel', color: '#f97316', isDefault: true },
  { name: 'Mileage', icon: 'gauge', color: '#eab308', isDefault: true },
  { name: 'Travel & Rides', icon: 'car', color: '#06b6d4', isDefault: true },
  { name: 'Vehicle Maintenance', icon: 'wrench', color: '#6366f1', isDefault: true },
  { name: 'Dump & Disposal Fees', icon: 'trash', color: '#84cc16', isDefault: true },
  { name: 'Equipment & Tools', icon: 'hammer', color: '#0ea5e9', isDefault: true },
  { name: 'Insurance', icon: 'shield', color: '#8b5cf6', isDefault: true },
  { name: 'Marketing', icon: 'megaphone', color: '#ec4899', isDefault: true },
  { name: 'Phone & Internet', icon: 'phone', color: '#14b8a6', isDefault: true },
  { name: 'Office & Admin', icon: 'file', color: '#64748b', isDefault: true },
  { name: 'Supplies', icon: 'package', color: '#a16207', isDefault: true },
  { name: 'Meals (50% deductible)', icon: 'utensils', color: '#f43f5e', isDefault: true },
  { name: 'Subcontractor Pay', icon: 'users', color: '#a855f7', isDefault: true },
  { name: 'Other', icon: 'more', color: '#94a3b8', isDefault: true },
]

export const DEFAULT_SETTINGS: Settings = {
  id: 'main',
  businessName: 'Junk Of Urs',
  businessStartDate: '2026-06-01',
  incomeTaxRate: 25,
  selfEmploymentRate: 0,
  fiscalYearStart: 1,
  currency: 'CAD',
  quarterlyRemindersEnabled: true,
  dismissedReminderKey: null,
  lastSyncedAt: null,
  updatedAt: new Date().toISOString(),
}

class BookkeepDB extends Dexie {
  transactions!: EntityTable<Transaction, 'id'>
  categories!: EntityTable<Category, 'id'>
  receipts!: EntityTable<Receipt, 'id'>
  settings!: EntityTable<Settings, 'id'>

  constructor() {
    super('junkOfUrsBookkeep')
    this.version(1).stores({
      transactions: 'id, type, date, categoryId, incomeSource, receiptId, createdAt',
      categories: 'id, name, isDefault',
      receipts: 'id, transactionId, createdAt',
      settings: 'id',
    })
    this.version(2).stores({
      transactions: 'id, type, date, categoryId, incomeSource, receiptId, createdAt, updatedAt',
      categories: 'id, name, isDefault, updatedAt',
      receipts: 'id, transactionId, createdAt, updatedAt',
      settings: 'id, updatedAt',
    }).upgrade(async (tx) => {
      const now = new Date().toISOString()
      const transactions = await tx.table('transactions').toArray()
      for (const row of transactions) {
        await tx.table('transactions').update(row.id, {
          updatedAt: row.updatedAt ?? row.createdAt ?? now,
        })
      }
      const categories = await tx.table('categories').toArray()
      for (const row of categories) {
        await tx.table('categories').update(row.id, { updatedAt: row.updatedAt ?? now })
      }
      const receipts = await tx.table('receipts').toArray()
      for (const row of receipts) {
        await tx.table('receipts').update(row.id, {
          updatedAt: row.updatedAt ?? row.createdAt ?? now,
          storagePath: row.storagePath ?? null,
        })
      }
      const settings = await tx.table('settings').get('main')
      if (settings) {
        await tx.table('settings').update('main', {
          updatedAt: settings.updatedAt ?? now,
          quarterlyRemindersEnabled: settings.quarterlyRemindersEnabled ?? true,
          dismissedReminderKey: settings.dismissedReminderKey ?? null,
          lastSyncedAt: settings.lastSyncedAt ?? null,
        })
      }
    })
    this.version(3).stores({
      transactions:
        'id, type, date, categoryId, incomeSource, receiptId, importKey, createdAt, updatedAt',
      categories: 'id, name, isDefault, updatedAt',
      receipts: 'id, transactionId, createdAt, updatedAt',
      settings: 'id, updatedAt',
    }).upgrade(async (tx) => {
      const now = new Date().toISOString()
      const transactions = await tx.table('transactions').toArray()
      for (const row of transactions) {
        await tx.table('transactions').update(row.id, {
          importKey: row.importKey ?? null,
        })
      }
      const settings = await tx.table('settings').get('main')
      if (settings) {
        await tx.table('settings').update('main', {
          businessStartDate: settings.businessStartDate ?? '2026-06-01',
          currency: settings.currency === 'USD' ? 'CAD' : (settings.currency ?? 'CAD'),
        })
      }
      const categoryNames = new Set((await tx.table('categories').toArray()).map((c) => c.name))
      for (const cat of ['Mileage', 'Travel & Rides']) {
        if (!categoryNames.has(cat)) {
          const def = DEFAULT_CATEGORIES.find((c) => c.name === cat)
          if (def) {
            await tx.table('categories').add({
              ...def,
              id: crypto.randomUUID(),
              updatedAt: now,
            })
          }
        }
      }
    })
  }
}

export const db = new BookkeepDB()

export async function clearLocalUserData(): Promise<void> {
  await db.transaction('rw', db.transactions, db.receipts, db.categories, db.settings, async () => {
    await db.transactions.clear()
    await db.receipts.clear()
    await db.categories.clear()
    await db.settings.clear()
  })
}

export async function seedDatabase() {
  const categoryCount = await db.categories.count()
  if (categoryCount === 0) {
    const now = new Date().toISOString()
    await db.categories.bulkAdd(
      DEFAULT_CATEGORIES.map((cat) => ({
        ...cat,
        id: crypto.randomUUID(),
        updatedAt: now,
      })),
    )
  } else {
    const existing = await db.categories.toArray()
    const names = new Set(existing.map((c) => normalizeCategoryName(c.name)))
    const now = new Date().toISOString()
    for (const cat of DEFAULT_CATEGORIES) {
      if (!names.has(normalizeCategoryName(cat.name))) {
        await db.categories.add({ ...cat, id: crypto.randomUUID(), updatedAt: now })
      }
    }
  }

  await removeDuplicateCategories()

  const settings = await db.settings.get('main')
  if (!settings) {
    await db.settings.add(DEFAULT_SETTINGS)
  } else if (!settings.businessStartDate) {
    await db.settings.update('main', {
      businessStartDate: '2026-06-01',
      currency: settings.currency || 'CAD',
    })
  }
}

export function nowIso() {
  return new Date().toISOString()
}

export async function getCategoryIdByName(name: string): Promise<string | null> {
  const target = normalizeCategoryName(name)
  const cats = await db.categories.toArray()
  const match = cats.find((c) => normalizeCategoryName(c.name) === target)
  return match?.id ?? null
}

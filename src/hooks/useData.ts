import { useLiveQuery } from 'dexie-react-hooks'
import { db, nowIso } from '../db/database'
import { buildImportKey, findExistingTransaction } from '../lib/dedupe'
import { scheduleSync } from '../lib/sync'
import type { Category, Receipt, Settings, Transaction } from '../types'

export function useTransactions(): Transaction[] {
  return useLiveQuery(() => db.transactions.orderBy('date').reverse().toArray()) ?? []
}

export function useCategories(): Category[] {
  return useLiveQuery(() => db.categories.orderBy('name').toArray()) ?? []
}

export function useReceipts(): Receipt[] {
  return useLiveQuery(() => db.receipts.orderBy('createdAt').reverse().toArray()) ?? []
}

export function useSettings(): Settings | undefined {
  return useLiveQuery(() => db.settings.get('main'))
}

export async function addTransaction(
  data: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<Transaction> {
  const importKey = buildImportKey(data, data.importKey)
  const existing = await findExistingTransaction({ ...data, importKey })
  if (existing) return existing

  const now = nowIso()
  const transaction: Transaction = {
    ...data,
    importKey,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  }
  await db.transactions.add(transaction)
  scheduleSync()
  return transaction
}

export async function updateTransaction(id: string, updates: Partial<Transaction>) {
  await db.transactions.update(id, { ...updates, updatedAt: nowIso() })
  scheduleSync()
}

export async function deleteTransaction(id: string) {
  const tx = await db.transactions.get(id)
  if (tx?.receiptId) {
    await db.receipts.delete(tx.receiptId)
  }
  await db.transactions.delete(id)
  scheduleSync()
}

export async function addReceipt(
  transactionId: string,
  imageData: string,
  mimeType: string,
  fileName: string,
): Promise<Receipt> {
  const now = nowIso()
  const receipt: Receipt = {
    id: crypto.randomUUID(),
    transactionId,
    imageData,
    mimeType,
    fileName,
    storagePath: null,
    createdAt: now,
    updatedAt: now,
  }
  await db.receipts.add(receipt)
  await db.transactions.update(transactionId, { receiptId: receipt.id, updatedAt: now })
  scheduleSync()
  return receipt
}

export async function addCategory(name: string, icon = 'tag', color = '#64748b') {
  const category: Category = {
    id: crypto.randomUUID(),
    name,
    icon,
    color,
    isDefault: false,
    updatedAt: nowIso(),
  }
  await db.categories.add(category)
  scheduleSync()
  return category
}

export async function deleteCategory(id: string) {
  const cat = await db.categories.get(id)
  if (cat?.isDefault) return false
  await db.categories.delete(id)
  scheduleSync()
  return true
}

export async function updateSettings(updates: Partial<Settings>) {
  await db.settings.update('main', { ...updates, updatedAt: nowIso() })
  scheduleSync()
}

export async function dismissQuarterlyReminder(key: string) {
  await updateSettings({ dismissedReminderKey: key })
}

export async function attachReceiptToExisting(
  transactionId: string,
  imageData: string,
  mimeType: string,
  fileName: string,
) {
  const tx = await db.transactions.get(transactionId)
  if (!tx) return

  if (tx.receiptId) {
    await db.receipts.update(tx.receiptId, {
      imageData,
      mimeType,
      fileName,
      updatedAt: nowIso(),
    })
  } else {
    await addReceipt(transactionId, imageData, mimeType, fileName)
  }
}

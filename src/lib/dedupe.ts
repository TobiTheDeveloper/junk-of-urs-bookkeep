import { db, nowIso } from '../db/database'
import type { Transaction } from '../types'

type FingerprintInput = Pick<
  Transaction,
  'type' | 'date' | 'amount' | 'vendor' | 'client' | 'description' | 'incomeSource'
>

export function normalizeKeyPart(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function buildTransactionFingerprint(input: FingerprintInput): string {
  const amount = input.amount.toFixed(2)
  if (input.type === 'income') {
    return [
      'income',
      input.date,
      amount,
      input.incomeSource ?? 'none',
      normalizeKeyPart(input.description || input.client || 'payment'),
    ].join(':')
  }
  return ['expense', input.date, amount, normalizeKeyPart(input.vendor || input.description || 'expense')].join(
    ':',
  )
}

export function buildImportKey(input: FingerprintInput, explicitKey?: string | null): string {
  if (explicitKey) return explicitKey
  return `fp:${buildTransactionFingerprint(input)}`
}

export async function findExistingTransaction(
  input: FingerprintInput & { importKey?: string | null },
): Promise<Transaction | undefined> {
  const importKey = input.importKey ?? null
  if (importKey) {
    const byKey = await db.transactions.filter((t) => t.importKey === importKey).first()
    if (byKey) return byKey
  }

  const fingerprint = buildTransactionFingerprint(input)
  const all = await db.transactions.toArray()
  return all.find((t) => buildTransactionFingerprint(t) === fingerprint)
}

export async function backfillImportKeys(): Promise<void> {
  const all = await db.transactions.toArray()
  for (const tx of all) {
    if (tx.importKey) continue
    await db.transactions.update(tx.id, {
      importKey: buildImportKey(tx),
      updatedAt: nowIso(),
    })
  }
}

export async function removeDuplicateTransactions(): Promise<number> {
  const all = await db.transactions.toArray()
  let removed = 0

  const sorted = all.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const keepByImportKey = new Map<string, Transaction>()
  const keepByFingerprint = new Map<string, Transaction>()
  const dropIds = new Set<string>()

  for (const tx of sorted) {
    if (tx.importKey) {
      const existing = keepByImportKey.get(tx.importKey)
      if (existing) {
        dropIds.add(tx.id)
        removed++
        continue
      }
      keepByImportKey.set(tx.importKey, tx)
    }
  }

  for (const tx of sorted) {
    if (dropIds.has(tx.id)) continue

    const fp = buildTransactionFingerprint(tx)
    const existing = keepByFingerprint.get(fp)
    if (!existing) {
      keepByFingerprint.set(fp, tx)
      if (!tx.importKey) {
        await db.transactions.update(tx.id, {
          importKey: buildImportKey(tx),
          updatedAt: nowIso(),
        })
      }
      continue
    }

    const keep = tx.importKey && !existing.importKey ? tx : existing
    const drop = keep.id === tx.id ? existing : tx
    keepByFingerprint.set(fp, keep)
    dropIds.add(drop.id)
    removed++
  }

  for (const id of dropIds) {
    const tx = all.find((row) => row.id === id)
    if (tx?.receiptId) {
      await db.receipts.delete(tx.receiptId)
    }
    await db.transactions.delete(id)
  }

  return removed
}

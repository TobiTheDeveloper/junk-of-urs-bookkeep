import { clearLocalUserData, seedDatabase } from '../db/database'
import { backfillImportKeys, removeDuplicateTransactions } from './dedupe'
import { cancelScheduledSync, pullFromCloud, syncToCloud } from './sync'

let activeInit: { userId: string; promise: Promise<void> } | null = null

export function resetSessionInit() {
  activeInit = null
}

export async function initUserSession(userId: string): Promise<void> {
  if (activeInit?.userId === userId) {
    return activeInit.promise
  }

  const promise = (async () => {
    await seedDatabase()
    await pullFromCloud(userId)
    await backfillImportKeys()
    await removeDuplicateTransactions()
    await syncToCloud()
  })()

  activeInit = { userId, promise }
  return promise
}

export async function clearSessionData(): Promise<void> {
  resetSessionInit()
  cancelScheduledSync()
  await clearLocalUserData()
}

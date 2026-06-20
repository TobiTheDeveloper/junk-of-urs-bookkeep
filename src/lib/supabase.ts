import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null
  if (!client) {
    client = createClient(url!, anonKey!)
  }
  return client
}

export type Database = {
  public: {
    Tables: {
      categories: {
        Row: {
          id: string
          user_id: string
          name: string
          icon: string
          color: string
          is_default: boolean
          updated_at: string
        }
      }
      transactions: {
        Row: {
          id: string
          user_id: string
          type: 'income' | 'expense'
          amount: number
          date: string
          description: string
          category_id: string | null
          income_source: 'subcontractor' | 'junk_removal' | null
          vendor: string
          client: string
          receipt_id: string | null
          is_tax_deductible: boolean
          notes: string
          created_at: string
          updated_at: string
        }
      }
      receipts: {
        Row: {
          id: string
          user_id: string
          transaction_id: string
          storage_path: string | null
          mime_type: string
          file_name: string
          created_at: string
          updated_at: string
        }
      }
      user_settings: {
        Row: {
          user_id: string
          business_name: string
          income_tax_rate: number
          self_employment_rate: number
          fiscal_year_start: number
          currency: string
          quarterly_reminders_enabled: boolean
          dismissed_reminder_key: string | null
          last_synced_at: string | null
          updated_at: string
        }
      }
    }
  }
}

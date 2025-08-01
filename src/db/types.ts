import type { Selectable } from 'kysely'

export interface DatabaseSchema {
  history: HistoryTable
}

export interface HistoryTable {
  created_at: string
  post_all: number
  post_jp: number
  like_all: number
  like_jp: number
}

export type SelectHistory = Selectable<HistoryTable>

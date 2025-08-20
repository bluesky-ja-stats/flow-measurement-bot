import type { Selectable } from 'kysely'

export interface DatabaseSchema {
  history: HistoryTable
  history_poster: HistoryPosterTable
  tmp_poster: TmpPosterTable
}

export interface HistoryTable {
  created_at: string
  post_all: number
  post_jp: number
  like_all: number
  like_jp: number
}

export interface HistoryPosterTable {
  created_at: string
  all: number
  all_increase: number
  all_decrease: number
  jp: number
  jp_increase: number
  jp_decrease: number
}

export interface TmpPosterTable {
  date_did: string
  is_jp: string
}

export type SelectHistory = Selectable<HistoryTable>

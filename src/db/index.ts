import SQLite from 'better-sqlite3'
import type { DatabaseSchema } from './types'
import { migrationProvider } from './migration'
import { Kysely, Migrator, SqliteDialect } from 'kysely'
import { env } from '../util/config'

export async function createDB() {
  const db = new Kysely<DatabaseSchema>({
    dialect: new SqliteDialect({
      database: new SQLite(env.SQLITE_PATH),
    }),
  })
  const migrator = new Migrator({ db, provider: migrationProvider })
  const { error } = await migrator.migrateToLatest()
  if (error != null) throw error
  return db
}

export type Database=Kysely<DatabaseSchema>

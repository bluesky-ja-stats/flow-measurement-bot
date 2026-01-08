import SQLite from 'better-sqlite3'
import { Kysely, Migrator, SqliteDialect } from 'kysely'
import { migrationProvider } from './migration'
import type { DatabaseSchema } from './types'

export function createDb(location: string): Database {
  return new Kysely<DatabaseSchema>({
    dialect: new SqliteDialect({
      database: new SQLite(location),
    }),
  })
}

export const migrateToLatest = async (db: Database) => {
  const migrator = new Migrator({ db, provider: migrationProvider })
  const { error } = await migrator.migrateToLatest()
  if (error) throw error
}

export type Database=Kysely<DatabaseSchema>

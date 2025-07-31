import type { Kysely, Migration, MigrationProvider } from 'kysely'

const migrations: Record<string, Migration> = {}

export const migrationProvider: MigrationProvider = {
  async getMigrations() {
    return migrations
  },
}

migrations['001'] = {
  async up(db: Kysely<unknown>) {
    await db.schema
      .createTable('history')
      .addColumn('created_at', 'datetime', (col) => col.unique())
      .addColumn('post_all', 'int2', (col) => col.notNull())
      .addColumn('post_jp', 'int2', (col) => col.notNull())
      .addColumn('like_all', 'int2', (col) => col.notNull())
      .addColumn('like_jp', 'int2', (col) => col.notNull())
      .execute()
    await db.schema
      .createIndex('idx_history_created_at')
      .on('history')
      .column('created_at')
      .execute()
  },
  async down(db: Kysely<unknown>) {
    await db.schema.dropTable('history').execute()
  },
}
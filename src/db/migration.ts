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
      .createTable('history_poster')
      .addColumn('created_at', 'date', (col) => col.unique())
      .addColumn('all', 'int2', (col) => col.notNull())
      .addColumn('all_increase', 'int2', (col) => col.notNull())
      .addColumn('all_decrease', 'int2', (col) => col.notNull())
      .addColumn('jp', 'int2', (col) => col.notNull())
      .addColumn('jp_increase', 'int2', (col) => col.notNull())
      .addColumn('jp_decrease', 'int2', (col) => col.notNull())
      .execute()
    await db.schema
      .createTable('tmp_poster')
      .addColumn('date_did', 'varchar', (col) => col.unique())
      .addColumn('is_jp', 'varchar', (col) => col.notNull())
      .execute()
    await db.schema
      .createIndex('idx_history_created_at')
      .on('history')
      .column('created_at')
      .execute()
    await db.schema
      .createIndex('idx_historyposter_created_at')
      .on('history_poster')
      .column('created_at')
      .execute()
  },
  async down(db: Kysely<unknown>) {
    await db.schema.dropTable('history').execute()
    await db.schema.dropTable('history_poster').execute()
    await db.schema.dropTable('tmp_poster').execute()
  },
}

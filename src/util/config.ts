import dotenv from 'dotenv'
import { cleanEnv, str, testOnly } from 'envalid'
import AtpAgent from '@atproto/api'
import { IdResolver } from '@atproto/identity'
import { type Database } from '../db'
import { type Logger } from './logger'

export interface AppContext {
  agent: AtpAgent
  db: Database
  idResolver: IdResolver
  logger: Logger
}

dotenv.config()

export const env = cleanEnv(process.env, {
  NODE_ENV: str({
    devDefault: testOnly('test'),
    choices: ['test', 'production'],
  }),
  JETSTREAM_ENDPOINT: str(),
  BLUESKY_SERVICE: str(),
  BLUESKY_IDENTIFIER: str(),
  BLUESKY_PASSWORD: str(),
  SQLITE_PATH: str(),
})

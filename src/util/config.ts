import dotenv from 'dotenv'
import { cleanEnv, str, testOnly } from 'envalid'
import AtpAgent from '@atproto/api'
import { IdResolver } from '@atproto/identity'
import { type Database } from '../db'
import { type Logger } from './logger'

export interface BotContext {
  agent: AtpAgent
  cfg: BotConfig
  db: Database
  idResolver: IdResolver
  logger: Logger
}

export interface BotConfig {
  atpAgent: AtpAgentConfig
  db: DatabaseConfig
  jetstream: JetstreamConfig
}

export interface AtpAgentConfig {
  service: string
  identifier: string
  password: string
}

export interface DatabaseConfig {
  dbLoc: string
}

export interface JetstreamConfig {
  service: string
}

console.log(`Reading environment variables...`)
dotenv.config()
export const env = cleanEnv(process.env, {
  NODE_ENV: str({
    devDefault: testOnly('test'),
    choices: ['test', 'production'],
  }),
  SQLITE_PATH: str({
    devDefault: ':memory:',
  }),
  JETSTREAM_ENDPOINT: str(),
  LOG_PATH: str({
    default: './logs'
  }),
  BLUESKY_SERVICE: str(),
  BLUESKY_IDENTIFIER: str(),
  BLUESKY_PASSWORD: str(),
})

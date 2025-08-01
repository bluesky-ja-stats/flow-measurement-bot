import { CronJob } from 'cron'
import dotenv from 'dotenv'
import { cleanEnv, str, testOnly } from 'envalid'
import { type Logger } from './logger'

export interface AppContext {
  logger: Logger
  job: CronJob
}

dotenv.config()

export const env = cleanEnv(process.env, {
  NODE_ENV: str({
    devDefault: testOnly('test'),
    choices: ['test', 'production'],
  }),
  JETSTREAM_ENDPOINT: str(),
  CRON_SCHEDULE: str(),
  BLUESKY_SERVICE: str(),
  BLUESKY_IDENTIFIER: str(),
  BLUESKY_PASSWORD: str(),
  SQLITE_PATH: str(),
})

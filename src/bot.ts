import { AtpAgent } from '@atproto/api'
import { CronJob } from 'cron'
import { main } from './job'
import { type AppContext, env } from './util/config'
import { createLogger } from './util/logger'
import { createDB } from './db'

export class Bot {
  public agent: AtpAgent
  public ctx: AppContext

  constructor(
    agent: AtpAgent,
    ctx: AppContext
  ) {
    this.agent = agent
    this.ctx = ctx
  }

  static async create() {
    const logger = createLogger(['Runner', 'Bot'])
    const db = await createDB()
    logger.info('Creating bot...')

    const agent = new AtpAgent({service: env.BLUESKY_SERVICE})

    const job = new CronJob(env.CRON_SCHEDULE, async () => await main(agent, createLogger(['Runner', 'Bot', 'Job']), db))

    const ctx: AppContext = {
      logger,
      job,
    }

    logger.info('Bot has been created!')

    return new Bot(agent, ctx)
  }

  async start() {
    this.ctx.logger.info('Starting bot...')
    await this.agent.login({
      identifier: env.BLUESKY_IDENTIFIER,
      password: env.BLUESKY_PASSWORD,
    })
    this.ctx.job.start()
    this.ctx.logger.info('Bot started')
  }

  async stop() {
    this.ctx.logger.info('Stopping bot...')
    await this.ctx.job.stop()
    await this.agent.logout()
    this.ctx.logger.info('Bot stopped')
  }
}

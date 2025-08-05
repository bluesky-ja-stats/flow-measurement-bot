import { AtpAgent } from '@atproto/api'
import { CronJob } from 'cron'
import { hourly, weekly } from './job'
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
    logger.info('Creating bot...')

    logger.info(`Creating DB => ${env.SQLITE_PATH}`)
    const db = await createDB()

    const agent = new AtpAgent({service: env.BLUESKY_SERVICE})

    const hourlyJob = new CronJob('0 0 * * * *', async () => await hourly(agent, createLogger(['Runner', 'Bot', 'HourlyJob']), db))
    const weeklyJob = new CronJob('0 0 0 * * 1', async () => await weekly(agent, createLogger(['Runner', 'Bot', 'WeeklyJob']), db))

    const ctx: AppContext = {
      logger,
      hourlyJob,
      weeklyJob,
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
    this.ctx.logger.info(`✓  Signed in as @${(await this.agent.getProfile({actor: this.agent.assertDid})).data.handle}`)
    this.ctx.hourlyJob.start()
    this.ctx.weeklyJob.start()
    this.ctx.logger.info('Bot started')
  }

  async stop() {
    this.ctx.logger.info('Stopping bot...')
    await this.ctx.hourlyJob.stop()
    await this.ctx.weeklyJob.stop()
    await this.agent.logout()
    this.ctx.logger.info('Bot stopped')
  }
}

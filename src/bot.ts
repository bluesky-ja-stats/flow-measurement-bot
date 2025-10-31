import { Jetstream } from 'atingester'
import { CronJob } from 'cron'
import { AtpAgent } from '@atproto/api'
import { IdResolver } from '@atproto/identity'
import { createDB, migrateToLatest } from './db'
import { isJa, hourly, daily, weekly, monthly, yearly } from './job'
import { type AppContext, env } from './util/config'
import { createLogger } from './util/logger'

export class Bot {
  public ctx: AppContext
  public jetstream: Jetstream
  public hourlyJob: CronJob
  public dailyJob: CronJob
  public weeklyJob: CronJob
  public monthlyJob: CronJob
  public yearlyJob: CronJob

  constructor(
    ctx: AppContext,
    jetstream: Jetstream,
    hourlyJob: CronJob,
    dailyJob: CronJob,
    weeklyJob: CronJob,
    monthlyJob: CronJob,
    yearlyJob: CronJob
  ) {
    this.ctx = ctx
    this.jetstream = jetstream
    this.hourlyJob = hourlyJob
    this.dailyJob = dailyJob
    this.weeklyJob = weeklyJob
    this.monthlyJob = monthlyJob
    this.yearlyJob = yearlyJob
  }

  static async create() {
    const logger = createLogger(['Runner', 'Bot'])
    logger.info('Creating bot...')

    logger.info(`Creating DB => ${env.SQLITE_PATH}`)
    const db = await createDB()

    const agent = new AtpAgent({service: env.BLUESKY_SERVICE})

    const jetstreamLogger = createLogger(['Runner', 'Bot', 'Jetstream'])
    const jetstream = new Jetstream({
      idResolver: new IdResolver(),
      handleEvent: async (evt) => {
        if (evt.event === 'create') {
          if (evt.collection === 'app.bsky.feed.post') {
            await db
              .insertInto('tmp_poster')
              .values({
                date_did: `${new Date().toLocaleDateString('sv-SE', {year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'JST'})}=${evt.did}`,
                is_jp: `${isJa(evt.record)}`,
              })
              .onConflict((oc) => oc
                .column('date_did')
                .where('is_jp', '=', 'false')
                .doUpdateSet({
                  is_jp: (eb) => eb.ref('excluded.is_jp')
                })
              )
              .execute()
          }
        }
      },
      onInfo: jetstreamLogger.info,
      onError: (err: Error) => jetstreamLogger.error(err.message),
      service: env.JETSTREAM_ENDPOINT,
      compress: true,
      filterCollections: ['app.bsky.feed.post'],
      excludeIdentity: true,
      excludeAccount: true,
    })

    const ctx: AppContext = {
      agent,
      db,
      logger,
    }
    
    const hourlyJob = new CronJob('0 0 * * * *', async () => await hourly({...ctx, logger: createLogger(['Runner', 'Bot', 'HourlyJob'])}))
    const dailyJob = new CronJob('5 0 0 * * *', async () => await daily({...ctx, logger: createLogger(['Runner', 'Bot', 'DailyJob'])}))
    const weeklyJob = new CronJob('0 2 0 * * 1', async () => await weekly({...ctx, logger: createLogger(['Runner', 'Bot', 'WeeklyJob'])}))
    const monthlyJob = new CronJob('0 2 0 1 * *', async () => await monthly({...ctx, logger: createLogger(['Runner', 'Bot', 'MonthlyJob'])}))
    const yearlyJob = new CronJob('0 2 0 1 1 *', async () => await yearly({...ctx, logger: createLogger(['Runner', 'Bot', 'YearlyJob'])}))

    logger.info('Bot has been created!')

    return new Bot(ctx, jetstream, hourlyJob, dailyJob, weeklyJob, monthlyJob, yearlyJob)
  }

  async start() {
    this.ctx.logger.info('Starting bot...')
    await migrateToLatest(this.ctx.db)
    await this.ctx.agent.login({
      identifier: env.BLUESKY_IDENTIFIER,
      password: env.BLUESKY_PASSWORD,
    })
    this.ctx.logger.info(`✓  Signed in as @${(await this.ctx.agent.getProfile({actor: this.ctx.agent.assertDid})).data.handle}`)
    this.jetstream.start()
    this.hourlyJob.start()
    this.dailyJob.start()
    this.weeklyJob.start()
    this.monthlyJob.start()
    this.yearlyJob.start()
    this.ctx.logger.info('Bot started')
  }

  async stop() {
    this.ctx.logger.info('Stopping bot...')
    await this.hourlyJob.stop()
    await this.dailyJob.stop()
    await this.weeklyJob.stop()
    await this.monthlyJob.stop()
    await this.yearlyJob.stop()
    await this.jetstream.destroy()
    await this.ctx.agent.logout()
    this.ctx.logger.info('Bot stopped')
  }
}

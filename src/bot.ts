import { Jetstream } from 'atingester'
import { CronJob } from 'cron'
import { AtpAgent } from '@atproto/api'
import { IdResolver, parseToAtprotoDocument } from '@atproto/identity'
import { createDb, migrateToLatest } from './db'
import { isJa, hourly, daily, weekly, monthly, yearly } from './job'
import type { BotContext, BotConfig } from './util/config'
import { createLogger } from './util/logger'

export class Bot {
  public ctx: BotContext
  public jetstream: Jetstream
  public job: {
    hourly: CronJob
    daily: CronJob
    weekly: CronJob
    monthly: CronJob
    yearly: CronJob
  }

  constructor(
    ctx: BotContext,
    jetstream: Jetstream,
    job: {
      hourly: CronJob,
      daily: CronJob,
      weekly: CronJob,
      monthly: CronJob,
      yearly: CronJob
    }
  ) {
    this.ctx = ctx
    this.jetstream = jetstream
    this.job = job
  }

  static async create(
    cfg: BotConfig
  ): Promise<Bot> {
    const logger = createLogger(['Runner', 'Bot'])
    logger.info('Creating bot...')

    logger.info(`Creating DB => ${cfg.db.dbLoc}`)
    const db = createDb(cfg.db.dbLoc)

    const agent = new AtpAgent({service: cfg.atpAgent.service})

    const idResolver = new IdResolver()

    const jetstreamLogger = createLogger(['Runner', 'Bot', 'Jetstream'])
    const jetstream = new Jetstream({
      idResolver,
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
      service: cfg.jetstream.service,
      compress: true,
      filterCollections: ['app.bsky.feed.post'],
      excludeIdentity: true,
      excludeAccount: true,
    })

    const ctx: BotContext = {
      agent,
      cfg,
      db,
      idResolver,
      logger,
    }

    const job = {
      hourly: new CronJob('0 0 * * * *', async () => await hourly({...ctx, logger: createLogger(['Runner', 'Bot', 'Job', 'Hourly'])})),
      daily: new CronJob('5 0 0 * * *', async () => await daily({...ctx, logger: createLogger(['Runner', 'Bot', 'Job', 'Daily'])})),
      weekly: new CronJob('0 2 0 * * 1', async () => await weekly({...ctx, logger: createLogger(['Runner', 'Bot', 'Job', 'Weekly'])})),
      monthly: new CronJob('0 2 0 1 * *', async () => await monthly({...ctx, logger: createLogger(['Runner', 'Bot', 'Job', 'Monthly'])})),
      yearly: new CronJob('0 2 0 1 1 *', async () => await yearly({...ctx, logger: createLogger(['Runner', 'Bot', 'Job', 'Yearly'])})),
    }

    logger.info('Bot has been created!')

    return new Bot(ctx, jetstream, job)
  }

  async start() {
    this.ctx.logger.info('Starting bot...')
    await migrateToLatest(this.ctx.db)
    await this.ctx.agent.login({
      identifier: this.ctx.cfg.atpAgent.identifier,
      password: this.ctx.cfg.atpAgent.password,
    })
    this.ctx.logger.info(`Signed in as @${await getVerifiedHandle(this.ctx.idResolver, this.ctx.agent.assertDid)}`)
    this.jetstream.start()
    this.job.hourly.start()
    this.job.daily.start()
    this.job.weekly.start()
    this.job.monthly.start()
    this.job.yearly.start()
    this.ctx.logger.info('Bot started')
  }

  async stop() {
    this.ctx.logger.info('Stopping bot...')
    await this.job.hourly.stop()
    await this.job.daily.stop()
    await this.job.weekly.stop()
    await this.job.monthly.stop()
    await this.job.yearly.stop()
    await this.jetstream.destroy()
    await this.ctx.agent.logout()
    this.ctx.logger.info('Bot stopped')
  }
}

export const getVerifiedHandle = async (idResolver: IdResolver, did: string): Promise<string | undefined> => {
  const didDoc = await idResolver.did.resolve(did)
  if (!didDoc) return undefined
  const { handle } = parseToAtprotoDocument(didDoc)
  if (!handle) return undefined
  const res = await idResolver.handle.resolve(handle)
  return res === did ? handle : undefined
}

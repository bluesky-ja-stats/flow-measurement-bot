console.log('Starting...')

import { initIngester } from 'atingester'
import { Bot } from './bot'
import { closeSignal } from './cmds/stop'
import { setupCmd } from './util/cmd'
import { type BotConfig, env } from './util/config'
import { createLogger } from './util/logger'

const run = async () => {
  const logger = createLogger(['Runner'])
  logger.info(`Running ${process.env.npm_package_name} ${process.env.npm_package_version} (${env.NODE_ENV})`)
  logger.info(`System Info: Node.js ${process.version} / ${process.platform} ${process.arch}`)
  logger.debug('DebugMode is enabled.')

  await initIngester()

  const botCfg: BotConfig = {
    atpAgent: {
      service: env.BLUESKY_SERVICE,
      identifier: env.BLUESKY_IDENTIFIER,
      password: env.BLUESKY_PASSWORD,
    },
    db: {
      dbLoc: env.SQLITE_PATH,
    },
    jetstream: {
      service: env.JETSTREAM_ENDPOINT,
    },
  }
  const bot = await Bot.create(botCfg)

  setupCmd(bot, createLogger(['Runner', 'Commander']))

  process.on('SIGHUP', async () => await closeSignal(bot, logger))
  process.on('SIGINT', async () => await closeSignal(bot, logger))
  process.on('SIGTERM', async () => await closeSignal(bot, logger))

  await bot.start()

  logger.info('Done!')
}

run()

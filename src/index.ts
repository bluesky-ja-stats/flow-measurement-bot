console.log('Starting...')

import { Bot } from './bot'
import { setupCmd } from './cmd'
import { closeSignal } from './cmds/stop'
import { env } from './util/config'
import { createLogger } from './util/logger'

const run = async () => {
  const logger = createLogger(['Runner'])
  logger.info(`Running ${process.env.npm_package_name} ${process.env.npm_package_version} (${env.NODE_ENV})`)
  logger.info(`System Info: Node.js ${process.version} / ${process.platform} ${process.arch}`)
  logger.debug('DebugMode is enabled.')

  const bot = await Bot.create()

  await bot.start()
  logger.info('Done!')

  setupCmd(bot, createLogger(['Runner', 'Commander']))

  process.on('SIGHUP', closeSignal)
  process.on('SIGINT', closeSignal)
  process.on('SIGTERM', closeSignal)
}

run()

console.log('Starting...')

import { Bot } from './bot'
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

  const closeSignal = async () => {
    logger.debug('Recieved closeSignal!')
    setTimeout(() => process.exit(1), 10000).unref()
    await bot.stop()
    process.stdout.write('\r\x1b[2K')
    process.exit(0)
  }

  process.stdin.on('data', (data) => {
    const cmd = (data.toString()).slice(0, -1)
    if (cmd === 'stop') {
      closeSignal()
    } else logger.error(`"${cmd}": command not found`)
  })

  process.on('SIGHUP', closeSignal)
  process.on('SIGINT', closeSignal)
  process.on('SIGTERM', closeSignal)
}

run()

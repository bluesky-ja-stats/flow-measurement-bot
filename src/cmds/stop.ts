import { Bot } from '../bot'
import { Logger } from '../util/logger'

export default async (bot: Bot, logger: Logger, args: string[]): Promise<void> => {
  await closeSignal(bot, logger)
}

export const closeSignal = async (bot: Bot, logger: Logger) => {
  logger.debug('Recieved closeSignal!')
  setTimeout(() => process.exit(1), 10000).unref()
  await bot.stop()
  process.stdout.write('\r\x1b[2K')
  process.exit(0)
}

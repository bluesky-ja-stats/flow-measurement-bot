import fs from 'fs'
import path from 'path'
import { Bot } from "../bot"
import { createLogger, Logger } from "./logger"

export const setupCmd = (bot: Bot, logger: Logger) => {
  logger.info('Registering command...')
  process.stdin.on('data', async (data) => {
    const cmd = (data.toString()).split(' ').map(v => v.trim()).filter(v => v !== '')
    for (let i = cmd.length; i > 0; i--) {
      const fullPath = path.join(__dirname, `../cmds/${cmd.slice(0, i).join('/')}${path.parse(__filename).ext}`)
      if (fs.existsSync(fullPath)) {
        const event = (await import(fullPath)).default as (bot: Bot, logger: Logger, args: string[]) => Promise<void>
        await event(bot, createLogger(['Runner', 'Commander'].concat(cmd.slice(0, i))), cmd.slice(i))
        return
      }
    }
    logger.error(`command not found`)
  })
  logger.info('Commands has been registered!')
}

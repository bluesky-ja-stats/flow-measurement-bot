import { env } from './config'

const generateLogMessage = (level: string, childs: string[], message: string): string[] => {
  const date: Date = new Date(Date.now())
  const dateString: string = date.toISOString().replace('T',' ').replace('Z','')
  let prefixString: string = `${dateString} ${`[${level}]`.padEnd(8, ' ')}`
  for (const child of childs) {
    prefixString += `[${child}]: `
  }
  const messageArray: string[] = []
  message.split('\n').forEach((element, index) => {
    if (index === 0) {
      messageArray.push(element)
    } else {
      messageArray.push(`${' '.repeat(prefixString.length)}${element}`)
    }
  })
  const messageString: string = messageArray.join('\n')
  let childString: string = ""
  for (const child of childs) {
    childString += `[\x1b[32m${child}\x1b[0m]: `
  }
  return [`\x1b[90m${dateString}\x1b[0m [`, `${`${level}\u001b[0m]`.padEnd(10, ' ')} ${childString}${messageString}`]
}

export interface Logger {
  debug(message: string): void
  info(message: string): void
  warn(message: string): void
  error(message: string): void
}

export const createLogger = (childs: string[]): Logger => {
  return {
    debug: (message: string): void => {
      if (!env.isProduction) console.debug(generateLogMessage('DEBUG', childs, message).join('\u001b[35m'))
    },
    info: (message: string): void => {
      console.info(generateLogMessage('INFO', childs, message).join('\u001b[36m'))
    },
    warn: (message: string): void => {
      console.warn(generateLogMessage('WARN', childs, message).join('\u001b[33m'))
    },
    error: (message: string): void => {
      console.error(generateLogMessage('ERROR', childs, message).join('\u001b[31m'))
    }
  }
}

import { env } from './config'

interface CreateLoggerOptions {
  name: string
  childs?: string[]
}

const generateLogMessage = (name: string, level: string, message: string, childs?: string[]): string[] => {
  const date: Date = new Date(Date.now())
  const dateString: string = date.toISOString().replace('T',' ').slice(0,19)
  let prefixString: string = `${dateString} [${name}/${level}]: `
  if (childs) {
    for (const child of childs) {
      prefixString += `[${child}]: `
    }
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
  if (childs) {
    for (const child of childs) {
      childString += `[\x1b[34m${child}\x1b[0m]: `
    }
  }
  return [`\x1b[90m${dateString}\x1b[0m [\x1b[32m${name}\x1b[0m/`, `${level}\u001b[0m]: ${childString}${messageString}`]
}

export interface Logger {
  debug(message: string): void
  info(message: string): void
  warn(message: string): void
  error(message: string): void
}

export const createLogger = (opts: CreateLoggerOptions): Logger => {
  return {
    debug: (message: string): void => {
      if (!env.isProduction) console.debug(generateLogMessage(opts.name, 'DEBUG', message, opts.childs).join('\u001b[35m'))
    },
    info: (message: string): void => {
      console.info(generateLogMessage(opts.name, 'INFO', message, opts.childs).join('\u001b[36m'))
    },
    warn: (message: string): void => {
      console.warn(generateLogMessage(opts.name, 'WARN', message, opts.childs).join('\u001b[33m'))
    },
    error: (message: string): void => {
      console.error(generateLogMessage(opts.name, 'ERROR', message, opts.childs).join('\u001b[31m'))
    }
  }
}

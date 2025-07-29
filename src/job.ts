import { AtpAgent } from '@atproto/api'
import { WebSocket } from 'ws'
import { type JetstreamEvent } from './types'
import { env } from './util/config'
import { type Logger } from './util/logger'

export const main = async (agent: AtpAgent, logger: Logger): Promise<void> => {
  const method = 'subscribe'
  const query = 'wantedCollections=app.bsky.feed.post'
  const url = `${env.JETSTREAM_ENDPOINT}/${method}?${query}`
  const allCursor: number[] = []
  const jaCursor: number[] = []
  const ws = new WebSocket(url)
  logger.info(`Jetstream: ${url}`)
  ws.on('open', () => {})
  ws.on('message', (data) => {
    const event = JSON.parse(data.toString()) as JetstreamEvent
    if (allCursor.length === 0 || event.time_us < (allCursor[0] + 60*(10**6))) {
      if (event.kind === 'commit' && event.commit.operation === 'create' && event.commit.record.$type === 'app.bsky.feed.post' && event.commit.record.text) {
        allCursor.push(event.time_us)
        var searchtext: string = event.commit.record.text
        if (event.commit.record.embed?.images && Array.isArray(event.commit.record.embed.images)) {
          for (const image of event.commit.record.embed.images) {
            searchtext = searchtext + image.alt
          }
        }
        if ((typeof event.commit.record.langs !== 'undefined' && event.commit.record.langs.includes('ja')) || (searchtext.match(/^.*[ぁ-んァ-ヶｱ-ﾝﾞﾟー]+.*$/))) {
          jaCursor.push(event.time_us)
        }
      }
    } else {
      ws.close()
    }
    logger.debug('処理終了')
  })
  ws.on('error', (error) => {})
  ws.on('close', async (code, reason) => {
    logger.debug('close処理開始')
    const d = new Date(allCursor[0]/(10**3))
    const date = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')} GMT+0900 (日本標準時)`
    const text = `${date}\nからの1分間で受信したBlueskyの投稿数は以下の通りです\n\n日本語: ${jaCursor.length} [post/min]\n全投稿: ${allCursor.length} [post/min]`
    await agent.post({text})
    logger.info(text)
  })
}

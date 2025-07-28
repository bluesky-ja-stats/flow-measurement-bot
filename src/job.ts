import { AtpAgent } from '@atproto/api'
import { WebSocket } from 'ws'
import { JetstreamEvent } from './types'
import { env } from './util/config'
import { type Logger } from './util/logger'

export const main = async (agent: AtpAgent, logger: Logger): Promise<void> => {
  const service = 'subscribe'
  const query = 'wantedCollections=app.bsky.feed.post'
  const allCursor: number[] = []
  const jaCursor: number[] = []
  const ws = new WebSocket(`${env.JETSTREAM_ENDPOINT}/${service}?${query}`)
  logger.info(`Jetstream: ${env.JETSTREAM_ENDPOINT}/${service}?${query}`)
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
  })
  ws.on('error', (error) => {})
  ws.on('close', async (code, reason) => {
    const d = new Date(allCursor[0]/(10**3))
    const date = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')} GMT+0900 (日本標準時)`
    await agent.post({
        text: `${date}\nからの1分間で受信したBlueskyの投稿数は以下の通りです\n\n日本語: ${jaCursor.length} [post/min]\n全投稿: ${allCursor.length} [post/min]`,
    })
    logger.info(`${date}\nja: ${jaCursor.length} [post/min]\nall: ${allCursor.length} [post/min]`)
  })
}

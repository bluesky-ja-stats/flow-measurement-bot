import { AtpAgent } from '@atproto/api'
import { WebSocket } from 'ws'
import { JetstreamRecord, type JetstreamEvent } from './types'
import { env } from './util/config'
import { type Logger } from './util/logger'
import type { Database } from './db'
import { generateDailyImage } from './image'

export const main = async (agent: AtpAgent, logger: Logger, db: Database): Promise<void> => {
  const method = 'subscribe'
  const wantedCollections = ['app.bsky.feed.post', 'app.bsky.feed.like']
  const query = wantedCollections.map(v => 'wantedCollections='+v).join('&')
  const url = `${env.JETSTREAM_ENDPOINT}/${method}?${query}`
  const cursors: {
    all: number[]
    posts: {
      all: number[]
      ja: number[]
    }
    likes: {
      all: string[]
      ja: string[]
    }
  } = {
    all: [],
    posts: {
      all: [],
      ja: [],
    },
    likes: {
      all: [],
      ja: [],
    },
  }
  const ws = new WebSocket(url)
  logger.info(`Jetstream: ${url}`)
  ws.on('open', () => {})
  ws.on('message', (data) => {
    const event = JSON.parse(data.toString()) as JetstreamEvent
    if (cursors.all.length === 0 || event.time_us < (cursors.all[0] + 60*(10**6))) {
      cursors.all.push(event.time_us)
      if (event.kind === 'commit'){
        if (event.commit.operation === 'create') {
          if (event.commit.record.$type === 'app.bsky.feed.post' && event.commit.record.text) {
            cursors.posts.all.push(event.time_us)
            if (isJa(event.commit.record)) cursors.posts.ja.push(event.time_us)
          } else if (event.commit.record.$type === 'app.bsky.feed.like') {
            cursors.likes.all.push(event.commit.record.subject.uri)
          }
        }
      } else if (event.kind === 'identity') {
      } else if (event.kind === 'account') {
      }
    } else {
      ws.close()
    }
  })
  ws.on('error', (error) => {})
  ws.on('close', async (code, reason) => {
    logger.debug('close処理')
    const size = 25
    for (const sepLikes of cursors.likes.all.flatMap((_, i, a) => i % size ? [] : [a.slice(i, i + size)])) {
      const posts = (await agent.getPosts({uris: sepLikes})).data.posts
      for (const post of posts) if (isJa(post.record)) cursors.likes.ja.push(post.uri)
    }
    const d = new Date(cursors.all[0]/(10**3))
    const date = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')} GMT+0900 (日本標準時)`
    const text = `測定開始: ${date}\n測定時間: 1分\n\n日本語を含む投稿: ${cursors.posts.ja.length} [post/min]\n全ての投稿　　　: ${cursors.posts.all.length} [post/min]\n\n日本語を含む投稿へのいいね: ${cursors.likes.ja.length} [like/min]\n全てのいいね　　　　　　　: ${cursors.likes.all.length} [like/min]`

    // DBに保存
    await db.insertInto("history").values({ created_at: d.toISOString(), like_all: cursors.likes.all.length, like_jp: cursors.likes.ja.length, post_all: cursors.posts.all.length, post_jp: cursors.posts.ja.length }).execute()

    // DBからデータを取得しグラフを描画
    const historyData = await db.selectFrom("history").selectAll().orderBy("created_at", "desc").limit(24).execute()
    const { buffer: imageBuffer, width, height } = generateDailyImage(historyData)

    const uploaded = await agent.uploadBlob(imageBuffer)
    await agent.post({ text, langs: ['ja'], embed: { $type: "app.bsky.embed.images", images: [{ image: uploaded.data.blob, alt: "24時間のグラフ", $type: "app.bsky.embed.images#image", aspectRatio: { width, height } }] } })
    logger.info(text)
  })
}

const isJa = (record: any): boolean => {
  var searchtext: string = record.text
  if (record.embed?.images && Array.isArray(record.embed.images)) {
    for (const image of record.embed.images) {
      searchtext = searchtext + image.alt
    }
  }
  if ((typeof record.langs !== 'undefined' && record.langs.includes('ja')) || (searchtext.match(/^.*[ぁ-んァ-ヶｱ-ﾝﾞﾟー]+.*$/))) {
    return true
  }
  return false
}

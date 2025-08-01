import { AtpAgent, type AppBskyEmbedImages } from '@atproto/api'
import { WebSocket } from 'ws'
import type { imageData, JetstreamEvent } from './types'
import { env } from './util/config'
import { type Logger } from './util/logger'
import type { Database } from './db'
import { generateDailyPostImage, generateDailyLikeImage } from './image'

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
    const text = `測定開始: ${d.toLocaleString('sv-SE', {year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'JST'})}\n測定時間: 1分\n\n日本語を含む投稿: ${cursors.posts.ja.length} [post/min]\n全ての投稿　　　: ${cursors.posts.all.length} [post/min]\n\n日本語を含む投稿へのいいね: ${cursors.likes.ja.length} [like/min]\n全てのいいね　　　　　　　: ${cursors.likes.all.length} [like/min]`

    // DBに保存
    await db.insertInto('history').values({ created_at: d.toISOString(), like_all: cursors.likes.all.length, like_jp: cursors.likes.ja.length, post_all: cursors.posts.all.length, post_jp: cursors.posts.ja.length }).execute()

    // DBからデータを取得しグラフを描画
    const historyData = await db.selectFrom('history').selectAll().orderBy('created_at', 'asc').limit(24).execute()
    const images: AppBskyEmbedImages.Image[] = []

    images.push(await generateImageLex(agent, generateDailyPostImage(historyData)))

    images.push(await generateImageLex(agent, generateDailyLikeImage(historyData)))

    await agent.post({$type: 'app.bsky.feed.post', text, langs: ['ja'], embed: {$type: 'app.bsky.embed.images', images}})
    logger.info(text)
  })
}

const isJa = (record: any): boolean => {
  var searchtext: string = record.text
  if (record.embed?.images && Array.isArray(record.embed.images)) {
    for (const image of record.embed.images) searchtext += `\n${image.alt}`
  }
  if (record.embed?.alt) searchtext += `\n${record.embed.alt}`
  if ((typeof record.langs !== 'undefined' && record.langs.includes('ja')) || (searchtext.match(/^.*[ぁ-んァ-ヶｱ-ﾝﾞﾟー]+.*$/))) {
    return true
  }
  return false
}

const generateImageLex = async (agent: AtpAgent, imageData: imageData): Promise<AppBskyEmbedImages.Image> => {
  const uploaded = await agent.uploadBlob(imageData.buffer)
  return {$type: 'app.bsky.embed.images#image', image: uploaded.data.blob, aspectRatio: {...imageData.aspectRatio}, alt: imageData.title}
}

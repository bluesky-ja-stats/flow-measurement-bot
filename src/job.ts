import { AtpAgent, type AppBskyEmbedImages } from '@atproto/api'
import { WebSocket } from 'ws'
import type { Cursors, imageData, JetstreamEvent } from './types'
import { env } from './util/config'
import { type Logger } from './util/logger'
import type { Database } from './db'
import {
  generateDailyPostImage,
  generateDailyLikeImage,
  generateWeeklyPostImage,
  generateWeeklyLikeImage,
} from './image'

export const hourly = async (agent: AtpAgent, logger: Logger, db: Database): Promise<void> => {
  logger.info('Start hourly job')

  const measureSecond = 60
  const method = 'subscribe'
  const wantedCollections = ['app.bsky.feed.post', 'app.bsky.feed.like']
  const query = wantedCollections.map(v => 'wantedCollections='+v).join('&')
  const url = `${env.JETSTREAM_ENDPOINT}/${method}?${query}`
  const cursors: Cursors = {
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

  ws.on('open', () => {
    logger.info(`Jetstream: ${url}`)
  })

  ws.on('message', (data) => {
    const event = JSON.parse(data.toString()) as JetstreamEvent
    if (cursors.all.length === 0 || event.time_us < (cursors.all[0] + measureSecond*(10**6))) {
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
    const maxUriSize = 25
    for (const sepLikes of cursors.likes.all.flatMap((_, i, a) => i % maxUriSize ? [] : [a.slice(i, i + maxUriSize)])) {
      await getPosts(agent, logger, cursors, sepLikes)
    }
    const d = new Date(cursors.all[0]/(10**3))

    // DBに保存
    await db.insertInto('history').values({ created_at: d.toISOString(), like_all: cursors.likes.all.length*60/measureSecond, like_jp: cursors.likes.ja.length*60/measureSecond, post_all: cursors.posts.all.length*60/measureSecond, post_jp: cursors.posts.ja.length*60/measureSecond }).execute()

    // DBからデータを取得しグラフを描画
    const historyData = (await db.selectFrom('history').selectAll().orderBy('created_at', 'desc').limit(24).execute()).reverse()

    const images: AppBskyEmbedImages.Image[] = []
    images.push(await generateImageLex(agent, generateDailyPostImage(historyData)))
    images.push(await generateImageLex(agent, generateDailyLikeImage(historyData)))

    const text = `【測定データ】\n\n測定開始: ${d.toLocaleString('sv-SE', {year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'JST'})}\n測定時間: ${measureSecond}秒\n\n日本語を含む投稿: ${cursors.posts.ja.length*60/measureSecond} [post/min]\n全ての投稿　　　: ${cursors.posts.all.length*60/measureSecond} [post/min]\n\n日本語を含む投稿へのいいね: ${cursors.likes.ja.length*60/measureSecond} [like/min]\n全てのいいね　　　　　　　: ${cursors.likes.all.length*60/measureSecond} [like/min]`
    await agent.post({$type: 'app.bsky.feed.post', text, langs: ['ja'], embed: {$type: 'app.bsky.embed.images', images}})
    logger.info(text)
  })
}

export const weekly = async (agent: AtpAgent, logger: Logger, db: Database): Promise<void> => {
  logger.info('Start weekly job')

  const historyData = (await db.selectFrom('history').selectAll().orderBy('created_at', 'desc').limit(7*24).execute()).reverse()

  const images: AppBskyEmbedImages.Image[] = []
  images.push(await generateImageLex(agent, generateWeeklyPostImage(historyData)))
  images.push(await generateImageLex(agent, generateWeeklyLikeImage(historyData)))

  const text = `【週間報告】\n\n${new Date(historyData[0].created_at).toLocaleDateString('sv-SE', {year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'JST'})} ~ ${new Date(historyData.slice(-1)[0].created_at).toLocaleDateString('sv-SE', {year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'JST'})}\nにおける、投稿といいねの流速のグラフです。`
  await agent.post({$type: 'app.bsky.feed.post', text, langs: ['ja'], embed: {$type: 'app.bsky.embed.images', images}})
  logger.info(text)
}

const getPosts = async (agent: AtpAgent, logger: Logger, cursors: Cursors, uris: string[]): Promise<void> => {
  try {
    const posts = (await agent.getPosts({uris})).data.posts
    for (const post of posts) if (isJa(post.record)) cursors.likes.ja.push(post.uri)
  } catch {
    logger.error('AtpAgent could not get posts')
    await getPosts(agent, logger, cursors, uris)
  }
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

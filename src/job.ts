import { JetstreamEventKind, JetstreamRecord } from 'atingester'
import { WebSocket } from 'ws'
import { AtpAgent, type AppBskyEmbedImages } from '@atproto/api'
import { HistoryPosterTable } from './db/types'
import {
  generateDailyPostImage,
  generateDailyLikeImage,
  generateWeeklyPostImage,
  generateWeeklyLikeImage,
} from './image'
import type { Cursors, imageData, Posters } from './types'
import { type AppContext, env } from './util/config'
import { type Logger } from './util/logger'

export const hourly = async (ctx: AppContext): Promise<void> => {
  ctx.logger.info('Start hourly job')

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
    ctx.logger.info(`Jetstream: ${url}`)
  })

  ws.on('message', (data) => {
    const event = JSON.parse(data.toString()) as JetstreamEventKind
    if (cursors.all.length === 0 || event.time_us < (cursors.all[0] + measureSecond*(10**6))) {
      cursors.all.push(event.time_us)
      if (event.kind === 'commit'){
        if (event.commit.operation === 'create') {
          if (event.commit.record.$type === 'app.bsky.feed.post' && event.commit.record.text) {
            cursors.posts.all.push(event.time_us)
            if (isJa(event.commit.record)) cursors.posts.ja.push(event.time_us)
          } else if (event.commit.record.$type === 'app.bsky.feed.like') {
            const subject = event.commit.record.subject as {uri: string, cid: string}
            cursors.likes.all.push(subject.uri)
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
    ctx.logger.debug('close処理')
    const maxUriSize = 25
    for (const sepLikes of cursors.likes.all.flatMap((_, i, a) => i % maxUriSize ? [] : [a.slice(i, i + maxUriSize)])) {
      await getPosts(ctx.agent, ctx.logger, cursors, sepLikes)
    }
    const d = new Date(cursors.all[0]/(10**3))

    // DBに保存
    await ctx.db.insertInto('history').values({ created_at: d.toISOString(), like_all: cursors.likes.all.length*60/measureSecond, like_jp: cursors.likes.ja.length*60/measureSecond, post_all: cursors.posts.all.length*60/measureSecond, post_jp: cursors.posts.ja.length*60/measureSecond }).execute()

    // DBからデータを取得しグラフを描画
    const historyData = (await ctx.db.selectFrom('history').selectAll().orderBy('created_at', 'desc').limit(24).execute()).reverse()

    const images: AppBskyEmbedImages.Image[] = []
    images.push(await generateImageLex(ctx.agent, generateDailyPostImage(historyData)))
    images.push(await generateImageLex(ctx.agent, generateDailyLikeImage(historyData)))

    const text = `【測定データ】\n\n測定対象: ${d.toLocaleString('sv-SE', {year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'JST'})}\n測定時間: ${measureSecond}秒\n\n日本語を含む投稿: ${cursors.posts.ja.length*60/measureSecond} [post/min]\n全ての投稿　　　: ${cursors.posts.all.length*60/measureSecond} [post/min]\n\n日本語を含む投稿へのいいね: ${cursors.likes.ja.length*60/measureSecond} [like/min]\n全てのいいね　　　　　　　: ${cursors.likes.all.length*60/measureSecond} [like/min]`
    await ctx.agent.post({$type: 'app.bsky.feed.post', text, langs: ['ja'], embed: {$type: 'app.bsky.embed.images', images}})
    ctx.logger.info(text)
  })
}

export const daily = async (ctx: AppContext): Promise<void> => {
  ctx.logger.info('Start daily job')

  const posters: Posters = {all: {}, jp: {}}
  const tmpPosterData = await ctx.db.selectFrom('tmp_poster').selectAll().execute()
  for (const poster of tmpPosterData) {
    const [date, did] = poster.date_did.split('=')
    if (!Array.isArray(posters.all[date])) posters.all[date] = [] //new Set()
    //posters.all[date].add(did)
    posters.all[date].push(did)
    if (poster.is_jp === 'true') {
      if (!Array.isArray(posters.jp[date])) posters.jp[date] = [] //new Set()
      //posters.jp[date].add(did)
      posters.jp[date].push(did)
    }
  }
  const dates = Object.keys(posters.all).sort()
  const targetDay = new Date(Date.now() - 86400000).toLocaleDateString('sv-SE', {year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'JST'})
  const targetDayIndex = dates.indexOf(targetDay)

  if (targetDayIndex <= 0) {
    const historyPosterTable: HistoryPosterTable = {
      created_at: targetDay,
      all: posters.all[targetDay].length,
      all_increase: 0,
      all_decrease: 0,
      jp: posters.jp[targetDay].length,
      jp_increase: 0,
      jp_decrease: 0,
    }

    await ctx.db.insertInto('history_poster').values(historyPosterTable).execute()

    const text = `【測定データ】\n\n測定対象: ${historyPosterTable.created_at}\n\n日本語話者数　　 　　　 : ${historyPosterTable.jp} [poster/day]\n日本語話者増加数(前日比): ${historyPosterTable.jp_increase} [poster/day]\n日本語話者減少数(前日比): ${historyPosterTable.jp_decrease} [poster/day]\n\n全投稿者数　　 　　　 : ${historyPosterTable.all} [poster/day]\n全投稿者増加数(前日比): ${historyPosterTable.all_increase} [poster/day]\n全投稿者減少数(前日比): ${historyPosterTable.all_decrease} [poster/day]`
    await ctx.agent.post({$type: 'app.bsky.feed.post', text, langs: ['ja']})
    ctx.logger.info(text)
    return
  }

  /*const historyPosterTable: HistoryPosterTable = {
    created_at: targetDay,
    all: posters.all[targetDay].size,
    all_increase: posters.all[targetDay].difference(posters.all[dates[targetDayIndex-1]]),
    all_decrease: posters.all[dates[targetDayIndex-1]].difference(posters.all[targetDay]),
    jp: posters.jp[targetDay].size,
    jp_increase: posters.jp[targetDay].difference(posters.jp[dates[targetDayIndex-1]]),
    jp_decrease: posters.jp[dates[targetDayIndex-1]].difference(posters.jp[targetDay]),
  }*/

  const all_increase = posters.all[targetDay].filter((v) => !posters.all[dates[targetDayIndex-1]].includes(v)).length
  const all_decrease = posters.all[dates[targetDayIndex-1]].filter((v) => !posters.all[targetDay].includes(v)).length
  const jp_increase = posters.jp[targetDay].filter((v) => !posters.jp[dates[targetDayIndex-1]].includes(v)).length
  const jp_decrease = posters.jp[dates[targetDayIndex-1]].filter((v) => !posters.jp[targetDay].includes(v)).length

  const historyPosterTable: HistoryPosterTable = {
    created_at: targetDay,
    all: posters.all[targetDay].length,
    all_increase,
    all_decrease,
    jp: posters.jp[targetDay].length,
    jp_increase,
    jp_decrease,
  }

  await ctx.db.insertInto('history_poster').values(historyPosterTable).execute()

  for (const deleteDay of dates.slice(0, targetDayIndex)) {
    await ctx.db.deleteFrom('tmp_poster').where('date_did', 'like', `${deleteDay}=%`).execute()
  }

  const text = `【測定データ】\n\n測定対象: ${historyPosterTable.created_at}\n\n日本語話者数　　 　　　 : ${historyPosterTable.jp} [poster/day]\n日本語話者増加数(前日比): ${historyPosterTable.jp_increase} [poster/day]\n日本語話者減少数(前日比): ${historyPosterTable.jp_decrease} [poster/day]\n\n全投稿者数　　 　　　 : ${historyPosterTable.all} [poster/day]\n全投稿者増加数(前日比): ${historyPosterTable.all_increase} [poster/day]\n全投稿者減少数(前日比): ${historyPosterTable.all_decrease} [poster/day]`
  await ctx.agent.post({$type: 'app.bsky.feed.post', text, langs: ['ja']})
  ctx.logger.info(text)
}

export const weekly = async (ctx: AppContext): Promise<void> => {
  ctx.logger.info('Start weekly job')

  const historyData = (await ctx.db.selectFrom('history').selectAll().orderBy('created_at', 'desc').limit(7*24).execute()).reverse()

  const images: AppBskyEmbedImages.Image[] = []
  images.push(await generateImageLex(ctx.agent, generateWeeklyPostImage(historyData)))
  images.push(await generateImageLex(ctx.agent, generateWeeklyLikeImage(historyData)))

  const text = `【週間報告】\n\n${new Date(historyData[0].created_at).toLocaleDateString('sv-SE', {year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'JST'})} ~ ${new Date(historyData.slice(-1)[0].created_at).toLocaleDateString('sv-SE', {year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'JST'})}\nにおける、投稿といいねの流速のグラフです。`
  await ctx.agent.post({$type: 'app.bsky.feed.post', text, langs: ['ja'], embed: {$type: 'app.bsky.embed.images', images}})
  ctx.logger.info(text)
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

export const isJa = (record: any): boolean => {
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

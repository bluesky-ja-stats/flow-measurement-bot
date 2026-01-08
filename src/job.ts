import { Jetstream } from 'atingester'
import { AtpAgent, type AppBskyEmbedImages, type AppBskyFeedGetPosts, type AppBskyFeedPost } from '@atproto/api'
import { XRPCError } from '@atproto/xrpc'
import { HistoryPosterTable } from './db/types'
import {
  generateAllPosterImage,
  generateJpPosterImage,
  generateAveragePostImage,
  generateAverageLikeImage,
  generateDailyPostImage,
  generateDailyLikeImage,
  generateWeeklyPostImage,
  generateWeeklyLikeImage,
} from './image'
import type { Cursors, imageData, Posters } from './types'
import type { BotContext } from './util/config'
import { type Logger } from './util/logger'

export const hourly = async (ctx: BotContext): Promise<void> => {
  ctx.logger.info('Start hourly job')

  const d = new Date()
  const measureSecond = 60
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
  const jetstream = new Jetstream({
    idResolver: ctx.idResolver,
    handleEvent: (evt) => {
      if (cursors.all.length === 0 || evt.time_us < (cursors.all[0] + measureSecond*(10**6))) {
        cursors.all.push(evt.time_us)
        if (evt.event === 'create') {
          if (evt.collection === 'app.bsky.feed.post') {
            cursors.posts.all.push(evt.time_us)
            if (isJa(evt.record)) cursors.posts.ja.push(evt.time_us)
          } else if (evt.collection === 'app.bsky.feed.like') {
            const subject = evt.record.subject as {uri: string, cid: string}
            cursors.likes.all.push(subject.uri)
          }
        }
      } else {
        jetstream.destroy()
      }
    },
    onInfo: ctx.logger.info,
    onError: (err: Error) => ctx.logger.error(err.message),
    service: ctx.cfg.jetstream.service,
    compress: true,
    filterCollections: ['app.bsky.feed.post', 'app.bsky.feed.like'],
    excludeIdentity: true,
    excludeAccount: true,
  })

  await jetstream.start()

  ctx.logger.debug('close処理')
  const posts = await getAllPosts(ctx.agent, ctx.logger, cursors.likes.all)
  for (const post of posts) if (isJa(post.record)) cursors.likes.ja.push(post.uri)

  // DBに保存
  await ctx.db.insertInto('history').values({ created_at: d.toISOString(), like_all: cursors.likes.all.length*60/measureSecond, like_jp: cursors.likes.ja.length*60/measureSecond, post_all: cursors.posts.all.length*60/measureSecond, post_jp: cursors.posts.ja.length*60/measureSecond }).execute()

  // DBからデータを取得しグラフを描画
  const historyPostData = (await ctx.db.selectFrom('history').selectAll().orderBy('created_at', 'desc').limit(24).execute()).reverse()

  const images: AppBskyEmbedImages.Image[] = []
  images.push(await generateImageLex(ctx.agent, ctx.logger, generateDailyPostImage(historyPostData)))
  images.push(await generateImageLex(ctx.agent, ctx.logger, generateDailyLikeImage(historyPostData)))

  const text = `【測定データ】\n\n測定対象: ${d.toLocaleString('sv-SE', {year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'JST'})}\n測定時間: ${measureSecond.toLocaleString('ja-JP')}秒\n\n日本語を含む投稿: ${(cursors.posts.ja.length*60/measureSecond).toLocaleString('ja-JP')} [post/min]\n全ての投稿　　　: ${(cursors.posts.all.length*60/measureSecond).toLocaleString('ja-JP')} [post/min]\n\n日本語を含む投稿へのいいね: ${(cursors.likes.ja.length*60/measureSecond).toLocaleString('ja-JP')} [like/min]\n全てのいいね　　　　　　　: ${(cursors.likes.all.length*60/measureSecond).toLocaleString('ja-JP')} [like/min]`
  await createPost(ctx.agent, ctx.logger, text, images)
}

export const daily = async (ctx: BotContext): Promise<void> => {
  ctx.logger.info('Start daily job')

  const posters: Posters = {all: {}, jp: {}}
  const tmpPosterData = await ctx.db.selectFrom('tmp_poster').selectAll().execute()
  const len = tmpPosterData.length
  for (let i = 0; i < len; i++) {
    const poster = tmpPosterData[i]
    const [date, did] = poster.date_did.split('=')
    if (!posters.all[date]) posters.all[date] = new Set<string>()
    posters.all[date].add(did)
    if (poster.is_jp === 'true') {
      if (!posters.jp[date]) posters.jp[date] = new Set<string>()
      posters.jp[date].add(did)
    }
  }
  const dates = Object.keys(posters.all).sort()
  const targetDay = new Date(Date.now() - 86400000).toLocaleDateString('sv-SE', {year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'JST'})
  const targetDayIndex = dates.indexOf(targetDay)

  if (targetDayIndex <= 0) {
    const historyPosterTable: HistoryPosterTable = {
      created_at: targetDay,
      all: posters.all[targetDay].size,
      all_increase: 0,
      all_decrease: 0,
      jp: posters.jp[targetDay].size,
      jp_increase: 0,
      jp_decrease: 0,
    }

    await ctx.db.insertInto('history_poster').values(historyPosterTable).execute()

    const text = `【測定データ】\n\n測定対象: ${historyPosterTable.created_at}\n\n日本語話者数　　 　　　 : ${historyPosterTable.jp.toLocaleString('ja-JP')} [poster/day]\n日本語話者増加数(前日比): ${historyPosterTable.jp_increase.toLocaleString('ja-JP')} [poster/day]\n日本語話者減少数(前日比): ${historyPosterTable.jp_decrease.toLocaleString('ja-JP')} [poster/day]\n\n全投稿者数　　 　　　 : ${historyPosterTable.all.toLocaleString('ja-JP')} [poster/day]\n全投稿者増加数(前日比): ${historyPosterTable.all_increase.toLocaleString('ja-JP')} [poster/day]\n全投稿者減少数(前日比): ${historyPosterTable.all_decrease.toLocaleString('ja-JP')} [poster/day]`
    await createPost(ctx.agent, ctx.logger, text, [])
    return
  }

  const historyPosterTable: HistoryPosterTable = {
    created_at: targetDay,
    all: posters.all[targetDay].size,
    all_increase: getDifference(posters.all[targetDay], posters.all[dates[targetDayIndex-1]]).size,
    all_decrease: getDifference(posters.all[dates[targetDayIndex-1]], posters.all[targetDay]).size,
    jp: posters.jp[targetDay].size,
    jp_increase: getDifference(posters.jp[targetDay], posters.jp[dates[targetDayIndex-1]]).size,
    jp_decrease: getDifference(posters.jp[dates[targetDayIndex-1]], posters.jp[targetDay]).size,
  }

  await ctx.db.insertInto('history_poster').values(historyPosterTable).execute()

  for (const deleteDay of dates.slice(0, targetDayIndex)) {
    await ctx.db.deleteFrom('tmp_poster').where('date_did', 'like', `${deleteDay}=%`).execute()
  }

  const text = `【測定データ】\n\n測定対象: ${historyPosterTable.created_at}\n\n日本語話者数　　 　　　 : ${historyPosterTable.jp.toLocaleString('ja-JP')} [poster/day]\n日本語話者増加数(前日比): ${historyPosterTable.jp_increase.toLocaleString('ja-JP')} [poster/day]\n日本語話者減少数(前日比): ${historyPosterTable.jp_decrease.toLocaleString('ja-JP')} [poster/day]\n\n全投稿者数　　 　　　 : ${historyPosterTable.all.toLocaleString('ja-JP')} [poster/day]\n全投稿者増加数(前日比): ${historyPosterTable.all_increase.toLocaleString('ja-JP')} [poster/day]\n全投稿者減少数(前日比): ${historyPosterTable.all_decrease.toLocaleString('ja-JP')} [poster/day]`
  await createPost(ctx.agent, ctx.logger, text, [])
}

export const weekly = async (ctx: BotContext): Promise<void> => {
  ctx.logger.info('Start weekly job')

  const historyPostData = (await ctx.db.selectFrom('history').selectAll().orderBy('created_at', 'desc').limit(7*24).execute()).reverse()
  const historyPosterData = (await ctx.db.selectFrom('history_poster').selectAll().orderBy('created_at', 'desc').limit(7).execute()).reverse()

  const images: AppBskyEmbedImages.Image[] = []
  images.push(await generateImageLex(ctx.agent, ctx.logger, generateWeeklyPostImage(historyPostData)))
  images.push(await generateImageLex(ctx.agent, ctx.logger, generateWeeklyLikeImage(historyPostData)))
  images.push(await generateImageLex(ctx.agent, ctx.logger, generateJpPosterImage('One-week', historyPosterData)))
  images.push(await generateImageLex(ctx.agent, ctx.logger, generateAllPosterImage('One-week', historyPosterData)))

  const text = `【週間報告】\n\n${new Date(historyPostData[0].created_at).toLocaleDateString('sv-SE', {year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'JST'})} ~ ${new Date(historyPostData.slice(-1)[0].created_at).toLocaleDateString('sv-SE', {year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'JST'})} における投稿数及びいいね数の増減のグラフと、\n${historyPosterData[0].created_at} ~ ${historyPosterData.slice(-1)[0].created_at} における投稿者数の増減のグラフです。`
  await createPost(ctx.agent, ctx.logger, text, images)
}

export const monthly = async (ctx: BotContext): Promise<void> => {
  ctx.logger.info('Start monthly job')

  const targetDay = new Date(Date.now() - 86400000).toLocaleDateString('sv-SE', {year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'JST'})

  const historyPostData = (await ctx.db.selectFrom('history').selectAll().orderBy('created_at', 'desc').execute()).reverse()
  const historyPosterData = (await ctx.db.selectFrom('history_poster').selectAll().orderBy('created_at', 'desc').where('created_at', 'like', `${targetDay.split('-').slice(0, 2).join('-')}-%`).execute()).reverse()

  const images: AppBskyEmbedImages.Image[] = []
  images.push(await generateImageLex(ctx.agent, ctx.logger, generateAveragePostImage('One-month', historyPostData, targetDay.split('-').slice(0, 2).join('-'))))
  images.push(await generateImageLex(ctx.agent, ctx.logger, generateAverageLikeImage('One-month', historyPostData, targetDay.split('-').slice(0, 2).join('-'))))
  images.push(await generateImageLex(ctx.agent, ctx.logger, generateJpPosterImage('One-month', historyPosterData)))
  images.push(await generateImageLex(ctx.agent, ctx.logger, generateAllPosterImage('One-month', historyPosterData)))

  const text = `【月間報告】\n\n${new Date(historyPostData[0].created_at).toLocaleDateString('sv-SE', {year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'JST'})} ~ ${new Date(historyPostData.slice(-1)[0].created_at).toLocaleDateString('sv-SE', {year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'JST'})} における平均投稿数及び平均いいね数の増減のグラフと、\n${historyPosterData[0].created_at} ~ ${historyPosterData.slice(-1)[0].created_at} における投稿者数の増減のグラフです。`
  await createPost(ctx.agent, ctx.logger, text, images)
}

export const yearly = async (ctx: BotContext): Promise<void> => {
  ctx.logger.info('Start yearly job')

  const targetDay = new Date(Date.now() - 86400000).toLocaleDateString('sv-SE', {year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'JST'})

  const historyPostData = (await ctx.db.selectFrom('history').selectAll().orderBy('created_at', 'desc').execute()).reverse()
  const historyPosterData = (await ctx.db.selectFrom('history_poster').selectAll().orderBy('created_at', 'desc').where('created_at', 'like', `${targetDay.split('-')[0]}-%`).execute()).reverse()

  const rootImages: AppBskyEmbedImages.Image[] = []
  rootImages.push(await generateImageLex(ctx.agent, ctx.logger, generateAveragePostImage('One-year', historyPostData, targetDay.split('-')[0])))
  rootImages.push(await generateImageLex(ctx.agent, ctx.logger, generateAverageLikeImage('One-year', historyPostData, targetDay.split('-')[0])))
  rootImages.push(await generateImageLex(ctx.agent, ctx.logger, generateJpPosterImage('One-year', historyPosterData)))
  rootImages.push(await generateImageLex(ctx.agent, ctx.logger, generateAllPosterImage('One-year', historyPosterData)))

  const rootText = `【年間報告】(1/3)\n\n\\\\\\ Happy New Year ///\n\n${new Date(historyPostData[0].created_at).toLocaleDateString('sv-SE', {year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'JST'})} ~ ${new Date(historyPostData.slice(-1)[0].created_at).toLocaleDateString('sv-SE', {year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'JST'})} における平均投稿数及び平均いいね数の増減のグラフと、\n${historyPosterData[0].created_at} ~ ${historyPosterData.slice(-1)[0].created_at} における投稿者数の増減のグラフです。`
  const rootPost = await createPost(ctx.agent, ctx.logger, rootText, rootImages)

  const topHistoryData_post_jp = await ctx.db.selectFrom('history').selectAll().orderBy('post_jp', 'desc').executeTakeFirst()
  const topHistoryData_post_all = await ctx.db.selectFrom('history').selectAll().orderBy('post_all', 'desc').executeTakeFirst()
  const topHistoryData_like_jp = await ctx.db.selectFrom('history').selectAll().orderBy('like_jp', 'desc').executeTakeFirst()
  const topHistoryData_like_all = await ctx.db.selectFrom('history').selectAll().orderBy('like_all', 'desc').executeTakeFirst()
  const topHistoryPosterData_jp = await ctx.db.selectFrom('history_poster').selectAll().orderBy('jp', 'desc').executeTakeFirst()
  const topHistoryPosterData_all = await ctx.db.selectFrom('history_poster').selectAll().orderBy('all', 'desc').executeTakeFirst()
  if (!topHistoryData_post_jp || !topHistoryData_post_all || !topHistoryData_like_jp || !topHistoryData_like_all || !topHistoryPosterData_jp || !topHistoryPosterData_all) {
    ctx.logger.error('最高記録算出不可')
    return
  }
  const child1Text = `【年間報告】(2/3)\n\n以下、今年の最高記録を発表します。\n\n日本語を含む投稿: ${new Date(topHistoryData_post_jp.created_at).toLocaleString('sv-SE', {year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'JST'})}: ${topHistoryData_post_jp.post_jp.toLocaleString('ja-JP')} [post/min]\n全ての投稿　　　: ${new Date(topHistoryData_post_all.created_at).toLocaleString('sv-SE', {year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'JST'})}: ${topHistoryData_post_all.post_all.toLocaleString('ja-JP')} [post/min]\n\n日本語を含む投稿へのいいね: ${new Date(topHistoryData_like_jp.created_at).toLocaleString('sv-SE', {year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'JST'})}: ${topHistoryData_like_jp.like_jp.toLocaleString('ja-JP')} [like/min]\n全てのいいね　　　　　　　: ${new Date(topHistoryData_like_all.created_at).toLocaleString('sv-SE', {year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'JST'})}: ${topHistoryData_like_all.like_all.toLocaleString('ja-JP')} [like/min]`
  const child1 = await createPost(ctx.agent, ctx.logger, child1Text, [], {root: rootPost, parent: rootPost})
  const child2Text = `【年間報告】(3/3)\n\n日本語話者数: ${topHistoryPosterData_jp.created_at}: ${topHistoryPosterData_jp.jp.toLocaleString('ja-JP')} [poster/day]\n全投稿者数　: ${topHistoryPosterData_all.created_at}: ${topHistoryPosterData_all.all.toLocaleString('ja-JP')} [poster/day]`
  await createPost(ctx.agent, ctx.logger, child2Text, [], {root: rootPost, parent: child1})
}

const createPost = async (agent: AtpAgent, logger: Logger, text: string, images: AppBskyEmbedImages.Image[], reply?: {root: {cid: string, uri: string}, parent: {cid: string, uri: string}}): Promise<{uri: string, cid: string}> => {
  try {
    const record: Partial<AppBskyFeedPost.Record> & Omit<AppBskyFeedPost.Record, 'createdAt'> = {$type: 'app.bsky.feed.post', text, langs: ['ja']}
    if (images.length > 0) record.embed = {$type: 'app.bsky.embed.images', images}
    if (reply) record.reply = reply
    const res = await agent.post(record)
    logger.info(text)
    return res
  } catch (e: unknown) {
    if (e instanceof XRPCError) {
      logger.error(`AtpAgent could not create post. ( ${e.message.replace('Error: ', '')} ) Try again now...`)
    } else {
      logger.error(`AtpAgent could not create post. Try again now...`)
    }
    return await createPost(agent, logger, text, images)
  }
}

const generateImageLex = async (agent: AtpAgent, logger: Logger, imageData: imageData): Promise<AppBskyEmbedImages.Image> => {
  try {
    const uploaded = await agent.uploadBlob(imageData.buffer)
    return {$type: 'app.bsky.embed.images#image', image: uploaded.data.blob, aspectRatio: {...imageData.aspectRatio}, alt: imageData.title}
  } catch (e: unknown) {
    if (e instanceof XRPCError) {
      logger.error(`AtpAgent could not upload blob. ( ${e.message.replace('Error: ', '')} ) Try again now...`)
    } else {
      logger.error(`AtpAgent could not upload blob. Try again now...`)
    }
    return await generateImageLex(agent, logger, imageData)
  }
}

const getDifference = (a: Set<string>, b: Set<string>): Set<string> => {
  return new Set(
    [...a].filter(v => !b.has(v))
  )
}

const getAllPosts = async (agent: AtpAgent, logger: Logger, uris: string[]): Promise<AppBskyFeedGetPosts.OutputSchema['posts']> => {
  const maxUriSize = 25
  const posts: AppBskyFeedGetPosts.OutputSchema['posts'] = []
  for (const sepUris of uris.flatMap((_, i, a) => i % maxUriSize ? [] : [a.slice(i, i + maxUriSize)])) {
    posts.push(...(await getPosts(agent, logger, sepUris)))
  }
  return posts
}

const getPosts = async (agent: AtpAgent, logger: Logger, uris: string[]): Promise<AppBskyFeedGetPosts.OutputSchema['posts']> => {
  try {
    return (await agent.getPosts({uris})).data.posts
  } catch (e: unknown) {
    if (e instanceof XRPCError) {
      logger.error(`AtpAgent could not get posts. ( ${e.message.replace('Error: ', '')} ) Try again now...`)
    } else {
      logger.error(`AtpAgent could not get posts. Try again now...`)
    }
    return await getPosts(agent, logger, uris)
  }
}

export const isJa = (record: unknown): boolean => {
  if (record && typeof record === 'object') {
    let searchtext: string = ''
    if ('text' in record) searchtext += `${record.text}\n`
    if ('embed' in record && record.embed && typeof record.embed === 'object') {
      if ('images' in record.embed && Array.isArray(record.embed.images)) {
        for (const image of record.embed.images) searchtext += `${image.alt}\n`
      }
      if ('media' in record.embed && record.embed.media && typeof record.embed.media === 'object' && 'images' in record.embed.media && Array.isArray(record.embed.media.images)) {
        for (const image of record.embed.media.images) searchtext += `${image.alt}\n`
      }
      if ('alt' in record.embed) searchtext += `${record.embed.alt}\n`
    }
    if (('langs' in record && Array.isArray(record.langs) && record.langs.includes('ja')) || searchtext.match(/^.*[ぁ-んァ-ヶｱ-ﾝﾞﾟー]+.*$/)) {
      return true
    }
  }
  return false
}

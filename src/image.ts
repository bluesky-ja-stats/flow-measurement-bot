import { Chart } from 'chart.js/auto'
import { createCanvas } from '@napi-rs/canvas'
import type { SelectHistory } from './db/types'
import type { imageData } from './types'

Chart.register([{
  id: 'customCanvasBackgroundColor',
  beforeDraw: (chart,) => {
    const { ctx } = chart
    ctx.save()
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, chart.width, chart.height)
    ctx.restore()
  }
}])

export function generateDailyPostImage(data: SelectHistory[]): imageData {
  const title = `24-hour Post per Minute / ${new Date(data[0].created_at).toLocaleString('sv-SE', {year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'JST'})} ~ ${new Date(data.slice(-1)[0].created_at).toLocaleString('sv-SE', {year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'JST'})}`
  const width = 1920
  const height = 1080
  const canvas = createCanvas(width, height)
  const context = canvas.getContext('2d')

  new Chart(context, {
    type: 'line', data: {
      labels: data.map((d) => new Date(d.created_at).toLocaleTimeString('ja-JP', {hour: '2-digit', minute: '2-digit', timeZone: 'JST'})),
      datasets: [
        { data: data.map(d => d.post_all), label: 'ALL', borderColor: 'blue', pointBackgroundColor: 'blue', yAxisID: 'yAll', backgroundColor: 'blue' },
        { data: data.map(d => d.post_jp), label: 'JP', borderColor: 'red', pointBackgroundColor: 'red', yAxisID: 'yJP', backgroundColor: 'red' },
      ],
    }, options: {
      font: { size: 50 },
      plugins: {
        title: {display: true, text: title, font: {size: 32}},
        legend: {position: 'bottom', labels: {font: {size: 30}}},
      },
      scales: {
        yAll: { position: 'left', min: 0, suggestedMax: 8000, ticks: { font: { size: 24 } }, title: { text: 'All  [post/min]', display: true, padding: 8, font: { size: 32 } }, },
        yJP: { position: 'right', min: 0, suggestedMax: 800, ticks: { font: { size: 24 } }, title: { text: 'JP  [post/min]', display: true, padding: 8, font: { size: 32 }, }, },
        x: { ticks: { font: { size: 24, }, autoSkip: true, maxRotation: 0 } }
      },
    },
  })

  const buffer = canvas.toBuffer('image/png')
  return { title, buffer, aspectRatio: {width, height}}
}

export function generateDailyLikeImage(data: SelectHistory[]): imageData {
  const title = `24-hour Like per Minute / ${new Date(data[0].created_at).toLocaleString('sv-SE', {year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'JST'})} ~ ${new Date(data.slice(-1)[0].created_at).toLocaleString('sv-SE', {year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'JST'})}`
  const width = 1920
  const height = 1080
  const canvas = createCanvas(width, height)
  const context = canvas.getContext('2d')

  new Chart(context, {
    type: 'line', data: {
      labels: data.map((d) => new Date(d.created_at).toLocaleTimeString('ja-JP', {hour: '2-digit', minute: '2-digit', timeZone: 'JST'})),
      datasets: [
        { data: data.map(d => d.like_all), label: 'ALL', borderColor: 'blue', pointBackgroundColor: 'blue', yAxisID: 'yAll', backgroundColor: 'blue' },
        { data: data.map(d => d.like_jp), label: 'JP', borderColor: 'red', pointBackgroundColor: 'red', yAxisID: 'yJP', backgroundColor: 'red' },
      ],
    }, options: {
      font: { size: 50 },
      plugins: {
        title: {display: true, text: title, font: {size: 32}},
        legend: {position: 'bottom', labels: {font: {size: 30}}},
      },
      scales: {
        yAll: { position: 'left', min: 0, suggestedMax: 30000, ticks: { font: { size: 24 } }, title: { text: 'All  [like/min]', display: true, padding: 8, font: { size: 32 } }, },
        yJP: { position: 'right', min: 0, suggestedMax: 3000, ticks: { font: { size: 24 } }, title: { text: 'JP  [like/min]', display: true, padding: 8, font: { size: 32 }, }, },
        x: { ticks: { font: { size: 24, }, autoSkip: true, maxRotation: 0 } }
      },
    },
  })

  const buffer = canvas.toBuffer('image/png')
  return { title, buffer, aspectRatio: {width, height}}
}

export function generateWeeklyPostImage(data: SelectHistory[]): imageData {
  const title = `One-week Post per Minute / ${new Date(data[0].created_at).toLocaleString('sv-SE', {year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'JST'})} ~ ${new Date(data.slice(-1)[0].created_at).toLocaleString('sv-SE', {year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'JST'})}`
  const width = 1920
  const height = 1080
  const canvas = createCanvas(width, height)
  const context = canvas.getContext('2d')

  new Chart(context, {
    type: 'line', data: {
      labels: data.map((d) => new Date(d.created_at).toLocaleString('ja-JP', {month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'JST'})),
      datasets: [
        { data: data.map(d => d.post_all), label: 'ALL', borderColor: 'blue', pointBackgroundColor: 'blue', yAxisID: 'yAll', backgroundColor: 'blue' },
        { data: data.map(d => d.post_jp), label: 'JP', borderColor: 'red', pointBackgroundColor: 'red', yAxisID: 'yJP', backgroundColor: 'red' },
      ],
    }, options: {
      font: { size: 50 },
      plugins: {
        title: {display: true, text: title, font: {size: 32}},
        legend: {position: 'bottom', labels: {font: {size: 30}}},
      },
      scales: {
        yAll: { position: 'left', min: 0, suggestedMax: 8000, ticks: { font: { size: 24 } }, title: { text: 'All  [post/min]', display: true, padding: 8, font: { size: 32 } }, },
        yJP: { position: 'right', min: 0, suggestedMax: 800, ticks: { font: { size: 24 } }, title: { text: 'JP  [post/min]', display: true, padding: 8, font: { size: 32 }, }, },
        x: { ticks: { font: { size: 24, }, autoSkip: true, maxRotation: 30 } }
      },
    },
  })

  const buffer = canvas.toBuffer('image/png')
  return { title, buffer, aspectRatio: {width, height}}
}

export function generateWeeklyLikeImage(data: SelectHistory[]): imageData {
  const title = `One-week Like per Minute / ${new Date(data[0].created_at).toLocaleString('sv-SE', {year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'JST'})} ~ ${new Date(data.slice(-1)[0].created_at).toLocaleString('sv-SE', {year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'JST'})}`
  const width = 1920
  const height = 1080
  const canvas = createCanvas(width, height)
  const context = canvas.getContext('2d')

  new Chart(context, {
    type: 'line', data: {
      labels: data.map((d) => new Date(d.created_at).toLocaleString('ja-JP', {month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'JST'})),
      datasets: [
        { data: data.map(d => d.like_all), label: 'ALL', borderColor: 'blue', pointBackgroundColor: 'blue', yAxisID: 'yAll', backgroundColor: 'blue' },
        { data: data.map(d => d.like_jp), label: 'JP', borderColor: 'red', pointBackgroundColor: 'red', yAxisID: 'yJP', backgroundColor: 'red' },
      ],
    }, options: {
      font: { size: 50 },
      plugins: {
        title: {display: true, text: title, font: {size: 32}},
        legend: {position: 'bottom', labels: {font: {size: 30}}},
      },
      scales: {
        yAll: { position: 'left', min: 0, suggestedMax: 30000, ticks: { font: { size: 24 } }, title: { text: 'All  [like/min]', display: true, padding: 8, font: { size: 32 } }, },
        yJP: { position: 'right', min: 0, suggestedMax: 3000, ticks: { font: { size: 24 } }, title: { text: 'JP  [like/min]', display: true, padding: 8, font: { size: 32 }, }, },
        x: { ticks: { font: { size: 24, }, autoSkip: true, maxRotation: 30 } }
      },
    },
  })

  const buffer = canvas.toBuffer('image/png')
  return { title, buffer, aspectRatio: {width, height}}
}

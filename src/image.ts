import { Chart } from 'chart.js/auto'
import { createCanvas } from '@napi-rs/canvas'
import type { SelectHistory, SelectPosterHistory } from './db/types'
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

export function generateAllPosterImage(prefix: string, data: SelectPosterHistory[]): imageData {
  const title = `${prefix} All Poster per Day / ${data[0].created_at} ~ ${data.slice(-1)[0].created_at}`
  const width = 1920
  const height = 1080
  const canvas = createCanvas(width, height)
  const context = canvas.getContext('2d')

  new Chart(context, {
    data: {
      labels: data.map((d) => d.created_at),
      datasets: [
        {data: data.map(d => d.all_increase), type: 'line', label: 'Increase', borderColor: 'rgba(64, 192, 64, 1)', backgroundColor: 'rgba(64, 192, 64, 1)'},
        {data: data.map(d => d.all_decrease), type: 'line', label: 'Decrease', borderColor: 'rgba(0, 128, 0, 1)', backgroundColor: 'rgba(0, 128, 0, 1)'},
        {data: data.map(d => d.all), type: 'bar', label: 'ALL', backgroundColor: 'rgba(25, 125, 238, 0.5)', categoryPercentage: 1, barPercentage: 0.8},
      ],
    }, options: {
      font: { size: 50 },
      elements: {point: {radius: 0}},
      layout: {padding: {right: 100}},
      plugins: {
        title: {display: true, text: title, font: {size: 32}},
        legend: {position: 'bottom', labels: {font: {size: 30}}},
      },
      scales: {
        y: { position: 'left', min: 0, suggestedMax: 800000, ticks: { font: { size: 24 } }, title: { text: '[account/day]', display: true, padding: 8, font: { size: 32 } }, },
        x: { ticks: { font: { size: 24, }, autoSkip: true, maxRotation: 30 } }
      },
    },
  })

  const buffer = canvas.toBuffer('image/png')
  return { title, buffer, aspectRatio: {width, height}}
}

export function generateJpPosterImage(prefix: string, data: SelectPosterHistory[]): imageData {
  const title = `${prefix} JP Poster per Day / ${data[0].created_at} ~ ${data.slice(-1)[0].created_at}`
  const width = 1920
  const height = 1080
  const canvas = createCanvas(width, height)
  const context = canvas.getContext('2d')

  new Chart(context, {
    data: {
      labels: data.map((d) => d.created_at),
      datasets: [
        {data: data.map(d => d.jp_increase), type: 'line', label: 'Increase', borderColor: 'rgba(64, 192, 64, 1)', backgroundColor: 'rgba(64, 192, 64, 1)'},
        {data: data.map(d => d.jp_decrease), type: 'line', label: 'Decrease', borderColor: 'rgba(0, 128, 0, 1)', backgroundColor: 'rgba(0, 128, 0, 1)'},
        {data: data.map(d => d.jp), type: 'bar', label: 'JP', backgroundColor: 'rgba(255, 32, 32, 0.5)', categoryPercentage: 1, barPercentage: 0.8},
      ],
    }, options: {
      font: { size: 50 },
      elements: {point: {radius: 0}},
      layout: {padding: {right: 100}},
      plugins: {
        title: {display: true, text: title, font: {size: 32}},
        legend: {position: 'bottom', labels: {font: {size: 30}}},
      },
      scales: {
        y: { position: 'left', min: 0, suggestedMax: 80000, ticks: { font: { size: 24 } }, title: { text: '[account/day]', display: true, padding: 8, font: { size: 32 } }, },
        x: { ticks: { font: { size: 24, }, autoSkip: true, maxRotation: 30 } }
      },
    },
  })

  const buffer = canvas.toBuffer('image/png')
  return { title, buffer, aspectRatio: {width, height}}
}

export function generateAveragePostImage(prefix: string, data: SelectHistory[], searchString: string): imageData {
  const sortedData: {[k: string]: {all: number[], ja: number[]}} = {}
  for (const d of data) {
    const targetDay = new Date(d.created_at).toLocaleDateString('sv-SE', {year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'JST'})
    if (targetDay.includes(searchString)){
      if (!(targetDay in sortedData)) sortedData[targetDay] = {all: [], ja: []}
      sortedData[targetDay].all.push(d.post_all)
      sortedData[targetDay].ja.push(d.post_jp)
    }
  }
  const title = `${prefix} Average of Post per Minute / ${Object.keys(sortedData)[0]} ~ ${Object.keys(sortedData).slice(-1)[0]}`
  const width = 1920
  const height = 1080
  const canvas = createCanvas(width, height)
  const context = canvas.getContext('2d')

  new Chart(context, {
    type: 'line', data: {
      labels: Object.keys(sortedData),
      datasets: [
        { data: Object.values(sortedData).map(d => d.all.reduce((a, b) => a + b) / d.all.length), label: 'ALL', borderColor: 'blue', pointBackgroundColor: 'blue', yAxisID: 'yAll', backgroundColor: 'blue' },
        { data: Object.values(sortedData).map(d => d.ja.reduce((a, b) => a + b) / d.ja.length), label: 'JP', borderColor: 'red', pointBackgroundColor: 'red', yAxisID: 'yJP', backgroundColor: 'red' },
      ],
    }, options: {
      font: { size: 50 },
      elements: {point: {radius: 0}},
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

export function generateAverageLikeImage(prefix: string, data: SelectHistory[], searchString: string): imageData {
  const sortedData: {[k: string]: {all: number[], ja: number[]}} = {}
  for (const d of data) {
    const targetDay = new Date(d.created_at).toLocaleDateString('sv-SE', {year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'JST'})
    if (targetDay.includes(searchString)){
      if (!(targetDay in sortedData)) sortedData[targetDay] = {all: [], ja: []}
      sortedData[targetDay].all.push(d.like_all)
      sortedData[targetDay].ja.push(d.like_jp)
    }
  }
  const title = `${prefix} Average of Like per Minute / ${Object.keys(sortedData)[0]} ~ ${Object.keys(sortedData).slice(-1)[0]}`
  const width = 1920
  const height = 1080
  const canvas = createCanvas(width, height)
  const context = canvas.getContext('2d')

  new Chart(context, {
    type: 'line', data: {
      labels: Object.keys(sortedData),
      datasets: [
        { data: Object.values(sortedData).map(d => d.all.reduce((a, b) => a + b) / d.all.length), label: 'ALL', borderColor: 'blue', pointBackgroundColor: 'blue', yAxisID: 'yAll', backgroundColor: 'blue' },
        { data: Object.values(sortedData).map(d => d.ja.reduce((a, b) => a + b) / d.ja.length), label: 'JP', borderColor: 'red', pointBackgroundColor: 'red', yAxisID: 'yJP', backgroundColor: 'red' },
      ],
    }, options: {
      font: { size: 50 },
      elements: {point: {radius: 0}},
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

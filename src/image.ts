import { createCanvas } from '@napi-rs/canvas';
import { Chart, } from 'chart.js/auto';
import type { SelectHistory } from './db/types';

Chart.register([{
	id: 'customCanvasBackgroundColor',
	beforeDraw: (chart,) => {
		const { ctx } = chart;
		ctx.save();
		ctx.fillStyle = '#fff';
		ctx.fillRect(0, 0, chart.width, chart.height);
		ctx.restore();
	}
}])

export function generateDailyImage(data: SelectHistory[]): { buffer: Buffer, height: number, width: number } {
	const height = 720;
	const width = 1280;
	const canvas = createCanvas(width, height);
	const context = canvas.getContext('2d')

	new Chart(context, {
		type: "line", data: {
			labels: data.map((d) => new Date(d.created_at).toLocaleTimeString("ja-JP", { minute: "2-digit", hour: "2-digit" })),
			datasets: [
				{ data: data.map(d => d.post_all), label: "ALL", borderColor: "blue", pointBackgroundColor: "blue", yAxisID: "yAll", backgroundColor: "blue" },
				{ data: data.map(d => d.post_jp), label: "JP", borderColor: "red", pointBackgroundColor: "red", yAxisID: "yJP", backgroundColor: "red" },
			],
		}, options: {
			font: { size: 50 },
			plugins: { legend: { labels: { font: { size: 30 } }, }, },
			scales: {
				yAll: { position: "left", min: 0, suggestedMax: 7500, ticks: { font: { size: 16 } }, title: { text: "All  [post/min]", display: true, padding: 5, font: { size: 20 } }, },
				yJP: { position: "right", min: 0, suggestedMax: 750, ticks: { font: { size: 16 } }, title: { text: "JP  [post/min]", display: true, padding: 5, font: { size: 20 }, }, },
				x: { ticks: { font: { size: 18, }, autoSkip: true, maxRotation: 0 } }
			}
		},
	})

	const buffer = canvas.toBuffer("image/jpeg")
	return { buffer, height, width }
}
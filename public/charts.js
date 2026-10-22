import {
  TOKEN_SERIES,
  escapeHtml,
  formatCompactNumber,
  formatMoney,
  formatNumber,
  periodLabel,
} from './formatters.js';

function niceCeiling(value) {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const exponent = Math.floor(Math.log10(value));
  const fraction = value / 10 ** exponent;
  let nice;
  if (fraction <= 1) nice = 1;
  else if (fraction <= 2) nice = 2;
  else if (fraction <= 5) nice = 5;
  else nice = 10;
  return nice * 10 ** exponent;
}

function costAxisLabel(value) {
  if (value === 0) return '$0';
  if (value < 0.1) return `$${value.toFixed(3)}`;
  if (value < 10) return `$${value.toFixed(1).replace(/\.0$/, '')}`;
  return `$${formatCompactNumber(value)}`;
}

function tokenAxisLabel(value) {
  return formatCompactNumber(value);
}

function labelIndices(length, maxLabels) {
  const step = Math.max(1, Math.ceil(length / maxLabels));
  const indices = [];
  for (let index = 0; index < length; index += step) indices.push(index);
  const last = length - 1;
  if (indices.length === 0 || last - indices[indices.length - 1] >= Math.max(1, step / 2)) {
    indices.push(last);
  }
  return new Set(indices);
}

function tooltipLabel(row, report) {
  const label = periodLabel(row.period, report);
  return `${label.full}: ${formatNumber(row.totalTokens)} tokens, ${formatMoney(row.totalCost)}`;
}

export function chartHeightForWidth(width) {
  return width < 540 ? 296 : 340;
}

export function renderChart({ rows, report, metric, width }) {
  const safeWidth = Math.max(280, Math.round(width || 800));
  const compact = safeWidth < 540;
  const height = chartHeightForWidth(safeWidth);
  const margin = compact
    ? { top: 20, right: 10, bottom: 36, left: 48 }
    : { top: 22, right: 17, bottom: 40, left: 58 };
  const plotWidth = Math.max(120, safeWidth - margin.left - margin.right);
  const plotHeight = height - margin.top - margin.bottom;
  const bottom = margin.top + plotHeight;
  const top = margin.top;

  if (!rows.length) {
    return `
      <div class="chart-empty" style="min-height:${height}px">
        <div>
          <strong>Nothing to draw yet.</strong>
          ccusage found no usage in this window.
        </div>
      </div>`;
  }

  const values =
    metric === 'cost'
      ? rows.map((row) => Number(row.totalCost) || 0)
      : rows.map((row) => Number(row.totalTokens) || 0);
  const rawMax = Math.max(...values, 0);
  if (rawMax <= 0) {
    return `
      <div class="chart-empty" style="min-height:${height}px">
        <div>
          <strong>${metric === 'cost' ? 'No cost to show.' : 'No tokens to show.'}</strong>
          ${
            metric === 'cost'
              ? 'These models may be unpriced. Add a rate in Settings to estimate spend.'
              : 'ccusage found no token activity in this window.'
          }
        </div>
      </div>`;
  }

  const maxValue = niceCeiling(rawMax * 1.08);
  const band = plotWidth / rows.length;
  const maxBarWidth = rows.length <= 2 ? 42 : 27;
  const barWidth = Math.max(2.5, Math.min(maxBarWidth, band * 0.58));
  const tickCount = 4;
  const labelled = labelIndices(rows.length, safeWidth < 520 ? 4 : 9);
  const parts = [];
  const defs = [];

  parts.push(`<title>Usage ${metric === 'cost' ? 'cost' : 'token volume'} over ${rows.length} ${rows.length === 1 ? 'period' : 'periods'}</title>`);
  parts.push(
    `<text class="chart-axis-title" x="${margin.left}" y="10">${metric === 'cost' ? 'ESTIMATED USD' : 'TOKENS'}</text>`,
  );

  for (let tick = 0; tick <= tickCount; tick += 1) {
    const value = (maxValue / tickCount) * tick;
    const y = bottom - (value / maxValue) * plotHeight;
    parts.push(
      `<line class="${tick === 0 ? 'chart-baseline' : 'chart-grid-line'}" x1="${margin.left}" x2="${margin.left + plotWidth}" y1="${y}" y2="${y}" />`,
    );
    parts.push(
      `<text class="chart-axis-text" x="${margin.left - 9}" y="${y + 3}" text-anchor="end">${
        metric === 'cost' ? costAxisLabel(value) : tokenAxisLabel(value)
      }</text>`,
    );
  }

  rows.forEach((row, index) => {
    if (!labelled.has(index)) return;
    const x = margin.left + band * index + band / 2;
    const label = periodLabel(row.period, report);
    parts.push(
      `<text class="chart-axis-text" x="${x}" y="${bottom + 20}" text-anchor="middle">${escapeHtml(label.short)}</text>`,
    );
  });

  if (metric === 'tokens') {
    rows.forEach((row, index) => {
      const xCenter = margin.left + band * index + band / 2;
      const x = xCenter - barWidth / 2;
      let cursor = bottom;
      const indexStyle = `--bar-index:${index}`;
      const segments = [];
      for (const series of TOKEN_SERIES) {
        const value = Number(row[series.key]) || 0;
        if (value <= 0) continue;
        const segmentHeight = (value / maxValue) * plotHeight;
        cursor -= segmentHeight;
        segments.push(
          `<rect class="chart-bar" x="${x.toFixed(2)}" y="${cursor.toFixed(2)}" width="${barWidth.toFixed(2)}" height="${Math.max(segmentHeight, 0.6).toFixed(2)}" fill="${series.color}" rx="${barWidth < 10 ? 1 : 2}" />`,
        );
      }
      parts.push(
        `<g class="bar-group" tabindex="0" role="img" aria-label="${escapeHtml(tooltipLabel(row, report))}" data-chart-period="${escapeHtml(row.period)}" style="${indexStyle}">
          <title>${escapeHtml(tooltipLabel(row, report))}</title>
          <rect class="bar-hit" x="${(xCenter - band / 2).toFixed(2)}" y="${top}" width="${band.toFixed(2)}" height="${plotHeight}" />
          ${segments.join('')}
        </g>`,
      );
    });
  } else {
    const points = rows.map((row, index) => {
      const x = margin.left + band * index + band / 2;
      const y = bottom - ((Number(row.totalCost) || 0) / maxValue) * plotHeight;
      return { x, y, row, index };
    });
    const linePath = points
      .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)},${point.y.toFixed(2)}`)
      .join(' ');
    const areaPath = `${linePath} L${points[points.length - 1].x.toFixed(2)},${bottom} L${points[0].x.toFixed(2)},${bottom} Z`;
    defs.push(
      `<linearGradient id="cost-area-gradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#e9643f" stop-opacity="0.28" />
        <stop offset="100%" stop-color="#e9643f" stop-opacity="0.015" />
      </linearGradient>`,
    );
    parts.push(`<path class="cost-area" d="${areaPath}" fill="url(#cost-area-gradient)" />`);
    parts.push(
      `<path class="cost-line" pathLength="1" d="${linePath}" fill="none" stroke="#e9643f" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" />`,
    );

    if (rows.length <= 32) {
      for (const point of points) {
        parts.push(
          `<circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="3.1" fill="#f8f5ec" stroke="#e9643f" stroke-width="1.8" pointer-events="none" />`,
        );
      }
    }

    for (const point of points) {
      parts.push(
        `<g class="bar-group" tabindex="0" role="img" aria-label="${escapeHtml(tooltipLabel(point.row, report))}" data-chart-period="${escapeHtml(point.row.period)}" style="--bar-index:${point.index}">
          <title>${escapeHtml(tooltipLabel(point.row, report))}</title>
          <rect class="bar-hit" x="${(point.x - band / 2).toFixed(2)}" y="${top}" width="${band.toFixed(2)}" height="${plotHeight}" />
        </g>`,
      );
    }
  }

  return `<svg class="chart-svg" viewBox="0 0 ${safeWidth} ${height}" width="100%" height="${height}" role="img" aria-label="Usage chart">${
    defs.length ? `<defs>${defs.join('')}</defs>` : ''
  }${parts.join('')}</svg>`;
}

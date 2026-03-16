const fs = require('node:fs');
const path = require('node:path');

const inputPath = process.argv[2];
const outputPathArg = process.argv[3];

if (!inputPath) {
  console.error(
    'Usage: node scripts/generate-artillery-report.js <input.json> [output.html]'
  );
  process.exit(1);
}

let data;
try {
  const raw = fs.readFileSync(inputPath, 'utf8');
  data = JSON.parse(raw);
} catch (err) {
  console.error('Failed to read or parse JSON:', err.message);
  process.exit(1);
}

const report = data.aggregate || data;
const counters = report.counters || {};
const rates = report.rates || {};
const summaries = report.summaries || {};

function getCounter(name) {
  if (typeof counters[name] === 'number') {
    return counters[name];
  }
  return undefined;
}

function getSummary(name) {
  if (summaries && typeof summaries[name] === 'object') {
    return summaries[name];
  }
  return undefined;
}

const derivedLatency =
  report.latency ||
  getSummary('http.response_time') ||
  getSummary('http.response_time.2xx') ||
  {};

const derivedMetrics = {
  scenariosCreated:
    report.scenariosCreated !== undefined
      ? report.scenariosCreated
      : getCounter('vusers.created'),
  scenariosCompleted:
    report.scenariosCompleted !== undefined
      ? report.scenariosCompleted
      : getCounter('vusers.completed'),
  requestsCompleted:
    report.requestsCompleted !== undefined
      ? report.requestsCompleted
      : getCounter('http.requests') || getCounter('http.responses'),
  meanRps:
    report.rps && report.rps.mean !== undefined
      ? report.rps.mean
      : rates['http.request_rate'],
  latency: derivedLatency
};

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toMillis(value) {
  if (value === null || typeof value === 'undefined') {
    return null;
  }
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) {
    return null;
  }
  if (num < 1e12) {
    return num * 1000;
  }
  return num;
}

function formatTimestamp(value) {
  const ms = toMillis(value);
  if (!ms) {
    return 'n/a';
  }
  return new Date(ms).toISOString();
}

function formatNumber(value) {
  if (value === 0) {
    return '0';
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return 'n/a';
}

function formatMs(value) {
  if (value === 0) {
    return '0 ms';
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `${value} ms`;
  }
  return 'n/a';
}

function formatSecondsFromReport(r) {
  const start = toMillis(r.firstMetricAt);
  const end = toMillis(r.lastMetricAt);
  if (!start || !end || end < start) {
    return 'n/a';
  }
  const seconds = Math.round((end - start) / 1000);
  return `${seconds}s`;
}

const phases = Array.isArray(report.phases) ? report.phases : [];
const codes =
  report.codes ||
  Object.fromEntries(
    Object.entries(counters)
      .filter(([key]) => key.startsWith('http.codes.'))
      .map(([key, value]) => [key.replace('http.codes.', ''), value])
  );
const errors =
  report.errors ||
  Object.fromEntries(
    Object.entries(counters)
      .filter(([key]) => key.startsWith('errors.'))
      .map(([key, value]) => [key.replace('errors.', ''), value])
  );

const codeRows = Object.keys(codes).length
  ? Object.entries(codes)
      .map(
        ([code, count]) =>
          `<tr><td>${escapeHtml(code)}</td><td>${escapeHtml(
            formatNumber(count)
          )}</td></tr>`
      )
      .join('')
  : '<tr><td colspan="2">n/a</td></tr>';

const errorRows = Object.keys(errors).length
  ? Object.entries(errors)
      .map(
        ([code, count]) =>
          `<tr><td>${escapeHtml(code)}</td><td>${escapeHtml(
            formatNumber(count)
          )}</td></tr>`
      )
      .join('')
  : '<tr><td colspan="2">n/a</td></tr>';

const phaseRows = phases.length
  ? phases
      .map((phase, index) => {
        const name = phase.name || `Phase ${index + 1}`;
        const duration = formatNumber(phase.duration);
        const arrivalRate = formatNumber(phase.arrivalRate);
        const rampTo = formatNumber(phase.rampTo);
        return `<tr><td>${escapeHtml(
          name
        )}</td><td>${duration}</td><td>${arrivalRate}</td><td>${rampTo}</td></tr>`;
      })
      .join('')
  : '<tr><td colspan="4">n/a</td></tr>';

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Artillery Report</title>
    <style>
      body {
        font-family: Arial, sans-serif;
        margin: 24px;
        color: #1a1a1a;
      }
      h1, h2 {
        margin: 0 0 12px 0;
      }
      .meta {
        margin-bottom: 24px;
        color: #4a4a4a;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 24px;
      }
      th, td {
        border: 1px solid #d9d9d9;
        padding: 8px 10px;
        text-align: left;
      }
      th {
        background: #f2f2f2;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 12px;
        margin-bottom: 24px;
      }
      .card {
        border: 1px solid #d9d9d9;
        border-radius: 6px;
        padding: 12px;
        background: #fafafa;
      }
      .label {
        font-size: 12px;
        text-transform: uppercase;
        color: #6a6a6a;
        letter-spacing: 0.04em;
      }
      .value {
        font-size: 20px;
        margin-top: 6px;
      }
    </style>
  </head>
  <body>
    <h1>Artillery Report</h1>
    <div class="meta">
      Generated: ${escapeHtml(formatTimestamp(report.timestamp || report.lastMetricAt))}
      | Duration: ${escapeHtml(formatSecondsFromReport(report))}
    </div>

    <div class="grid">
      <div class="card">
        <div class="label">Scenarios Created</div>
        <div class="value">${escapeHtml(formatNumber(derivedMetrics.scenariosCreated))}</div>
      </div>
      <div class="card">
        <div class="label">Scenarios Completed</div>
        <div class="value">${escapeHtml(formatNumber(derivedMetrics.scenariosCompleted))}</div>
      </div>
      <div class="card">
        <div class="label">Requests Completed</div>
        <div class="value">${escapeHtml(formatNumber(derivedMetrics.requestsCompleted))}</div>
      </div>
      <div class="card">
        <div class="label">Mean RPS</div>
        <div class="value">${escapeHtml(formatNumber(derivedMetrics.meanRps))}</div>
      </div>
    </div>

    <h2>Latency</h2>
    <table>
      <thead>
        <tr>
          <th>Min</th>
          <th>Median</th>
          <th>P95</th>
          <th>P99</th>
          <th>Max</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${escapeHtml(formatMs(derivedMetrics.latency.min))}</td>
          <td>${escapeHtml(formatMs(derivedMetrics.latency.median))}</td>
          <td>${escapeHtml(formatMs(derivedMetrics.latency.p95))}</td>
          <td>${escapeHtml(formatMs(derivedMetrics.latency.p99))}</td>
          <td>${escapeHtml(formatMs(derivedMetrics.latency.max))}</td>
        </tr>
      </tbody>
    </table>

    <h2>Phases</h2>
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Duration (s)</th>
          <th>Arrival Rate</th>
          <th>Ramp To</th>
        </tr>
      </thead>
      <tbody>
        ${phaseRows}
      </tbody>
    </table>

    <h2>Response Codes</h2>
    <table>
      <thead>
        <tr>
          <th>Code</th>
          <th>Count</th>
        </tr>
      </thead>
      <tbody>
        ${codeRows}
      </tbody>
    </table>

    <h2>Errors</h2>
    <table>
      <thead>
        <tr>
          <th>Error</th>
          <th>Count</th>
        </tr>
      </thead>
      <tbody>
        ${errorRows}
      </tbody>
    </table>
  </body>
</html>`;

const defaultOutput =
  outputPathArg ||
  path.join(
    path.dirname(inputPath),
    `${path.basename(inputPath, path.extname(inputPath))}.html`
  );

fs.writeFileSync(defaultOutput, html, 'utf8');
console.log(`HTML report written to ${defaultOutput}`);

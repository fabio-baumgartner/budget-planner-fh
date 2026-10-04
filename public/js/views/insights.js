// Auswertungs-Karten: Prognose Monatsende, Verlauf der letzten 6 Monate (ausführlich und als Mini-Version).
import { history, EARLY_DAYS } from '../calc.js';
import { esc, moneyWithSymbol, monthLabel, monthShort, dateLabel } from '../format.js';

// ---------- Mini-Verlauf fürs Dashboard: nur Balken, keine Achse, keine Kennzahlen ----------

export function miniTrendCard(doc, month, cur) {
  const h = history(doc, month, 6);
  const peak = Math.max(1, ...h.months.flatMap((m) => [m.income, m.expenses]));
  const pct = (v) => ((v / peak) * 100).toFixed(1);

  const bars = h.months
    .map((m, i) => {
      const label = `${monthLabel(m.month)}: Einnahmen ${moneyWithSymbol(m.income, cur)}, Ausgaben ${moneyWithSymbol(m.expenses, cur)}${m.over ? ', über Budget' : ''}`;
      return `
        <button type="button" class="mini-month ${m.month === month ? 'is-selected' : ''}" style="--i:${i}" data-action="select-month" data-month="${m.month}"
          title="${esc(label)}" aria-label="${esc(label)}">
          <span class="pair">
            ${m.hasData ? `<span class="b in gy" style="height:${pct(m.income)}%"></span><span class="b out gy" style="height:${pct(m.expenses)}%"></span>` : ''}
            ${m.over ? '<span class="chart-over flag" aria-hidden="true">!</span>' : ''}
          </span>
          <small>${esc(monthShort(m.month))}</small>
        </button>`;
    })
    .join('');

  return `
    <section class="card trend-mini dash-trend" aria-label="Letzte 6 Monate">
      <div class="card-head">
        <h2 class="card-title">Letzte 6 Monate</h2>
        <a class="link" href="#auswertungen">Zur Auswertung →</a>
      </div>
      <div class="chart-key" aria-hidden="true"><span><i class="k-income"></i>Einnahmen</span><span><i class="k-expense"></i>Ausgaben</span></div>
      <div class="mini-bars">${bars}</div>
    </section>`;
}

// ---------- Prognose Monatsende ----------

const FORECAST_STATUS = {
  ok: { label: 'Im Plan', icon: '✓' },
  tight: { label: 'Knapp', icon: '!' },
  over: { label: 'Über Budget', icon: '!' },
};

export function forecastCard(f, cur) {
  if (f.early) return earlyForecastCard(f, cur);
  const status = FORECAST_STATUS[f.status];
  const end = dateLabel(f.endDate);
  const spentSoFar = f.fixed + f.variableSoFar;
  // Skala mit etwas Luft über dem größeren Wert, damit die Limit-Markierung sichtbar bleibt.
  const scale = Math.max(f.limit, f.projectedExpenses, 1) * 1.08;
  const pct = (v) => Math.min((v / scale) * 100, 100).toFixed(1);
  const days = `${f.daysElapsed} ${f.daysElapsed === 1 ? 'Tag' : 'Tage'}`;

  let sentence;
  if (f.limit <= 0) sentence = 'Lege ein Budget fest, um die Prognose damit zu vergleichen.';
  else if (f.status === 'over') sentence = `Bei deinem aktuellen Tempo liegst du am ${end} ca. ${moneyWithSymbol(f.difference, cur)} über dem Budget.`;
  else if (f.status === 'tight') sentence = `Es wird knapp: voraussichtlich nur ${moneyWithSymbol(-f.difference, cur)} Luft bis zum Limit.`;
  else sentence = `Du bleibst voraussichtlich ${moneyWithSymbol(-f.difference, cur)} unter deinem Budget.`;

  const past = f.historyMonths
    ? ` + Ø ${f.historyMonths === 1 ? 'des letzten Monats' : `der letzten ${f.historyMonths} Monate`}`
    : ' (noch keine Vormonate)';
  const basis = `Basis: ${days} dieses Monats${past}. Fixkosten und geplante Buchungen werden nicht hochgerechnet.`;

  return `
    <section class="card forecast-card" aria-label="Prognose Monatsende">
      <div class="card-head">
        <h2 class="card-title">Prognose Monatsende</h2>
        <span class="sticker ${f.status}"><span aria-hidden="true">${status.icon} </span>${status.label}</span>
      </div>
      <div>
        <div class="forecast-value">≈ ${moneyWithSymbol(f.projectedExpenses, cur)}</div>
        <div class="forecast-caption">voraussichtliche Ausgaben bis ${esc(end)}</div>
      </div>
      <div class="meter" role="img"
        aria-label="Bisher ${moneyWithSymbol(spentSoFar, cur)}, Prognose ${moneyWithSymbol(f.projectedExpenses, cur)}, Budget-Limit ${moneyWithSymbol(f.limit, cur)}">
        <div class="meter-track">
          <span class="meter-projected gx" style="width:${pct(f.projectedExpenses)}%"></span>
          <span class="meter-spent gx" style="width:${pct(spentSoFar)}%"></span>
        </div>
        ${f.limit > 0 ? `<span class="meter-limit" style="left:${pct(f.limit)}%"></span>` : ''}
      </div>
      <div class="chart-key" aria-hidden="true">
        <span><i class="k-spent"></i>Bisher</span>
        <span><i class="k-projected"></i>Prognose</span>
        ${f.limit > 0 ? '<span><i class="k-marker"></i>Limit</span>' : ''}
      </div>
      <p class="forecast-text">${esc(sentence)}</p>
      <div class="mini-stats">
        <div><small>Noch pro Tag drin</small><strong>${moneyWithSymbol(f.dailyAllowance, cur, 2)}</strong></div>
        <div><small>Übrig am Monatsende</small><strong class="${f.projectedAvailable < 0 ? 'neg' : ''}">${f.projectedAvailable < 0 ? '−' : ''}${moneyWithSymbol(f.projectedAvailable, cur)}</strong></div>
      </div>
      <p class="card-note">${esc(basis)}</p>
    </section>`;
}

// Erster Monat ohne Vormonate, Tag 1 bis 6: keine Hochrechnung, nur der bisherige Stand.
function earlyForecastCard(f, cur) {
  const spentSoFar = f.fixed + f.variableSoFar;
  const scale = Math.max(f.limit, spentSoFar, 1) * 1.08;
  const pct = (v) => Math.min((v / scale) * 100, 100).toFixed(1);
  return `
    <section class="card forecast-card" aria-label="Prognose Monatsende">
      <div class="card-head">
        <h2 class="card-title">Prognose Monatsende</h2>
        <span class="sticker">Zu früh</span>
      </div>
      <div>
        <div class="forecast-value">Ab dem ${EARLY_DAYS}. Tag</div>
        <div class="forecast-caption">bisher ausgegeben: ${moneyWithSymbol(spentSoFar, cur)}</div>
      </div>
      <div class="meter" role="img" aria-label="Bisher ${moneyWithSymbol(spentSoFar, cur)}, Budget-Limit ${moneyWithSymbol(f.limit, cur)}">
        <div class="meter-track"><span class="meter-spent gx" style="width:${pct(spentSoFar)}%"></span></div>
        ${f.limit > 0 ? `<span class="meter-limit" style="left:${pct(f.limit)}%"></span>` : ''}
      </div>
      <div class="chart-key" aria-hidden="true">
        <span><i class="k-spent"></i>Bisher</span>
        ${f.limit > 0 ? '<span><i class="k-marker"></i>Limit</span>' : ''}
      </div>
      <p class="forecast-text">Ohne Vormonate rechnet die App erst ab dem ${EARLY_DAYS}. Tag hoch. Aus ein, zwei Tagen lässt sich noch nicht sagen, wo du am Monatsende landest.</p>
      <div class="mini-stats">
        <div><small>Noch pro Tag drin</small><strong>${moneyWithSymbol(f.dailyAllowance, cur, 2)}</strong></div>
        <div><small>Bisher ausgegeben</small><strong>${moneyWithSymbol(spentSoFar, cur)}</strong></div>
      </div>
    </section>`;
}

// ---------- Verlauf der letzten 6 Monate ----------

// Runde Achsenschritte: 1, 2, 2,5 oder 5 mal 10^n
function niceScale(maxValue, ticks = 4) {
  const top = Math.max(maxValue, 1);
  const raw = top / ticks;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const n = raw / magnitude;
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * magnitude;
  return { step, max: step * Math.ceil(top / step) };
}

function compact(value) {
  return value >= 1000 ? `${(value / 1000).toLocaleString('de-AT', { maximumFractionDigits: 1 })}k` : String(value);
}

export function trendCard(doc, month, cur) {
  const h = history(doc, month, 6);
  const peak = Math.max(...h.months.flatMap((m) => [m.income, m.expenses, m.limit]));
  const { step, max } = niceScale(peak);
  const pct = (v) => ((v / max) * 100).toFixed(2);
  const ticks = [];
  for (let v = 0; v <= max + step / 2; v += step) ticks.push(v);

  const groups = h.months
    .map((m, i) => {
      const selected = m.month === month;
      const label =
        `${monthLabel(m.month)}: Einnahmen ${moneyWithSymbol(m.income, cur)}, Ausgaben ${moneyWithSymbol(m.expenses, cur)}, ` +
        `Budget-Limit ${moneyWithSymbol(m.limit, cur)}${m.over ? ', über Budget' : ''}`;
      return `
        <button type="button" class="chart-group ${selected ? 'is-selected' : ''}" style="--i:${i}" data-action="select-month" data-month="${m.month}"
          title="${esc(label)}" aria-label="${esc(label)}" ${selected ? 'aria-current="date"' : ''}>
          <span class="chart-bars">
            <span class="bar-slot"><span class="bar income gy" style="height:${pct(m.income)}%"></span></span>
            <span class="bar-slot">
              <span class="bar expense gy" style="height:${pct(m.expenses)}%"></span>
              ${m.limit > 0 && m.hasData ? `<span class="chart-limit" style="bottom:${pct(m.limit)}%"></span>` : ''}
              ${m.over ? `<span class="chart-over" style="bottom:calc(${pct(m.expenses)}% + 6px)" aria-hidden="true">!</span>` : ''}
            </span>
          </span>
          <span class="chart-label"><span>${esc(monthShort(m.month))}</span></span>
        </button>`;
    })
    .join('');

  const rate = h.savingsRate === null ? 'k. A.' : `${h.savingsRate < 0 ? '−' : ''}${Math.abs(Math.round(h.savingsRate * 100))} %`;
  const rows = h.months
    .map(
      (m) =>
        `<tr><td>${esc(monthLabel(m.month))}</td><td>${moneyWithSymbol(m.income, cur)}</td>` +
        `<td>${moneyWithSymbol(m.expenses, cur)}${m.over ? ' (über Budget)' : ''}</td><td>${moneyWithSymbol(m.limit, cur)}</td></tr>`,
    )
    .join('');

  return `
    <section class="card trend-card" aria-label="Verlauf der letzten 6 Monate">
      <div class="card-head">
        <h2 class="card-title">Verlauf · 6 Monate</h2>
        <div class="chart-key" aria-hidden="true">
          <span><i class="k-income"></i>Einnahmen</span>
          <span><i class="k-expense"></i>Ausgaben</span>
          <span><i class="k-limit"></i>Budget-Limit</span>
          <span><i class="chart-over k-over">!</i>Über Budget</span>
        </div>
      </div>
      <div class="chart">
        <div class="chart-axis" aria-hidden="true">
          ${ticks.map((v) => `<span style="bottom:${pct(v)}%">${compact(v)}</span>`).join('')}
        </div>
        <div class="chart-plot">
          <div class="chart-grid" aria-hidden="true">${ticks.map((v) => `<span style="bottom:${pct(v)}%"></span>`).join('')}</div>
          <div class="chart-groups">${groups}</div>
        </div>
      </div>
      <div class="mini-stats three">
        <div><small>Ø Einnahmen</small><strong>${moneyWithSymbol(h.avgIncome, cur)}</strong></div>
        <div><small>Ø Ausgaben</small><strong>${moneyWithSymbol(h.avgExpenses, cur)}</strong></div>
        <div><small>Sparquote</small><strong class="${h.savingsRate !== null && h.savingsRate < 0 ? 'neg' : ''}">${rate}</strong></div>
      </div>
      <table class="sr-only">
        <caption>Einnahmen und Ausgaben der letzten 6 Monate</caption>
        <thead><tr><th>Monat</th><th>Einnahmen</th><th>Ausgaben</th><th>Budget-Limit</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </section>`;
}

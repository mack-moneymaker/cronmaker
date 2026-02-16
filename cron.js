(() => {
  'use strict';

  // === Constants ===
  const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTH_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  const FIELDS_5 = [
    { name: 'Minute', min: 0, max: 59, label: 'minute' },
    { name: 'Hour', min: 0, max: 23, label: 'hour' },
    { name: 'Day of Month', min: 1, max: 31, label: 'day' },
    { name: 'Month', min: 1, max: 12, label: 'month' },
    { name: 'Day of Week', min: 0, max: 6, label: 'weekday' },
  ];

  const SECONDS_FIELD = { name: 'Second', min: 0, max: 59, label: 'second' };

  const PRESETS_5 = [
    { expr: '* * * * *', label: 'Every minute' },
    { expr: '*/5 * * * *', label: 'Every 5 minutes' },
    { expr: '*/15 * * * *', label: 'Every 15 minutes' },
    { expr: '0 * * * *', label: 'Every hour' },
    { expr: '0 */2 * * *', label: 'Every 2 hours' },
    { expr: '0 0 * * *', label: 'Daily at midnight' },
    { expr: '0 9 * * 1', label: 'Every Monday at 9 AM' },
    { expr: '0 9 * * 1-5', label: 'Weekdays at 9 AM' },
    { expr: '0 0 1 * *', label: '1st of month at midnight' },
    { expr: '0 0 1 1 *', label: 'Yearly (Jan 1 midnight)' },
  ];

  const PRESETS_6 = [
    { expr: '* * * * * *', label: 'Every second' },
    { expr: '0 * * * * *', label: 'Every minute' },
    { expr: '*/30 * * * * *', label: 'Every 30 seconds' },
    { expr: '0 0 * * * *', label: 'Every hour' },
    { expr: '0 0 9 * * 1', label: 'Every Monday at 9 AM' },
  ];

  const TYPE_OPTIONS = [
    { value: 'every', label: 'Every (*)' },
    { value: 'specific', label: 'Specific value' },
    { value: 'range', label: 'Range (e.g. 1-5)' },
    { value: 'step', label: 'Step (e.g. */5)' },
  ];

  // === State ===
  let mode = 5;
  let fieldStates = [];

  // === DOM ===
  const $ = s => document.querySelector(s);
  const cronInput = $('#cron-input');
  const humanReadable = $('#human-readable');
  const copyBtn = $('#copy-btn');
  const copyFeedback = $('#copy-feedback');
  const themeToggle = $('#theme-toggle');
  const presetsGrid = $('#presets-grid');
  const fieldGrid = $('#field-grid');
  const execList = $('#executions-list');

  // === Init ===
  function init() {
    initTheme();
    initMode();
    buildFromExpression(cronInput.value);
    renderPresets();
    renderBuilder();
    updateAll();

    cronInput.addEventListener('input', () => {
      buildFromExpression(cronInput.value.trim());
      renderBuilder();
      updateAll();
    });

    copyBtn.addEventListener('click', copyToClipboard);
    themeToggle.addEventListener('click', toggleTheme);
  }

  // === Theme ===
  function initTheme() {
    const saved = localStorage.getItem('cronmaker-theme');
    const theme = saved || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    setTheme(theme);
  }

  function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    themeToggle.textContent = t === 'dark' ? '☀️' : '🌙';
    localStorage.setItem('cronmaker-theme', t);
  }

  function toggleTheme() {
    setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  }

  // === Mode ===
  function initMode() {
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const newMode = parseInt(btn.dataset.mode);
        if (newMode === mode) return;
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        mode = newMode;
        const expr = mode === 6 ? '* * * * * *' : '* * * * *';
        cronInput.value = expr;
        buildFromExpression(expr);
        renderPresets();
        renderBuilder();
        updateAll();
      });
    });
  }

  // === Presets ===
  function renderPresets() {
    const presets = mode === 6 ? PRESETS_6 : PRESETS_5;
    presetsGrid.innerHTML = presets.map(p =>
      `<button class="preset-btn" data-expr="${p.expr}"><span class="preset-expr">${p.expr}</span><span class="preset-label">${p.label}</span></button>`
    ).join('');
    presetsGrid.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        cronInput.value = btn.dataset.expr;
        buildFromExpression(btn.dataset.expr);
        renderBuilder();
        updateAll();
      });
    });
  }

  // === Parse expression into field states ===
  function buildFromExpression(expr) {
    const parts = expr.split(/\s+/);
    const fields = getFields();
    fieldStates = fields.map((f, i) => {
      const val = parts[i] || '*';
      return parseFieldValue(val, f);
    });
  }

  function parseFieldValue(val, field) {
    if (val === '*') return { type: 'every' };
    if (val.startsWith('*/')) {
      const step = parseInt(val.slice(2));
      return isNaN(step) ? { type: 'every' } : { type: 'step', step };
    }
    if (val.includes('-') && !val.includes(',')) {
      const [a, b] = val.split('-').map(Number);
      return { type: 'range', from: isNaN(a) ? field.min : a, to: isNaN(b) ? field.max : b };
    }
    // Specific (could be comma-separated)
    return { type: 'specific', value: val };
  }

  function getFields() {
    return mode === 6 ? [SECONDS_FIELD, ...FIELDS_5] : FIELDS_5;
  }

  function fieldStateToString(state, field) {
    switch (state.type) {
      case 'every': return '*';
      case 'specific': return String(state.value ?? field.min);
      case 'range': return `${state.from ?? field.min}-${state.to ?? field.max}`;
      case 'step': return `*/${state.step ?? 1}`;
      default: return '*';
    }
  }

  // === Builder UI ===
  function renderBuilder() {
    const fields = getFields();
    fieldGrid.innerHTML = fields.map((f, i) => {
      const st = fieldStates[i] || { type: 'every' };
      return `<div class="field-card" data-index="${i}">
        <div class="field-header">
          <span class="field-name">${f.name}</span>
          <span class="field-value" id="fv-${i}">${fieldStateToString(st, f)}</span>
        </div>
        <select class="field-type-select" data-index="${i}">
          ${TYPE_OPTIONS.map(o => `<option value="${o.value}" ${o.value === st.type ? 'selected' : ''}>${o.label}</option>`).join('')}
        </select>
        <div class="field-options" id="fo-${i}">${renderFieldOptions(i, st, f)}</div>
      </div>`;
    }).join('');

    fieldGrid.querySelectorAll('.field-type-select').forEach(sel => {
      sel.addEventListener('change', () => {
        const idx = parseInt(sel.dataset.index);
        const f = fields[idx];
        fieldStates[idx] = { type: sel.value };
        if (sel.value === 'specific') fieldStates[idx].value = f.min;
        if (sel.value === 'range') { fieldStates[idx].from = f.min; fieldStates[idx].to = f.max; }
        if (sel.value === 'step') fieldStates[idx].step = 5;
        document.getElementById(`fo-${idx}`).innerHTML = renderFieldOptions(idx, fieldStates[idx], f);
        bindFieldInputs(idx, f);
        updateFromBuilder();
      });
    });

    fields.forEach((f, i) => bindFieldInputs(i, f));
  }

  function renderFieldOptions(idx, state, field) {
    switch (state.type) {
      case 'every': return '<span style="color:var(--text-muted);font-size:0.8rem">Matches all values</span>';
      case 'specific':
        if (field.label === 'weekday') {
          return `<div class="inline-group">${DAYS.map((d, i) =>
            `<label><input type="checkbox" data-idx="${idx}" data-day="${i}" ${(String(state.value||'').split(',').includes(String(i))) ? 'checked' : ''}> ${d}</label>`
          ).join('')}</div>`;
        }
        if (field.label === 'month') {
          return `<div class="inline-group"><select data-idx="${idx}" data-kind="specific-val" multiple style="min-height:80px">${
            Array.from({length:12},(_,i)=>`<option value="${i+1}" ${(String(state.value||'').split(',').includes(String(i+1))) ? 'selected' : ''}>${MONTHS[i+1]}</option>`).join('')
          }</select></div>`;
        }
        return `<div class="inline-group"><label>Value</label><input type="text" data-idx="${idx}" data-kind="specific-val" value="${state.value ?? field.min}" size="10"></div>`;
      case 'range':
        return `<div class="inline-group"><label>From</label><input type="number" data-idx="${idx}" data-kind="range-from" value="${state.from ?? field.min}" min="${field.min}" max="${field.max}" style="width:70px"><label>To</label><input type="number" data-idx="${idx}" data-kind="range-to" value="${state.to ?? field.max}" min="${field.min}" max="${field.max}" style="width:70px"></div>`;
      case 'step':
        return `<div class="inline-group"><label>Every</label><input type="number" data-idx="${idx}" data-kind="step-val" value="${state.step ?? 1}" min="1" max="${field.max}" style="width:70px"><span style="color:var(--text-muted);font-size:0.8rem">${field.label}(s)</span></div>`;
      default: return '';
    }
  }

  function bindFieldInputs(idx, field) {
    const container = document.getElementById(`fo-${idx}`);
    if (!container) return;

    // Weekday checkboxes
    container.querySelectorAll('input[type=checkbox][data-day]').forEach(cb => {
      cb.addEventListener('change', () => {
        const checked = [...container.querySelectorAll('input[type=checkbox][data-day]:checked')].map(c => c.dataset.day);
        fieldStates[idx].value = checked.length ? checked.join(',') : '*';
        if (checked.length === 0) fieldStates[idx].type = 'every';
        updateFromBuilder();
      });
    });

    // Month multi-select
    const multiSel = container.querySelector('select[multiple]');
    if (multiSel) {
      multiSel.addEventListener('change', () => {
        const vals = [...multiSel.selectedOptions].map(o => o.value);
        fieldStates[idx].value = vals.length ? vals.join(',') : '*';
        if (vals.length === 0) fieldStates[idx].type = 'every';
        updateFromBuilder();
      });
    }

    // Text/number inputs
    container.querySelectorAll('input[data-kind]').forEach(inp => {
      inp.addEventListener('input', () => {
        const kind = inp.dataset.kind;
        if (kind === 'specific-val') fieldStates[idx].value = inp.value;
        if (kind === 'range-from') fieldStates[idx].from = parseInt(inp.value) || field.min;
        if (kind === 'range-to') fieldStates[idx].to = parseInt(inp.value) || field.max;
        if (kind === 'step-val') fieldStates[idx].step = parseInt(inp.value) || 1;
        updateFromBuilder();
      });
    });
  }

  function updateFromBuilder() {
    const fields = getFields();
    const expr = fields.map((f, i) => fieldStateToString(fieldStates[i] || { type: 'every' }, f)).join(' ');
    cronInput.value = expr;
    // Update field value badges
    fields.forEach((f, i) => {
      const el = document.getElementById(`fv-${i}`);
      if (el) el.textContent = fieldStateToString(fieldStates[i] || { type: 'every' }, f);
    });
    updateAll();
  }

  // === Update display ===
  function updateAll() {
    humanReadable.textContent = toHumanReadable(cronInput.value.trim());
    renderExecutions(cronInput.value.trim());
  }

  // === Human readable ===
  function toHumanReadable(expr) {
    const parts = expr.split(/\s+/);
    const is6 = mode === 6;
    const offset = is6 ? 1 : 0;

    const sec = is6 ? parts[0] : null;
    const min = parts[offset] || '*';
    const hr = parts[offset + 1] || '*';
    const dom = parts[offset + 2] || '*';
    const mon = parts[offset + 3] || '*';
    const dow = parts[offset + 4] || '*';

    const pieces = [];

    // Time part
    if (min === '*' && hr === '*') {
      pieces.push('Every minute');
    } else if (min.startsWith('*/')) {
      pieces.push(`Every ${min.slice(2)} minutes`);
    } else if (hr === '*' && /^\d+$/.test(min)) {
      pieces.push(`At minute ${min} of every hour`);
    } else if (/^\d+$/.test(min) && /^\d+$/.test(hr)) {
      const h = parseInt(hr);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      pieces.push(`At ${h12}:${min.padStart(2, '0')} ${ampm}`);
    } else if (hr.startsWith('*/')) {
      pieces.push(`Every ${hr.slice(2)} hours`);
      if (/^\d+$/.test(min)) pieces.push(`at minute ${min}`);
    } else {
      pieces.push(`At ${hr}:${min}`);
    }

    if (is6 && sec && sec !== '0' && sec !== '*') {
      if (sec.startsWith('*/')) pieces.unshift(`Every ${sec.slice(2)} seconds`);
      else if (sec === '*') pieces.unshift('Every second');
    }

    // Day/month/weekday
    if (dow !== '*') {
      const dayNames = dow.split(',').map(d => {
        if (d.includes('-')) {
          const [a, b] = d.split('-').map(Number);
          return `${DAYS[a] || a}–${DAYS[b] || b}`;
        }
        return DAYS[parseInt(d)] || d;
      });
      pieces.push(`on ${dayNames.join(', ')}`);
    }

    if (dom !== '*') pieces.push(`on day ${dom} of the month`);

    if (mon !== '*') {
      const monthNames = mon.split(',').map(m => MONTHS[parseInt(m)] || m);
      pieces.push(`in ${monthNames.join(', ')}`);
    }

    return pieces.join(' ') || expr;
  }

  // === Next executions ===
  function renderExecutions(expr) {
    try {
      const times = getNextExecutions(expr, 10);
      if (times.length === 0) {
        execList.innerHTML = '<li class="exec-error">No upcoming executions found</li>';
        return;
      }
      const now = new Date();
      execList.innerHTML = times.map(t => {
        const diff = t - now;
        const rel = formatRelative(diff);
        return `<li><span>${t.toLocaleString()}</span><span class="exec-relative">${rel}</span></li>`;
      }).join('');
    } catch (e) {
      execList.innerHTML = `<li class="exec-error">Invalid expression</li>`;
    }
  }

  function formatRelative(ms) {
    const s = Math.floor(ms / 1000);
    if (s < 60) return `in ${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `in ${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `in ${h}h ${m % 60}m`;
    const d = Math.floor(h / 24);
    return `in ${d}d ${h % 24}h`;
  }

  function getNextExecutions(expr, count) {
    const parts = expr.split(/\s+/);
    const is6 = mode === 6;
    const offset = is6 ? 1 : 0;

    const secExpr = is6 ? parts[0] : '0';
    const minExpr = parts[offset] || '*';
    const hrExpr = parts[offset + 1] || '*';
    const domExpr = parts[offset + 2] || '*';
    const monExpr = parts[offset + 3] || '*';
    const dowExpr = parts[offset + 4] || '*';

    const secSet = expandField(secExpr, 0, 59);
    const minSet = expandField(minExpr, 0, 59);
    const hrSet = expandField(hrExpr, 0, 23);
    const domSet = expandField(domExpr, 1, 31);
    const monSet = expandField(monExpr, 1, 12);
    const dowSet = expandField(dowExpr, 0, 6);

    const results = [];
    const d = new Date();
    d.setMilliseconds(0);
    if (!is6) d.setSeconds(0);
    d.setTime(d.getTime() + 1000); // start from next second

    const limit = 500000; // safety
    for (let i = 0; i < limit && results.length < count; i++) {
      if (monSet.has(d.getMonth() + 1) &&
          domSet.has(d.getDate()) &&
          dowSet.has(d.getDay()) &&
          hrSet.has(d.getHours()) &&
          minSet.has(d.getMinutes()) &&
          secSet.has(d.getSeconds())) {
        results.push(new Date(d));
        d.setTime(d.getTime() + 1000);
        continue;
      }

      // Skip ahead intelligently
      if (!monSet.has(d.getMonth() + 1)) {
        d.setMonth(d.getMonth() + 1, 1);
        d.setHours(0, 0, 0, 0);
      } else if (!domSet.has(d.getDate()) || !dowSet.has(d.getDay())) {
        d.setDate(d.getDate() + 1);
        d.setHours(0, 0, 0, 0);
      } else if (!hrSet.has(d.getHours())) {
        d.setHours(d.getHours() + 1, 0, 0, 0);
      } else if (!minSet.has(d.getMinutes())) {
        d.setMinutes(d.getMinutes() + 1, 0, 0);
      } else if (!secSet.has(d.getSeconds())) {
        d.setSeconds(d.getSeconds() + 1, 0);
      } else {
        d.setTime(d.getTime() + 1000);
      }
    }
    return results;
  }

  function expandField(expr, min, max) {
    const set = new Set();
    if (expr === '*') {
      for (let i = min; i <= max; i++) set.add(i);
      return set;
    }
    expr.split(',').forEach(part => {
      if (part.includes('/')) {
        const [base, stepStr] = part.split('/');
        const step = parseInt(stepStr) || 1;
        const start = base === '*' ? min : (parseInt(base) || min);
        for (let i = start; i <= max; i += step) set.add(i);
      } else if (part.includes('-')) {
        const [a, b] = part.split('-').map(Number);
        for (let i = a; i <= b; i++) set.add(i);
      } else {
        const v = parseInt(part);
        if (!isNaN(v)) set.add(v);
      }
    });
    return set;
  }

  // === Copy ===
  function copyToClipboard() {
    navigator.clipboard.writeText(cronInput.value.trim()).then(() => {
      copyFeedback.textContent = '✓ Copied!';
      copyFeedback.classList.add('show');
      setTimeout(() => copyFeedback.classList.remove('show'), 2000);
    });
  }

  // === Go ===
  init();
})();

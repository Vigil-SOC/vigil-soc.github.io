/* Home page behaviour: install tabs, copy, use-case filters, History charts, nav highlight. */
(function () {
  'use strict';

  /* ── Install tabs and copy ─────────────────────────────────────── */
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.vh-tab'));
  var copyBtn = document.querySelector('.vh-copy');
  function selectTab(tab) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      var panel = document.getElementById(t.getAttribute('aria-controls'));
      if (panel) panel.hidden = !on;
    });
    if (copyBtn) copyBtn.textContent = 'Copy commands';
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { selectTab(t); });
    t.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      var next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      selectTab(next); next.focus();
    });
  });
  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      var active = document.querySelector('.vh-tab[aria-selected="true"]');
      var panel = active && document.getElementById(active.getAttribute('aria-controls'));
      var text = panel && panel.getAttribute('data-copy');
      if (!text || !navigator.clipboard) return;
      navigator.clipboard.writeText(text).then(function () { copyBtn.textContent = 'Copied'; }, function () {});
    });
  }

  /* ── Use-case filters ──────────────────────────────────────────── */
  var chips = Array.prototype.slice.call(document.querySelectorAll('.vh-chip'));
  var cards = Array.prototype.slice.call(document.querySelectorAll('.vh-uc'));
  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      var group = chip.getAttribute('data-group');
      chips.forEach(function (c) { c.setAttribute('aria-pressed', c === chip ? 'true' : 'false'); });
      cards.forEach(function (card) { card.hidden = group !== 'all' && card.getAttribute('data-group') !== group; });
    });
  });

  /* ── History charts ────────────────────────────────────────────── */
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var SVG = 'http://www.w3.org/2000/svg';
  function addDays(iso, n) {
    var d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function longDate(iso) {
    var d = new Date(iso + 'T00:00:00Z');
    return ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][d.getUTCMonth()] + ' ' + d.getUTCDate() + ', ' + d.getUTCFullYear();
  }
  function full(n) { return n.toLocaleString('en-US'); }
  function compact(n) { return n >= 10000 ? Math.round(n / 1000).toLocaleString('en-US') + 'K' : full(n); }
  // Largest round step that puts at least two gridlines under the latest value.
  function niceStep(max) {
    var raw = max / 2.5, pow = Math.pow(10, Math.floor(Math.log10(raw)));
    var steps = [5, 2.5, 2, 1];
    for (var i = 0; i < steps.length; i++) if (steps[i] * pow <= raw) return steps[i] * pow;
    return pow;
  }

  function draw(fig, series, unit) {
    var plot = fig.querySelector('.vh-plot'), axis = fig.querySelector('.vh-xaxis');
    var n = series.daily.length; if (n < 2) return;
    var last = series.daily[n - 1], step = niceStep(last), ymax = last * 1.08;
    var ticks = [];
    for (var t = 0; t <= ymax * 0.97; t += step) ticks.push(t);
    var W = 1000, H = 300;
    function x(i) { return i * W / (n - 1); }
    function y(v) { return H - v * H / ymax; }

    var svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    ticks.forEach(function (t) {
      var l = document.createElementNS(SVG, 'line');
      l.setAttribute('x1', 0); l.setAttribute('x2', W); l.setAttribute('y1', y(t)); l.setAttribute('y2', y(t));
      l.setAttribute('stroke', '#1f1f21'); l.setAttribute('stroke-opacity', '0.1'); l.setAttribute('vector-effect', 'non-scaling-stroke');
      svg.appendChild(l);
    });
    var pts = series.daily.map(function (v, i) { return x(i).toFixed(1) + ',' + y(v).toFixed(1); });
    var area = document.createElementNS(SVG, 'path');
    area.setAttribute('d', 'M0,' + H + ' L' + pts.join(' L') + ' L' + W + ',' + H + ' Z');
    area.setAttribute('fill', '#486724'); area.setAttribute('fill-opacity', '0.1');
    svg.appendChild(area);
    var line = document.createElementNS(SVG, 'polyline');
    line.setAttribute('points', pts.join(' '));
    line.setAttribute('fill', 'none'); line.setAttribute('stroke', '#486724'); line.setAttribute('stroke-width', '2');
    line.setAttribute('stroke-linejoin', 'round'); line.setAttribute('vector-effect', 'non-scaling-stroke');
    svg.appendChild(line);
    for (var i = 0; i < n; i += 7) {
      var j = Math.min(i + 6, n - 1), hit = document.createElementNS(SVG, 'rect');
      hit.setAttribute('x', x(i)); hit.setAttribute('y', 0); hit.setAttribute('height', H);
      hit.setAttribute('width', Math.max(x(j) - x(i), 4)); hit.setAttribute('fill', '#000'); hit.setAttribute('fill-opacity', '0');
      var tip = document.createElementNS(SVG, 'title'), dd = addDays(series.start, j);
      tip.textContent = longDate(dd) + ': ' + full(series.daily[j]) + ' ' + unit + ' to date';
      hit.appendChild(tip); svg.appendChild(hit);
    }

    plot.textContent = ''; axis.textContent = '';
    plot.appendChild(svg);
    ticks.forEach(function (t) {
      var s = document.createElement('span'); s.className = 'vh-ytick';
      s.style.top = (100 - t * 100 / ymax).toFixed(2) + '%';
      s.textContent = t === 0 ? '0' : compact(t);
      plot.appendChild(s);
    });
    var dot = document.createElement('span'); dot.className = 'vh-end';
    dot.style.top = (100 - last * 100 / ymax).toFixed(2) + '%';
    plot.appendChild(dot);

    var first = new Date(series.start + 'T00:00:00Z'), endIso = addDays(series.start, n - 1);
    var span = (new Date(endIso + 'T00:00:00Z') - first) / 864e5, every = span > 180 ? 2 : 1;
    var m = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 1)), k = 0;
    while (m.toISOString().slice(0, 10) <= endIso) {
      if (k % every === 0) {
        var idx = Math.round((m - first) / 864e5), lab = document.createElement('span');
        lab.className = 'vh-xtick'; lab.style.left = (idx * 100 / (n - 1)).toFixed(2) + '%';
        lab.textContent = MONTHS[m.getUTCMonth()];
        axis.appendChild(lab);
      }
      m = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 1)); k++;
    }

    fig.querySelector('.vh-chart-value').textContent = unit === 'clones' ? compact(last) : full(last);
    fig.querySelector('.vh-chart-since').textContent = 'Since ' + longDate(series.start);
    plot.setAttribute('aria-label', fig.querySelector('.vh-chart-title').textContent + ': ' + full(last) + ' ' + unit + ' from ' + longDate(series.start) + ' to ' + longDate(endIso));
    return endIso;
  }

  var figClones = document.getElementById('chart-clones');
  var figCommits = document.getElementById('chart-commits');
  var note = document.getElementById('chart-asof');
  var asOf = { clones: null, commits: null };
  function setNote() {
    var dates = [asOf.clones, asOf.commits].filter(Boolean).sort();
    if (note && dates.length) note.textContent = 'Data through ' + longDate(dates[0]) + '.';
  }
  function render(kind, series) {
    var fig = kind === 'clones' ? figClones : figCommits;
    if (!fig || !series || !series.daily || series.daily.length < 2) return;
    asOf[kind] = draw(fig, series, kind); setNote();
  }

  // Live clones from the published metrics (refreshed daily).
  function liveClones() {
    return fetch('https://raw.githubusercontent.com/Vigil-SOC/metrics/main/data/traffic_daily.csv', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (text) {
        var rows = text.trim().split(/\r?\n/), head = rows.shift().split(','), di = head.indexOf('date'), ci = head.indexOf('clones');
        if (di < 0 || ci < 0) throw new Error('columns');
        rows = rows.map(function (r) { return r.split(','); }).sort(function (a, b) { return a[di] < b[di] ? -1 : 1; });
        var total = 0, daily = rows.map(function (r) { total += parseInt(r[ci], 10) || 0; return total; });
        return { start: rows[0][di], daily: daily };
      });
  }
  // Live commits: GitHub's weekly commit activity on the default branch, last 52 weeks.
  function liveCommits(baked) {
    return fetch('https://api.github.com/repos/Vigil-SOC/vigil/stats/commit_activity')
      .then(function (r) { if (r.status !== 200) throw new Error(r.status); return r.json(); })
      .then(function (weeks) {
        if (!Array.isArray(weeks) || !weeks.length) throw new Error('empty');
        var start = baked && baked.start, days = [];
        weeks.forEach(function (w) {
          w.days.forEach(function (c, i) { days.push([new Date((w.week + i * 86400) * 1000).toISOString().slice(0, 10), c]); });
        });
        var today = new Date().toISOString().slice(0, 10);
        days = days.filter(function (d) { return d[0] <= today && (!start || d[0] >= start); });
        var firstIdx = 0; while (!start && firstIdx < days.length && days[firstIdx][1] === 0) firstIdx++;
        days = days.slice(firstIdx);
        var total = 0, daily = days.map(function (d) { total += d[1]; return total; });
        return { start: days[0][0], daily: daily };
      });
  }

  if (figClones || figCommits) {
    fetch('/assets/data/momentum.json')
      .then(function (r) { return r.json(); })
      .then(function (baked) {
        render('clones', baked.clones); render('commits', baked.commits);
        liveClones().then(function (s) {
          if (s.daily.length >= baked.clones.daily.length) render('clones', s);
        }).catch(function () {});
        liveCommits(baked.commits).then(function (s) {
          var b = baked.commits.daily, bLast = b[b.length - 1];
          if (s.daily[s.daily.length - 1] >= bLast) render('commits', s);  // never step back from the shipped count
        }).catch(function () {});
      })
      .catch(function () {});
  }

  /* ── Nav highlight ─────────────────────────────────────────────── */
  var links = document.querySelectorAll('.nav-link');
  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (l) { l.classList.remove('active'); });
        var match = document.querySelector('.nav-link[href="#' + entry.target.id + '"]');
        if (match) match.classList.add('active');
      });
    }, { threshold: 0.25 });
    document.querySelectorAll('section[id]').forEach(function (s) { observer.observe(s); });
  }
})();

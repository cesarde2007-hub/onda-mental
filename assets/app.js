/* =========================================================================
   Onda Mental — lógica de la aplicación
   Sin frameworks, sin red. Todo ocurre en el dispositivo.
   ========================================================================= */
(function () {
  'use strict';

  var B = window.BEATLAB;
  var STORAGE_KEY = 'ondamental.journal.v1';
  var CIRC = 2 * Math.PI * 96; // circunferencia del anillo de progreso

  /* ------------------------------------------------------------- helpers */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function formatClock(seconds) {
    var s = Math.max(0, Math.round(seconds));
    var m = Math.floor(s / 60);
    var r = s % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  }

  function formatDate(ts) {
    var d = new Date(ts);
    try {
      return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) +
        ' · ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return d.toISOString().slice(0, 16).replace('T', ' ');
    }
  }

  function formatDelta(n) {
    if (!isFinite(n)) return '—';
    var v = Math.round(n * 10) / 10;
    return (v > 0 ? '+' : '') + v;
  }

  var toastTimer = null;
  function toast(message) {
    var t = $('#toast');
    if (!t) return;
    t.textContent = message;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 3800);
  }

  /* ---------------------------------------------------------------- estado */
  function defaultOpts() {
    return {
      carrier: 200,
      beat: 10,
      beatEnd: 10,
      carrierEnd: 200,
      independent: false,
      sweep: false,
      leftHz: 200,
      rightHz: 210,
      leftEndHz: 200,
      rightEndHz: 210,
      wave: 'sine',
      balance: 0,
      durationSec: 480,
      volume: 28,
      noiseType: 'pink',
      noiseLevel: 5,
      noise: 0.05,
      amEnabled: false,
      amRate: 4,
      amDepth: 50,
      fadeIn: 10,
      fadeOut: 12
    };
  }

  function clamp(v, min, max) {
    v = Number(v);
    if (!isFinite(v)) return min;
    return Math.min(max, Math.max(min, v));
  }

  function waveLabel(w) {
    return { sine: 'Seno', triangle: 'Triángulo', square: 'Cuadrada', sawtooth: 'Diente de sierra' }[w] || 'Seno';
  }

  function noiseLabel(t) {
    return { off: 'Sin ruido', pink: 'Rosa', brown: 'Marrón', white: 'Blanco' }[t] || 'Rosa';
  }

  function balanceLabel(b) {
    b = Number(b) || 0;
    if (b === 0) return 'Centro';
    return Math.abs(b) + (b < 0 ? ' % izq.' : ' % der.');
  }

  function balanceToGains(b) {
    b = clamp(b, -100, 100);
    return {
      left: 0.5 * (b <= 0 ? 1 : (100 - b) / 100),
      right: 0.5 * (b >= 0 ? 1 : (100 + b) / 100)
    };
  }

  /* Normaliza la configuración: mantiene una única fuente de verdad para
     frecuencias, barrido, ruido, pulso y fundidos. */
  function normalizeOpts(raw) {
    var o = Object.assign(defaultOpts(), raw || {});

    o.carrier = clamp(o.carrier, 80, 600);
    o.beat = clamp(o.beat, 0, 40);
    o.independent = !!o.independent;
    o.sweep = !!o.sweep;

    if (o.independent) {
      o.leftHz = clamp(o.leftHz != null ? o.leftHz : o.carrier, 80, 600);
      o.rightHz = clamp(o.rightHz != null ? o.rightHz : o.leftHz + o.beat, o.leftHz + 0.5, 700);
      o.carrier = o.leftHz;
      o.beat = o.rightHz - o.leftHz;
    } else {
      o.leftHz = o.carrier;
      o.rightHz = clamp(o.carrier + o.beat, 80.5, 700);
      o.beat = o.rightHz - o.leftHz;
    }

    o.carrierEnd = clamp(o.carrierEnd != null ? o.carrierEnd : o.carrier, 80, 600);
    o.beatEnd = clamp(o.beatEnd != null ? o.beatEnd : o.beat, 0, 40);

    if (o.sweep) {
      o.leftEndHz = o.carrierEnd;
      if (o.independent) {
        o.rightEndHz = clamp(o.rightEndHz != null ? o.rightEndHz : o.carrierEnd + o.beatEnd, o.carrierEnd + 0.5, 700);
        o.beatEnd = o.rightEndHz - o.carrierEnd;
      } else {
        o.rightEndHz = clamp(o.carrierEnd + o.beatEnd, 80.5, 700);
        o.beatEnd = o.rightEndHz - o.carrierEnd;
      }
    } else {
      o.carrierEnd = o.carrier;
      o.beatEnd = o.beat;
      o.leftEndHz = o.leftHz;
      o.rightEndHz = o.rightHz;
    }

    o.wave = ['sine', 'triangle', 'square', 'sawtooth'].indexOf(o.wave) !== -1 ? o.wave : 'sine';
    o.balance = clamp(o.balance, -100, 100);
    o.durationSec = clamp(Math.round((Number(o.durationSec) || 480) / 60) * 60, 60, 600);
    o.volume = clamp(o.volume, 5, 60);
    o.noiseType = ['off', 'pink', 'brown', 'white'].indexOf(o.noiseType) !== -1 ? o.noiseType : 'pink';
    o.noiseLevel = clamp(o.noiseLevel, 0, 30);
    if (o.noiseType === 'off') o.noiseLevel = 0;
    o.noise = o.noiseLevel / 100 * 0.7;
    o.amEnabled = !!o.amEnabled;
    o.amRate = clamp(o.amRate, 0.5, 40);
    o.amDepth = clamp(o.amDepth, 0, 100);
    o.fadeIn = clamp(o.fadeIn, 0, 30);
    o.fadeOut = clamp(o.fadeOut, 0, 30);
    return o;
  }

  function audioConfig(o) {
    var gains = balanceToGains(o.balance);
    return {
      leftHz: o.leftHz,
      rightHz: o.rightHz,
      leftEndHz: o.leftEndHz,
      rightEndHz: o.rightEndHz,
      wave: o.wave,
      leftGain: gains.left,
      rightGain: gains.right,
      durationSec: o.durationSec,
      volume: o.volume,
      noiseType: o.noiseType,
      noiseLevel: o.noiseLevel,
      am: { enabled: o.amEnabled, rate: o.amRate, depth: o.amDepth / 100 },
      fadeIn: o.fadeIn,
      fadeOut: o.fadeOut
    };
  }

  function makeCustomProtocol() {
    var o = state.opts;
    var band = B.bandFor(o.beat);
    var presetId = $('#labPreset') ? $('#labPreset').value : '';
    var preset = B.LAB_PRESET_BY_ID[presetId];
    return {
      id: 'custom',
      name: preset ? preset.name + ' (laboratorio)' : 'Onda personalizada',
      tagline: 'Configuración manual del laboratorio.',
      band: band.id,
      beat: o.beat,
      carrier: o.carrier,
      durationSec: o.durationSec,
      noise: o.noise,
      color: band.color,
      evidence: {
        level: 1,
        title: 'Exploración',
        summary: 'Configuración manual. No hay un estudio publicado que valide exactamente esta combinación; úsala para comparar y registrar tu experiencia.',
        refs: ['chaieb2015', 'ingendoh2023']
      },
      rationale: 'Elegiste los parámetros a mano. El valor de la sesión está en registrar lo que observes y en comparar condiciones, no en asumir un efecto.',
      goals: [],
      experiment: {
        title: 'Observación libre',
        steps: [
          'Antes de empezar, escribe qué esperas que ocurra.',
          'Durante la sesión, nota el pulso, el timbre y los cambios de atención sin intentar producirlos.',
          'Al terminar, registra lo que sí ocurrió y lo que no.',
          'Si repites, cambia una sola variable a la vez.'
        ]
      },
      caution: 'Configuración exploratoria. Volumen bajo y sesiones cortas; detente si hay malestar.'
    };
  }

  var state = {
    protocol: null,
    opts: normalizeOpts(defaultOpts()),
    moodBefore: 5,
    goalText: '',
    pending: null,
    raf: null,
    starting: false,
    wakeLock: null,
    custom: false,
    study: {
      enabled: false,
      code: '',
      group: '',
      consent: false,
      pre: {}
    }
  };

  var STUDY_KEY = 'ondamental.study.v1';
  var LAB_KEY = 'ondamental.lab.presets.v1';

  /* --------------------------------------------------------- ondas de muestra */
  function sinePath(width, cy, amp, cycles, startX) {
    var pts = [];
    var x0 = startX || 0;
    for (var x = 0; x <= width; x += 2) {
      var y = cy + Math.sin(((x - x0) / width) * cycles * Math.PI * 2) * amp;
      pts.push((x === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1));
    }
    return pts.join(' ');
  }

  function drawHeroWave() {
    var svg = $('#heroWave');
    if (!svg) return;
    var left = sinePath(320, 84, 19, 7.5);
    var right = sinePath(320, 112, 19, 8.3, -6);
    svg.innerHTML =
      '<defs>' +
        '<linearGradient id="gl" x1="0" x2="1">' +
          '<stop offset="0" stop-color="#5eead4" stop-opacity="0.15"/>' +
          '<stop offset="0.5" stop-color="#5eead4"/>' +
          '<stop offset="1" stop-color="#22d3ee" stop-opacity="0.35"/>' +
        '</linearGradient>' +
        '<linearGradient id="gr" x1="0" x2="1">' +
          '<stop offset="0" stop-color="#a78bfa" stop-opacity="0.15"/>' +
          '<stop offset="0.5" stop-color="#a78bfa"/>' +
          '<stop offset="1" stop-color="#818cf8" stop-opacity="0.35"/>' +
        '</linearGradient>' +
      '</defs>' +
      '<line x1="0" y1="98" x2="320" y2="98" stroke="rgba(255,255,255,0.08)" stroke-dasharray="3 6"/>' +
      '<path d="' + left + '" fill="none" stroke="url(#gl)" stroke-width="2.2" stroke-linecap="round" style="filter:drop-shadow(0 0 5px rgba(94,234,212,.45))"/>' +
      '<path d="' + right + '" fill="none" stroke="url(#gr)" stroke-width="2.2" stroke-linecap="round" style="filter:drop-shadow(0 0 5px rgba(167,139,250,.45))"/>';
  }

  function drawBandWave(svg, cycles, color) {
    svg.innerHTML =
      '<path d="' + sinePath(260, 30, 17, cycles) + '" fill="none" stroke="' + color +
      '" stroke-width="1.7" stroke-linecap="round" opacity="0.85"/>';
  }

  /* -------------------------------------------------------------- render UI */
  function renderChips() {
    var box = $('#chips');
    B.INTENTS.forEach(function (intent) {
      var b = el('button', 'chip', intent.label);
      b.type = 'button';
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function () {
        $('#goal').value = intent.text;
        $$('.chip', box).forEach(function (c) { c.setAttribute('aria-pressed', 'false'); });
        b.setAttribute('aria-pressed', 'true');
        generateFromText();
      });
      box.appendChild(b);
    });
  }

  function renderProtocols() {
    var grid = $('#protocolGrid');
    B.PROTOCOLS.forEach(function (p) {
      var band = B.BAND_BY_ID[p.band];
      var card = el('article', 'card protocol-card');
      card.style.setProperty('--accent', p.color);

      var head = el('div', 'protocol-head');
      head.appendChild(el('span', 'band-chip', band.name));
      var levelLabel = p.evidence.title.replace('Evidencia ', '');
      levelLabel = levelLabel.charAt(0).toUpperCase() + levelLabel.slice(1);
      var badge = el('span', 'badge', levelLabel);
      badge.dataset.level = String(p.evidence.level);
      head.appendChild(badge);

      var title = el('h3', null, p.name);
      var tagline = el('p', 'protocol-tagline', p.tagline);

      var params = el('dl', 'protocol-params');
      [['Batido', p.beatEnd
        ? p.beat.toFixed(0) + '→' + p.beatEnd.toFixed(0) + ' Hz'
        : p.beat.toFixed(1) + ' Hz'],
       ['Portadora', p.carrier + ' Hz'],
       ['Duración', Math.round(p.durationSec / 60) + ' min']].forEach(function (pair) {
        var wrap = el('div');
        wrap.appendChild(el('dt', null, pair[0]));
        wrap.appendChild(el('dd', null, pair[1]));
        params.appendChild(wrap);
      });

      var summary = el('p', 'protocol-summary', p.evidence.summary);

      var foot = el('div', 'protocol-foot');
      var use = el('button', 'btn btn-ghost btn-sm', 'Usar este protocolo');
      use.type = 'button';
      use.addEventListener('click', function () {
        $('#goal').value = 'Quiero ' + p.goals[0] + '.';
        $$('.chip').forEach(function (c) { c.setAttribute('aria-pressed', 'false'); });
        applyProtocol(p, $('#goal').value, 'Protocolo de la biblioteca.');
        $('#crear').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      foot.appendChild(use);
      foot.appendChild(el('span', 'mini-evidence', (p.evidence.refs || []).length + ' referencias'));

      card.appendChild(head);
      card.appendChild(title);
      card.appendChild(tagline);
      card.appendChild(params);
      card.appendChild(summary);
      card.appendChild(foot);
      grid.appendChild(card);
    });
  }

  function renderBands() {
    var grid = $('#bandGrid');
    var cyclesById = { delta: 2, theta: 4, alpha: 7, beta: 13, gamma: 22 };
    B.BANDS.forEach(function (band) {
      var card = el('article', 'card band-card');
      card.style.setProperty('--accent', band.color);

      var top = el('div', 'band-card-top');
      top.appendChild(el('span', 'band-name', band.name));
      top.appendChild(el('span', 'band-range', band.min + '–' + band.max + ' Hz'));

      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 260 60');
      svg.setAttribute('class', 'band-wave');
      svg.setAttribute('aria-hidden', 'true');
      drawBandWave(svg, cyclesById[band.id] || 6, band.color);

      card.appendChild(top);
      card.appendChild(svg);
      card.appendChild(el('p', 'band-short', band.short));
      card.appendChild(el('p', 'band-long', band.long));
      grid.appendChild(card);
    });
  }

  /* ------------------------------------------------------------ recomendador */
  function setHint(message) {
    $('#matchHint').textContent = message;
  }

  function updateBandReadout() {
    var band = B.bandFor(state.opts.beat);
    var label = band.id === 'control'
      ? 'Sin batido (control)'
      : band.name + ' · ' + band.min + '–' + band.max + ' Hz';
    $('#rBand').textContent = label;
    $('#advBandHint').textContent = band.id === 'control'
      ? 'Condición de control'
      : 'Banda ' + band.name.toLowerCase();
    $('#advBandHint').style.color = band.color;
  }

  function syncAdvancedUI() {
    var o = state.opts;
    $('#advBeat').value = o.beat;
    $('#advBeatVal').textContent = o.beat < 0.5 ? 'Sin batido' : o.beat.toFixed(1) + ' Hz';
    $('#advCarrier').value = o.carrier;
    $('#advCarrierVal').textContent = o.carrier + ' Hz';
    $('#advDuration').value = Math.round(o.durationSec / 60);
    $('#advDurationVal').textContent = formatClock(o.durationSec);
    $('#advVolume').value = o.volume;
    $('#advVolumeVal').textContent = o.volume + ' %';
    $('#advNoise').checked = o.noiseType !== 'off';
    $('#rBeat').textContent = o.sweep
      ? o.beat.toFixed(1) + ' → ' + o.beatEnd.toFixed(1) + ' Hz'
      : (o.beat < 0.5 ? 'Sin batido (control)' : o.beat.toFixed(1) + ' Hz');
    $('#rCarrier').textContent = o.sweep && o.carrierEnd !== o.carrier
      ? o.carrier + ' → ' + o.carrierEnd + ' Hz'
      : o.carrier + ' Hz';
    $('#rDuration').textContent = formatClock(o.durationSec);
    $('#btnStart').textContent = 'Iniciar sesión · ' + formatClock(o.durationSec);
    updateBandReadout();
  }

  function applyProtocol(protocol, goalText, hintMessage) {
    state.protocol = protocol;
    state.goalText = goalText || '';
    state.custom = false;

    var o = defaultOpts();
    o.carrier = protocol.carrier;
    o.beat = protocol.beat;
    o.beatEnd = protocol.beatEnd != null ? protocol.beatEnd : protocol.beat;
    o.carrierEnd = protocol.carrierEnd != null ? protocol.carrierEnd : protocol.carrier;
    o.sweep = protocol.beatEnd != null || protocol.carrierEnd != null;
    o.durationSec = protocol.durationSec;
    o.volume = state.opts.volume; // conserva el volumen elegido
    o.noiseType = protocol.noise > 0.001 ? 'pink' : 'off';
    o.noiseLevel = protocol.noise > 0.001
      ? clamp(Math.round(protocol.noise / 0.7 * 100), 0, 30) : 0;
    o.independent = false;
    o.balance = 0;
    o.wave = 'sine';
    o.amEnabled = false;
    o.fadeIn = 10;
    o.fadeOut = 12;
    state.opts = normalizeOpts(o);
    state.moodBefore = 5;

    $('#resultEmpty').hidden = true;
    $('#resultBody').hidden = false;

    $('#rName').textContent = protocol.name;
    $('#rTagline').textContent = protocol.tagline;

    var badge = $('#rBadge');
    badge.textContent = protocol.evidence.title;
    badge.dataset.level = String(protocol.evidence.level);

    $('#rWhy').textContent = protocol.rationale;
    $('#rSummary').textContent = protocol.evidence.summary;

    var refsBox = $('#rRefs');
    refsBox.textContent = '';
    (protocol.evidence.refs || []).slice(0, 2).forEach(function (key) {
      var ref = B.REFS[key];
      if (ref) refsBox.appendChild(el('span', null, '· ' + ref + '\n'));
    });
    refsBox.style.whiteSpace = 'pre-line';

    var exp = $('#rExperiment');
    exp.textContent = '';
    exp.appendChild(el('h5', null, protocol.experiment.title));
    var ol = el('ol');
    protocol.experiment.steps.forEach(function (step) {
      ol.appendChild(el('li', null, step));
    });
    exp.appendChild(ol);

    $('#rExperimentBox').open = false;
    $('#advanced').open = false;
    $('#moodBefore').value = 5;
    $('#moodBeforeVal').textContent = '5';

    syncAdvancedUI();
    if ($('#labPreset')) $('#labPreset').value = '';
    if ($('#labPresetHint')) {
      $('#labPresetHint').textContent = 'Protocolo cargado: ' + protocol.name + '. Edita lo que quieras.';
    }
    syncLabUI();
    drawLabWave();
    setHint(hintMessage || 'Protocolo listo. Ajusta lo que quieras o inicia la sesión.');

    if (window.matchMedia('(max-width: 900px)').matches) {
      setTimeout(function () {
        $('#result').scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 40);
    }
  }

  function generateFromText() {
    var text = ($('#goal').value || '').trim();
    if (!text) {
      setHint('Escribe tu intención o elige una de las sugerencias.');
      $('#goal').focus();
      toast('Falta tu intención: una frase basta.');
      return;
    }

    var match = B.matchProtocol(text);
    if (match) {
      var hits = match.hits.slice(0, 3).join(', ');
      applyProtocol(
        match.protocol,
        text,
        'Coincidencia: ' + (hits || 'tu descripción') + ' → ' + match.protocol.name + '.'
      );
    } else {
      applyProtocol(
        B.PROTOCOL_BY_ID.calma,
        text,
        'No hubo una coincidencia clara. Te propongo Calma Alpha como punto de partida; puedes cambiarla en la biblioteca.'
      );
    }
  }

  function randomProtocol() {
    var p = B.PROTOCOLS[Math.floor(Math.random() * B.PROTOCOLS.length)];
    $('#goal').value = 'Quiero ' + p.goals[0] + '.';
    $$('.chip').forEach(function (c) { c.setAttribute('aria-pressed', 'false'); });
    applyProtocol(p, $('#goal').value, 'Protocolo aleatorio: ' + p.name + '. ¿Te sirve como experimento?');
  }

  /* --------------------------------------------------------------- ajustes */
  function bindAdvanced() {
    $('#advBeat').addEventListener('input', function () {
      state.opts.beat = parseFloat(this.value);
      state.opts.sweep = false;
      state.opts.independent = false;
      commitOpts(true);
      setHint('Frecuencia editada a mano. La evidencia citada corresponde al protocolo original; ahora estás explorando.');
    });

    $('#advCarrier').addEventListener('input', function () {
      state.opts.carrier = parseInt(this.value, 10);
      commitOpts(true);
    });

    $('#advDuration').addEventListener('input', function () {
      state.opts.durationSec = parseInt(this.value, 10) * 60;
      commitOpts(true);
    });

    $('#advVolume').addEventListener('input', function () {
      state.opts.volume = parseInt(this.value, 10);
      commitOpts(true);
    });

    $('#advNoise').addEventListener('change', function () {
      state.opts.noiseType = this.checked ? 'pink' : 'off';
      state.opts.noiseLevel = this.checked ? 5 : 0;
      commitOpts(true);
    });

    $('#moodBefore').addEventListener('input', function () {
      state.moodBefore = parseInt(this.value, 10);
      $('#moodBeforeVal').textContent = this.value;
    });
  }

  /* ---------------------------------------------------------------- sesión */
  function openOverlay() {
    $('#session').hidden = false;
    document.body.style.overflow = 'hidden';
    $('#btnStop').focus();
  }

  function closeOverlay() {
    $('#session').hidden = true;
    document.body.style.overflow = '';
  }

  function studyReady() {
    if (!state.study.enabled) { state.study.pre = {}; return true; }
    var code = ($('#studyCode').value || '').trim();
    if (!code) {
      toast('Escribe un código de participante o desactiva el modo estudio.');
      $('#studyCode').focus();
      return false;
    }
    if (!$('#studyConsent').checked) {
      toast('Marca el consentimiento del modo estudio para continuar.');
      $('#studyConsent').focus();
      return false;
    }
    state.study.code = code;
    state.study.group = ($('#studyGroup').value || '').trim();
    state.study.consent = true;
    state.study.pre = readMeasures('pre');
    return true;
  }

  function startSession() {
    if (!state.protocol) state.protocol = makeCustomProtocol();
    if (!B.Audio.supported()) {
      toast('Este navegador no soporta Web Audio. Prueba con Chrome, Edge, Firefox o Safari.');
      return;
    }
    if (!studyReady()) return;

    var p = state.protocol;
    var o = normalizeOpts(state.opts);
    state.opts = o;
    var suffix = state.custom && p.id !== 'custom' ? ' (ajustada)' : '';
    var beatText = o.beat < 0.5 ? 'sin batido' : o.beat.toFixed(1) + ' Hz';

    $('#sProtocol').textContent = p.name + suffix + ' · L ' + o.leftHz + ' / R ' + o.rightHz +
      ' Hz · ' + beatText;
    $('#sGuion').textContent = 'Guion: ' + (p.experiment ? p.experiment.title : 'Observación libre');
    $('#sPhase').textContent = 'Inducción';
    $('#sTime').textContent = formatClock(o.durationSec);
    $('#sBeat').textContent = o.beat < 0.5 ? 'Sin batido' : o.beat.toFixed(1) + ' Hz';
    $('#sBreath').textContent = 'Inhala';
    $('#sProgress').style.strokeDashoffset = String(CIRC);
    $('#sProgress').style.strokeDasharray = String(CIRC);
    $('#sVolume').value = o.volume;

    openOverlay();
    requestWakeLock();
    state.starting = true;

    B.Audio.start(audioConfig(o)).then(function () {
      state.starting = false;
      tickSession();
    }).catch(function (err) {
      state.starting = false;
      closeOverlay();
      releaseWakeLock();
      toast('No se pudo iniciar el audio: ' + (err && err.message ? err.message : 'error desconocido'));
    });
  }

  function startLabSession() {
    state.protocol = makeCustomProtocol();
    state.custom = true;
    startSession();
  }

  function tickSession() {
    if (state.starting) return;
    var s = B.Audio.getState();
    if (!s) {
      if (!$('#session').hidden) finishSession(true);
      return;
    }

    var remaining = s.remaining;
    $('#sTime').textContent = formatClock(remaining);
    $('#sBeat').textContent = s.beat < 0.5 ? 'Sin batido' : s.beat.toFixed(1) + ' Hz';
    $('#sPhase').textContent = s.phase;
    $('#sProgress').style.strokeDashoffset = String(CIRC * (1 - s.progress));
    if (state.protocol) {
      var suffix = state.custom && state.protocol.id !== 'custom' ? ' (ajustada)' : '';
      $('#sProtocol').textContent = state.protocol.name + suffix + ' · L ' +
        s.leftHz.toFixed(1) + ' / R ' + s.rightHz.toFixed(1) + ' Hz';
    }

    var cycle = s.elapsed % 10;
    $('#sBreath').textContent = cycle < 4 ? 'Inhala' : cycle < 6 ? 'Sostén' : 'Exhala';

    if (remaining <= 0.04) {
      finishSession(true);
      return;
    }
    state.raf = requestAnimationFrame(tickSession);
  }

  function stopSession(completed) {
    state.starting = false;
    if (state.raf) {
      cancelAnimationFrame(state.raf);
      state.raf = null;
    }
    var duration = state.opts.durationSec;
    B.Audio.stop(2);
    closeOverlay();
    releaseWakeLock();

    var s = B.Audio.getState();
    var elapsed = s ? s.elapsed : duration;

    if (completed || elapsed > 20) {
      openJournalDialog(!!completed, Math.min(duration, Math.round(elapsed)));
    } else {
      toast('Sesión detenida.');
    }
  }

  function finishSession(completed) {
    stopSession(completed);
  }

  function requestWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        navigator.wakeLock.request('screen').then(function (lock) {
          state.wakeLock = lock;
        }).catch(function () { /* sin permiso */ });
      }
    } catch (e) { /* no soportado */ }
  }

  function releaseWakeLock() {
    if (state.wakeLock) {
      try { state.wakeLock.release(); } catch (e) { /* ignore */ }
      state.wakeLock = null;
    }
  }

  function bindSession() {
    $('#btnStart').addEventListener('click', startSession);
    $('#btnStop').addEventListener('click', function () { stopSession(false); });
    $('#btnStopTop').addEventListener('click', function () { stopSession(false); });

    $('#sVolume').addEventListener('input', function () {
      state.opts.volume = parseInt(this.value, 10);
      B.Audio.setVolume(state.opts.volume);
      $('#advVolume').value = state.opts.volume;
      $('#advVolumeVal').textContent = state.opts.volume + ' %';
      if ($('#labVolume')) {
        $('#labVolume').value = state.opts.volume;
        $('#labVolumeVal').textContent = state.opts.volume + ' %';
      }
    });
  }

  /* ---------------------------------------------------------------- bitácora */
  function loadJournal() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function saveJournal(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      return true;
    } catch (e) {
      toast('No se pudo guardar: el almacenamiento del navegador está lleno o bloqueado.');
      return false;
    }
  }

  function openJournalDialog(completed, elapsed) {
    var p = state.protocol;
    if (!p) return;
    var o = state.opts;
    var suffix = state.custom && p.id !== 'custom' ? ' (ajustada)' : '';
    var name = p.name + suffix;
    var beatText = o.beat < 0.5 ? 'sin batido' : 'batido ' + o.beat.toFixed(1) + ' Hz';

    state.pending = {
      protocolId: p.id,
      protocolName: name,
      band: B.bandFor(o.beat).id,
      beat: o.beat,
      beatEnd: o.sweep ? o.beatEnd : null,
      carrier: o.carrier,
      carrierEnd: o.sweep ? o.carrierEnd : null,
      leftHz: o.leftHz,
      rightHz: o.rightHz,
      leftEndHz: o.sweep ? o.leftEndHz : null,
      rightEndHz: o.sweep ? o.rightEndHz : null,
      wave: o.wave,
      balance: o.balance,
      sweep: o.sweep,
      noiseType: o.noiseType,
      noiseLevel: o.noiseLevel,
      amEnabled: o.amEnabled,
      amRate: o.amRate,
      amDepth: o.amDepth,
      fadeIn: o.fadeIn,
      fadeOut: o.fadeOut,
      durationSec: o.durationSec,
      elapsedSec: elapsed,
      completed: completed,
      custom: state.custom || p.id === 'custom',
      moodBefore: state.moodBefore,
      goal: state.goalText,
      config: audioConfig(o),
      study: null
    };

    if (state.study.enabled && state.study.consent) {
      state.pending.study = {
        code: state.study.code,
        group: state.study.group,
        consent: true,
        pre: Object.assign({}, state.study.pre)
      };
      $('#jdStudyFields').hidden = false;
      setMeasures('post', 5);
    } else {
      $('#jdStudyFields').hidden = true;
    }

    $('#jdSummary').textContent = name + ' · ' + formatClock(o.durationSec) + ' · ' + beatText +
      ' · L ' + o.leftHz + ' / R ' + o.rightHz + ' Hz · ánimo antes ' +
      state.moodBefore + '/10' + (completed ? ' · sesión completada' : ' · interrumpida');

    $('#jdMood').value = 5;
    $('#jdMoodVal').textContent = '5';
    $('#jdNotes').value = '';
    $('#jdCompleted').checked = !!completed;
    $('#journalDialog').hidden = false;
    document.body.style.overflow = 'hidden';
    setTimeout(function () { $('#jdNotes').focus(); }, 60);
  }

  function closeJournalDialog() {
    $('#journalDialog').hidden = true;
    state.pending = null;
    document.body.style.overflow = '';
  }

  function bindJournalForm() {
    $('#journalForm').addEventListener('submit', function (e) {
      e.preventDefault();
      if (!state.pending) { closeJournalDialog(); return; }

      var entry = state.pending;
      entry.id = 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      entry.ts = Date.now();
      entry.moodAfter = parseInt($('#jdMood').value, 10);
      entry.notes = $('#jdNotes').value.trim();
      entry.completed = $('#jdCompleted').checked;
      if (entry.study) entry.study.post = readMeasures('post');

      var list = loadJournal();
      list.push(entry);
      if (saveJournal(list)) {
        renderJournal();
        toast('Entrada guardada en tu bitácora.');
      }
      closeJournalDialog();
    });

    $('#jdSkip').addEventListener('click', function () {
      closeJournalDialog();
      toast('Sesión no registrada.');
    });

    $('#jdMood').addEventListener('input', function () {
      $('#jdMoodVal').textContent = this.value;
    });
  }

  function renderJournal() {
    var list = loadJournal().slice().sort(function (a, b) { return b.ts - a.ts; });
    var box = $('#journalList');
    box.textContent = '';

    if (!list.length) {
      box.appendChild(el('p', 'empty-state', 'Todavía no hay observaciones. Completa una sesión y guarda lo que notaste: incluso «no pasó nada» es un dato.'));
    } else {
      list.forEach(function (entry) {
        var card = el('article', 'journal-entry');
        var p = B.PROTOCOL_BY_ID[entry.protocolId];
        if (p) card.style.setProperty('--accent', p.color);

        var header = el('header');
        var left = el('div');
        left.appendChild(el('strong', null, entry.protocolName || 'Protocolo'));

        var bits = [];
        if (entry.leftHz != null) {
          bits.push('L ' + Math.round(entry.leftHz) + ' / R ' + Math.round(entry.rightHz) + ' Hz');
        } else if (entry.carrier != null) {
          bits.push(entry.carrier + ' Hz');
        }
        bits.push(Number(entry.beat || 0) < 0.5
          ? 'sin batido'
          : 'batido ' + Number(entry.beat || 0).toFixed(1) + ' Hz');
        if (entry.wave) bits.push(waveLabel(entry.wave));
        if (entry.sweep && entry.beatEnd != null) {
          bits.push('barrido ' + Number(entry.beat).toFixed(1) + '→' + Number(entry.beatEnd).toFixed(1) + ' Hz');
        }
        if (entry.amEnabled) bits.push('AM ' + Number(entry.amRate).toFixed(1) + ' Hz');

        left.appendChild(el('span', 'je-meta', formatDate(entry.ts) + ' · ' +
          formatClock(entry.durationSec || 0) + ' · ' + bits.join(' · ') +
          (entry.completed ? '' : ' · interrumpida')));
        header.appendChild(left);

        var del = el('button', 'icon-btn', '✕');
        del.type = 'button';
        del.dataset.del = entry.id;
        del.setAttribute('aria-label', 'Eliminar esta entrada');
        header.appendChild(del);

        card.appendChild(header);
        if (entry.goal) card.appendChild(el('p', 'je-goal', '«' + entry.goal + '»'));
        if (entry.notes) card.appendChild(el('p', 'je-notes', entry.notes));

        var moods = el('div', 'je-moods');
        moods.appendChild(el('span', null, 'Antes ' + entry.moodBefore + '/10'));
        moods.appendChild(el('span', null, 'Después ' + entry.moodAfter + '/10'));
        var diff = (entry.moodAfter || 0) - (entry.moodBefore || 0);
        var d = el('span', 'je-delta', formatDelta(diff));
        d.classList.add(diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat');
        moods.appendChild(d);
        card.appendChild(moods);

        if (entry.study && entry.study.code) {
          var studyLine = el('p', 'je-study');
          studyLine.appendChild(el('strong', null, 'Estudio · ' + entry.study.code));
          if (entry.study.group) studyLine.appendChild(document.createTextNode(' · ' + entry.study.group));
          card.appendChild(studyLine);

          if (entry.study.pre && entry.study.post) {
            var measures = el('div', 'je-measures');
            B.STUDY_MEASURES.forEach(function (m) {
              var a = entry.study.pre[m.id];
              var b = entry.study.post[m.id];
              if (a == null || b == null) return;
              var delta = b - a;
              var chip = el('span', 'je-measure ' + (delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'),
                m.label + ' ' + a + '→' + b + ' (' + formatDelta(delta) + ')');
              measures.appendChild(chip);
            });
            if (measures.children.length) card.appendChild(measures);
          }
        }

        if (entry.config) {
          var det = document.createElement('details');
          det.className = 'je-config';
          var sum = document.createElement('summary');
          sum.textContent = 'Parámetros exactos';
          det.appendChild(sum);
          var pre = document.createElement('pre');
          pre.textContent = JSON.stringify(entry.config, null, 2);
          det.appendChild(pre);
          card.appendChild(det);
        }

        box.appendChild(card);
      });
    }

    renderStats(list);
  }

  function renderStats(list) {
    $('#statSessions').textContent = String(list.length);

    var totalSec = list.reduce(function (acc, e) {
      return acc + (e.elapsedSec || e.durationSec || 0);
    }, 0);
    $('#statMinutes').textContent = String(Math.round(totalSec / 6) / 10);

    var deltas = list.map(function (e) {
      return (Number(e.moodAfter) || 0) - (Number(e.moodBefore) || 0);
    });
    var avg = deltas.length ? deltas.reduce(function (a, b) { return a + b; }, 0) / deltas.length : NaN;
    var deltaEl = $('#statDelta');
    deltaEl.textContent = deltas.length ? formatDelta(avg) : '—';
    deltaEl.style.color = !deltas.length ? '' : avg > 0 ? '#6ee7b7' : avg < 0 ? '#fda4af' : '';

    var groups = {};
    list.forEach(function (e) {
      if (!groups[e.protocolName]) groups[e.protocolName] = { sum: 0, n: 0 };
      groups[e.protocolName].sum += (Number(e.moodAfter) || 0) - (Number(e.moodBefore) || 0);
      groups[e.protocolName].n += 1;
    });
    var bestName = '—';
    var bestAvg = -Infinity;
    Object.keys(groups).forEach(function (name) {
      var a = groups[name].sum / groups[name].n;
      if (a > bestAvg) { bestAvg = a; bestName = name; }
    });
    $('#statBest').textContent = bestName === '—' ? '—' : bestName + ' (' + formatDelta(bestAvg) + ')';

    var studyEntries = list.filter(function (e) { return e.study && e.study.code; });
    var codes = {};
    studyEntries.forEach(function (e) { codes[e.study.code] = true; });
    if ($('#statStudySessions')) $('#statStudySessions').textContent = String(studyEntries.length);
    if ($('#statParticipants')) $('#statParticipants').textContent = String(Object.keys(codes).length);
  }

  function csvEscape(value) {
    var s = value == null ? '' : String(value);
    return '"' + s.replace(/"/g, '""') + '"';
  }

  function download(filename, mime, content) {
    var blob = new Blob([content], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  function exportCsv() {
    var list = loadJournal().slice().sort(function (a, b) { return a.ts - b.ts; });
    if (!list.length) { toast('La bitácora está vacía.'); return; }

    var header = [
      'id', 'fecha_iso', 'modo', 'protocolo', 'banda',
      'batido_hz', 'batido_final_hz', 'portadora_hz', 'portadora_final_hz',
      'oido_izq_hz', 'oido_der_hz', 'oido_izq_final_hz', 'oido_der_final_hz',
      'onda', 'balance', 'barrido', 'ruido', 'nivel_ruido',
      'am', 'am_hz', 'am_profundidad', 'fade_in_s', 'fade_out_s',
      'duracion_min', 'completada', 'animo_antes', 'animo_despues',
      'intencion', 'observacion',
      'codigo', 'grupo', 'consentimiento',
      'relax_antes', 'relax_despues', 'foco_antes', 'foco_despues',
      'viveza_antes', 'viveza_despues', 'absorcion_antes', 'absorcion_despues'
    ];
    var rows = [header.map(csvEscape).join(',')];

    list.forEach(function (e) {
      var left = e.leftHz != null ? e.leftHz : e.carrier;
      var right = e.rightHz != null ? e.rightHz : (Number(e.carrier) || 0) + (Number(e.beat) || 0);
      var study = e.study || {};
      var pre = study.pre || {};
      var post = study.post || {};
      rows.push([
        e.id,
        new Date(e.ts).toISOString(),
        e.custom ? 'personalizado' : 'protocolo',
        e.protocolName,
        e.band,
        e.beat,
        e.sweep ? e.beatEnd : '',
        e.carrier,
        e.sweep ? e.carrierEnd : '',
        left,
        right,
        e.sweep ? e.leftEndHz : '',
        e.sweep ? e.rightEndHz : '',
        e.wave || 'sine',
        e.balance == null ? '' : e.balance,
        e.sweep ? 'sí' : 'no',
        e.noiseType || '',
        e.noiseLevel == null ? '' : e.noiseLevel,
        e.amEnabled ? 'sí' : 'no',
        e.amEnabled ? e.amRate : '',
        e.amEnabled ? e.amDepth : '',
        e.fadeIn == null ? '' : e.fadeIn,
        e.fadeOut == null ? '' : e.fadeOut,
        Math.round((e.durationSec || 0) / 60),
        e.completed ? 'sí' : 'no',
        e.moodBefore,
        e.moodAfter,
        e.goal,
        e.notes,
        study.code || '',
        study.group || '',
        study.consent ? 'sí' : 'no',
        pre.relax == null ? '' : pre.relax,
        post.relax == null ? '' : post.relax,
        pre.focus == null ? '' : pre.focus,
        post.focus == null ? '' : post.focus,
        pre.vivid == null ? '' : pre.vivid,
        post.vivid == null ? '' : post.vivid,
        pre.absorb == null ? '' : pre.absorb,
        post.absorb == null ? '' : post.absorb
      ].map(csvEscape).join(','));
    });

    download('onda-mental-bitacora-' + new Date().toISOString().slice(0, 10) + '.csv',
      'text/csv;charset=utf-8', '\uFEFF' + rows.join('\r\n'));
    toast('CSV exportado (' + list.length + ' entradas).');
  }

  function exportJson() {
    var list = loadJournal().slice().sort(function (a, b) { return a.ts - b.ts; });
    if (!list.length) { toast('La bitácora está vacía.'); return; }
    download('onda-mental-bitacora-' + new Date().toISOString().slice(0, 10) + '.json',
      'application/json;charset=utf-8', JSON.stringify(list, null, 2));
    toast('JSON exportado (' + list.length + ' entradas).');
  }

  function bindJournal() {
    $('#btnExportCsv').addEventListener('click', exportCsv);
    $('#btnExportJson').addEventListener('click', exportJson);

    $('#btnClear').addEventListener('click', function () {
      if (!loadJournal().length) { toast('No hay nada que borrar.'); return; }
      if (window.confirm('¿Borrar todas las entradas de la bitácora? Esta acción no se puede deshacer.')) {
        saveJournal([]);
        renderJournal();
        toast('Bitácora borrada.');
      }
    });

    $('#journalList').addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-del]');
      if (!btn) return;
      var id = btn.dataset.del;
      if (!window.confirm('¿Eliminar esta entrada?')) return;
      var list = loadJournal().filter(function (entry) { return entry.id !== id; });
      saveJournal(list);
      renderJournal();
      toast('Entrada eliminada.');
    });
  }

  /* -------------------------------------------------------- laboratorio */
  function commitOpts(markCustom) {
    if (markCustom) state.custom = true;
    state.opts = normalizeOpts(state.opts);
    syncAdvancedUI();
    syncLabUI();
    drawLabWave();
  }

  function loadSavedPresets() {
    try {
      var raw = localStorage.getItem(LAB_KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function saveSavedPresets(list) {
    try {
      localStorage.setItem(LAB_KEY, JSON.stringify(list));
      return true;
    } catch (e) {
      toast('No se pudo guardar: el almacenamiento del navegador está lleno o bloqueado.');
      return false;
    }
  }

  function renderPresetOptions() {
    var sel = $('#labPreset');
    if (!sel) return;
    sel.textContent = '';
    var custom = el('option', null, 'Personalizado…');
    custom.value = '';
    sel.appendChild(custom);

    B.LAB_PRESETS.forEach(function (preset) {
      var opt = el('option', null, preset.name);
      opt.value = preset.id;
      sel.appendChild(opt);
    });

    sel.value = 'calma';
    if ($('#labPresetHint')) $('#labPresetHint').textContent = B.LAB_PRESET_BY_ID.calma.hint;
  }

  function renderSavedOptions() {
    var sel = $('#labSaved');
    if (!sel) return;
    var previous = sel.value;
    sel.textContent = '';

    var empty = el('option', null, '—');
    empty.value = '';
    sel.appendChild(empty);

    var saved = loadSavedPresets();
    saved.forEach(function (item) {
      var opt = el('option', null, item.name + ' · ' + formatDate(item.ts));
      opt.value = item.id;
      sel.appendChild(opt);
    });

    if (saved.some(function (item) { return item.id === previous; })) sel.value = previous;
  }

  function currentLabName() {
    var sel = $('#labPreset');
    var preset = sel ? B.LAB_PRESET_BY_ID[sel.value] : null;
    if (preset) return preset.name;
    if (state.protocol) {
      return state.protocol.name + (state.custom && state.protocol.id !== 'custom' ? ' (ajustada)' : '');
    }
    return 'Onda personalizada';
  }

  function applyPreset(id) {
    var preset = B.LAB_PRESET_BY_ID[id];
    if (!preset) return;

    var o = defaultOpts();
    Object.keys(preset.opts).forEach(function (key) { o[key] = preset.opts[key]; });
    o.volume = state.opts.volume;
    state.opts = normalizeOpts(o);
    state.custom = true;

    var sel = $('#labPreset');
    if (sel) sel.value = id;
    if ($('#labPresetHint')) $('#labPresetHint').textContent = preset.hint;
    commitOpts(false);
  }

  function syncLabUI() {
    var o = state.opts;
    var q = function (id) { return document.getElementById(id); };
    var setText = function (id, text) {
      var node = q(id);
      if (node) node.textContent = text;
    };
    var setHidden = function (id, hidden) {
      var node = q(id);
      if (node) node.hidden = hidden;
    };

    var carrier = q('labCarrier');
    if (carrier) carrier.value = Math.round(o.carrier);
    setText('labCarrierVal', Math.round(o.carrier) + ' Hz');

    var beat = q('labBeat');
    if (beat) beat.value = o.beat;
    setText('labBeatVal', o.beat < 0.5 ? 'Sin batido' : o.beat.toFixed(1) + ' Hz');

    setHidden('labRightWrap', !o.independent);
    var right = q('labRight');
    if (right) right.value = Math.round(o.rightHz);
    setText('labRightVal', Math.round(o.rightHz) + ' Hz');

    var independent = q('labIndependent');
    if (independent) independent.checked = o.independent;

    var sweep = q('labSweep');
    if (sweep) sweep.checked = o.sweep;
    setHidden('labCarrierEndWrap', !o.sweep);
    setHidden('labBeatEndWrap', !o.sweep);
    setHidden('labRightEndWrap', !o.sweep);

    var carrierEnd = q('labCarrierEnd');
    if (carrierEnd) carrierEnd.value = Math.round(o.carrierEnd);
    setText('labCarrierEndVal', Math.round(o.carrierEnd) + ' Hz');

    var beatEnd = q('labBeatEnd');
    if (beatEnd) beatEnd.value = o.beatEnd;
    setText('labBeatEndVal', o.beatEnd < 0.5 ? 'Sin batido' : o.beatEnd.toFixed(1) + ' Hz');

    var rightEnd = q('labRightEnd');
    if (rightEnd) rightEnd.value = Math.round(o.rightEndHz);
    setText('labRightEndVal', Math.round(o.rightEndHz) + ' Hz');

    var wave = q('labWave');
    if (wave) wave.value = o.wave;
    setText('labWaveVal', waveLabel(o.wave));

    var balance = q('labBalance');
    if (balance) balance.value = o.balance;
    setText('labBalanceVal', balanceLabel(o.balance));

    var amRate = q('labAmRate');
    if (amRate) amRate.value = o.amRate;
    setText('labAmRateVal', o.amRate.toFixed(1) + ' Hz');

    var amDepth = q('labAmDepth');
    if (amDepth) amDepth.value = o.amDepth;
    setText('labAmDepthVal', Math.round(o.amDepth) + ' %');

    var amEnabled = q('labAmEnabled');
    if (amEnabled) amEnabled.checked = o.amEnabled;

    var noiseType = q('labNoiseType');
    if (noiseType) noiseType.value = o.noiseType;
    setText('labNoiseTypeVal', noiseLabel(o.noiseType));

    var noiseLevel = q('labNoiseLevel');
    if (noiseLevel) noiseLevel.value = o.noiseLevel;
    setText('labNoiseLevelVal', Math.round(o.noiseLevel) + ' %');

    var duration = q('labDuration');
    if (duration) duration.value = Math.round(o.durationSec / 60);
    setText('labDurationVal', formatClock(o.durationSec));

    var volume = q('labVolume');
    if (volume) volume.value = o.volume;
    setText('labVolumeVal', Math.round(o.volume) + ' %');

    var fadeIn = q('labFadeIn');
    if (fadeIn) fadeIn.value = o.fadeIn;
    setText('labFadeInVal', Math.round(o.fadeIn) + ' s');

    var fadeOut = q('labFadeOut');
    if (fadeOut) fadeOut.value = o.fadeOut;
    setText('labFadeOutVal', Math.round(o.fadeOut) + ' s');

    var band = B.bandFor(o.beat);
    var bandText = band.id === 'control' ? 'sin batido (control)' : band.name.toLowerCase();

    setText('labFreqHint', 'Izquierda ' + Math.round(o.leftHz) + ' Hz · derecha ' +
      Math.round(o.rightHz) + ' Hz · ' +
      (o.beat < 0.5 ? 'sin batido' : 'batido ' + o.beat.toFixed(1) + ' Hz (' + bandText + ').'));

    setText('labReadName', currentLabName());
    setText('labReadBeat', o.beat < 0.5 ? 'Sin batido' : o.beat.toFixed(1) + ' Hz');
    setText('labReadBand', band.id === 'control' ? 'condición de control' : 'banda ' + band.name.toLowerCase());
    setText('labReadLeft', Math.round(o.leftHz) + (o.sweep ? ' → ' + Math.round(o.leftEndHz) : '') + ' Hz');
    setText('labReadRight', Math.round(o.rightHz) + (o.sweep ? ' → ' + Math.round(o.rightEndHz) : '') + ' Hz');
    setText('labReadDuration', formatClock(o.durationSec));
    setText('labReadWave', waveLabel(o.wave));
    setText('labReadSweep', o.sweep
      ? 'Sí · ' + o.beat.toFixed(1) + ' → ' + o.beatEnd.toFixed(1) + ' Hz'
      : 'No');
    setText('labReadAm', o.amEnabled
      ? o.amRate.toFixed(1) + ' Hz · ' + Math.round(o.amDepth) + ' %'
      : 'No');
    setText('labReadNoise', o.noiseType === 'off'
      ? 'Sin ruido'
      : noiseLabel(o.noiseType) + ' · ' + Math.round(o.noiseLevel) + ' %');
    setText('labReadBalance', balanceLabel(o.balance));
    setText('labReadHint', band.id === 'control'
      ? 'Condición de comparación: misma frecuencia en ambos oídos, sin batido binaural.'
      : band.name + ': ' + band.short + '. La evidencia sobre entrenamiento es modesta; trátalo como exploración.');

    setText('labStart', 'Iniciar esta onda · ' + formatClock(o.durationSec));
  }

  function drawLabWave() {
    var svg = $('#labWaveSvg');
    if (!svg) return;
    var NS = 'http://www.w3.org/2000/svg';
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    var o = state.opts;
    var W = 320;
    var H = 100;
    var mid = H / 2;
    var amp = 27;
    var depth = o.amDepth / 100;

    var baseline = document.createElementNS(NS, 'line');
    baseline.setAttribute('x1', '0');
    baseline.setAttribute('x2', String(W));
    baseline.setAttribute('y1', String(mid));
    baseline.setAttribute('y2', String(mid));
    baseline.setAttribute('stroke', 'rgba(148, 163, 184, 0.18)');
    baseline.setAttribute('stroke-width', '1');
    svg.appendChild(baseline);

    function waveValue(shape, phase) {
      var x = phase - Math.floor(phase);
      if (shape === 'triangle') return 4 * Math.abs(x - 0.5) - 1;
      if (shape === 'square') return x < 0.5 ? 1 : -1;
      if (shape === 'sawtooth') return 2 * x - 1;
      return Math.sin(2 * Math.PI * x);
    }

    function pathFor(color, cycles, offset, amCycles) {
      var d = '';
      var steps = 200;
      for (var i = 0; i <= steps; i++) {
        var x = (i / steps) * W;
        var phase = (i / steps) * cycles + offset;
        var env = 1;
        if (o.amEnabled && depth > 0) {
          env = 1 - depth / 2 + (depth / 2) * Math.cos(2 * Math.PI * amCycles * (i / steps));
        }
        var y = mid - waveValue(o.wave, phase) * amp * env;
        d += (i === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
      }
      var path = document.createElementNS(NS, 'path');
      path.setAttribute('d', d.trim());
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', color);
      path.setAttribute('stroke-width', '2');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('opacity', '0.9');
      svg.appendChild(path);
    }

    var cyclesL = o.beat < 0.5 ? 4 : clamp(o.leftHz / 55, 3, 7);
    var cyclesR = o.beat < 0.5 ? cyclesL : cyclesL + clamp(o.beat / 5, 0.6, 5);
    var amCycles = clamp(o.amRate / 3, 1, 9);

    pathFor('#5eead4', cyclesL, 0, amCycles);
    if (o.beat >= 0.5 || o.independent) pathFor('#a78bfa', cyclesR, 0.3, amCycles);
  }

  function labTouched() {
    state.custom = true;
    var sel = $('#labPreset');
    if (sel) sel.value = '';
    if ($('#labPresetHint')) {
      $('#labPresetHint').textContent = 'Ajuste personalizado. Guárdalo si quieres repetir esta configuración exacta.';
    }
    commitOpts(false);
  }

  function bindLab() {
    var on = function (id, evt, handler) {
      var node = document.getElementById(id);
      if (node) node.addEventListener(evt, handler);
    };

    on('labCarrier', 'input', function () {
      var v = parseInt(this.value, 10);
      state.opts.carrier = v;
      if (state.opts.independent) state.opts.leftHz = v;
      labTouched();
    });

    on('labBeat', 'input', function () {
      var v = parseFloat(this.value);
      state.opts.beat = v;
      if (state.opts.independent) state.opts.rightHz = state.opts.leftHz + v;
      labTouched();
    });

    on('labRight', 'input', function () {
      state.opts.independent = true;
      state.opts.rightHz = parseInt(this.value, 10);
      labTouched();
    });

    on('labIndependent', 'change', function () {
      state.opts.independent = this.checked;
      if (this.checked) {
        state.opts.leftHz = state.opts.carrier;
        state.opts.rightHz = state.opts.carrier + state.opts.beat;
      }
      labTouched();
    });

    on('labSweep', 'change', function () {
      state.opts.sweep = this.checked;
      if (this.checked) {
        state.opts.carrierEnd = state.opts.carrier;
        state.opts.beatEnd = state.opts.beat;
      }
      labTouched();
    });

    on('labCarrierEnd', 'input', function () {
      var v = parseInt(this.value, 10);
      state.opts.carrierEnd = v;
      if (state.opts.independent) state.opts.leftEndHz = v;
      labTouched();
    });

    on('labBeatEnd', 'input', function () {
      var v = parseFloat(this.value);
      state.opts.beatEnd = v;
      if (state.opts.independent) state.opts.rightEndHz = state.opts.leftEndHz + v;
      labTouched();
    });

    on('labRightEnd', 'input', function () {
      state.opts.rightEndHz = parseInt(this.value, 10);
      labTouched();
    });

    on('labWave', 'change', function () {
      state.opts.wave = this.value;
      labTouched();
    });

    on('labBalance', 'input', function () {
      state.opts.balance = parseInt(this.value, 10);
      labTouched();
    });

    on('labAmRate', 'input', function () {
      state.opts.amRate = parseFloat(this.value);
      state.opts.amEnabled = true;
      labTouched();
    });

    on('labAmDepth', 'input', function () {
      state.opts.amDepth = parseInt(this.value, 10);
      if (state.opts.amDepth > 0) state.opts.amEnabled = true;
      labTouched();
    });

    on('labAmEnabled', 'change', function () {
      state.opts.amEnabled = this.checked;
      labTouched();
    });

    on('labNoiseType', 'change', function () {
      state.opts.noiseType = this.value;
      if (this.value === 'off') {
        state.opts.noiseLevel = 0;
      } else if (state.opts.noiseLevel < 1) {
        state.opts.noiseLevel = 5;
      }
      labTouched();
    });

    on('labNoiseLevel', 'input', function () {
      state.opts.noiseLevel = parseInt(this.value, 10);
      if (state.opts.noiseLevel > 0 && state.opts.noiseType === 'off') {
        state.opts.noiseType = 'pink';
      }
      labTouched();
    });

    on('labDuration', 'input', function () {
      state.opts.durationSec = parseInt(this.value, 10) * 60;
      labTouched();
    });

    on('labVolume', 'input', function () {
      state.opts.volume = parseInt(this.value, 10);
      labTouched();
    });

    on('labFadeIn', 'input', function () {
      state.opts.fadeIn = parseInt(this.value, 10);
      labTouched();
    });

    on('labFadeOut', 'input', function () {
      state.opts.fadeOut = parseInt(this.value, 10);
      labTouched();
    });

    on('labPreset', 'change', function () {
      if (!this.value) {
        if ($('#labPresetHint')) {
          $('#labPresetHint').textContent = 'Ajuste personalizado. Mueve los controles o guarda el resultado.';
        }
        return;
      }
      applyPreset(this.value);
    });

    on('labStart', 'click', startLabSession);

    on('labReset', 'click', function () {
      state.opts = normalizeOpts(defaultOpts());
      state.custom = true;
      var sel = $('#labPreset');
      if (sel) sel.value = 'calma';
      if ($('#labPresetHint')) $('#labPresetHint').textContent = B.LAB_PRESET_BY_ID.calma.hint;
      commitOpts(false);
      toast('Laboratorio restablecido al preset Alpha 10 Hz.');
    });

    on('labSave', 'click', function () {
      var suggested = currentLabName().replace(/\s*\(laboratorio\)\s*$/, '');
      var name = window.prompt('Nombre para este ajuste:', suggested);
      if (name == null) return;
      name = name.trim().slice(0, 48);
      if (!name) { toast('Pon un nombre para guardar el ajuste.'); return; }

      var saved = loadSavedPresets();
      var item = {
        id: 's' + Date.now().toString(36),
        name: name,
        ts: Date.now(),
        opts: JSON.parse(JSON.stringify(state.opts))
      };
      saved.unshift(item);
      if (saveSavedPresets(saved.slice(0, 50))) {
        renderSavedOptions();
        var sel = $('#labSaved');
        if (sel) sel.value = item.id;
        toast('Ajuste guardado en este navegador.');
      }
    });

    on('labLoadSaved', 'click', function () {
      var sel = $('#labSaved');
      if (!sel || !sel.value) { toast('Elige primero un ajuste guardado.'); return; }
      var item = loadSavedPresets().filter(function (x) { return x.id === sel.value; })[0];
      if (!item) { toast('Ese ajuste ya no existe.'); renderSavedOptions(); return; }
      state.opts = normalizeOpts(item.opts);
      state.custom = true;
      var preset = $('#labPreset');
      if (preset) preset.value = '';
      if ($('#labPresetHint')) $('#labPresetHint').textContent = 'Ajuste guardado: ' + item.name + '.';
      commitOpts(false);
      toast('Ajuste cargado: ' + item.name + '.');
    });

    on('labDeleteSaved', 'click', function () {
      var sel = $('#labSaved');
      if (!sel || !sel.value) { toast('Elige primero un ajuste guardado.'); return; }
      if (!window.confirm('¿Eliminar este ajuste guardado?')) return;
      var saved = loadSavedPresets().filter(function (x) { return x.id !== sel.value; });
      saveSavedPresets(saved);
      renderSavedOptions();
      toast('Ajuste eliminado.');
    });

    on('labExport', 'click', function () {
      var payload = {
        app: 'Onda Mental',
        type: 'lab-preset',
        version: 1,
        exported: new Date().toISOString(),
        name: currentLabName(),
        opts: state.opts
      };
      download('onda-mental-ajuste-' + new Date().toISOString().slice(0, 10) + '.json',
        'application/json;charset=utf-8', JSON.stringify(payload, null, 2));
      toast('Ajuste exportado en JSON.');
    });

    on('labImportBtn', 'click', function () {
      var input = $('#labImport');
      if (input) input.click();
    });

    on('labImport', 'change', function () {
      var input = this;
      var file = input.files && input.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var data = JSON.parse(String(reader.result));
          var raw = data && data.opts ? data.opts : data;
          if (!raw || typeof raw !== 'object') throw new Error('formato');
          state.opts = normalizeOpts(raw);
          state.custom = true;
          var preset = $('#labPreset');
          if (preset) preset.value = '';
          if ($('#labPresetHint')) {
            $('#labPresetHint').textContent = 'Ajuste importado' +
              (data && data.name ? ': ' + data.name : '') + '.';
          }
          commitOpts(false);
          toast('Ajuste importado.');
        } catch (e) {
          toast('No se pudo leer el JSON: revisa que sea un ajuste exportado por esta página.');
        }
        input.value = '';
      };
      reader.onerror = function () {
        toast('No se pudo leer el archivo.');
        input.value = '';
      };
      reader.readAsText(file);
    });
  }

  /* --------------------------------------------------------------- estudio */
  function buildMeasures(container, kind) {
    if (!container || container.children.length) return;

    B.STUDY_MEASURES.forEach(function (measure) {
      var wrap = el('div', 'control measure');
      var label = el('label');
      label.setAttribute('for', kind + '-' + measure.id);
      label.appendChild(document.createTextNode(measure.label));
      var out = el('output', null, '5/10');
      out.id = kind + '-' + measure.id + '-val';
      label.appendChild(out);
      wrap.appendChild(label);

      var input = document.createElement('input');
      input.type = 'range';
      input.min = '0';
      input.max = '10';
      input.step = '1';
      input.value = '5';
      input.id = kind + '-' + measure.id;
      wrap.appendChild(input);
      wrap.appendChild(el('p', 'control-hint', measure.hint));

      input.addEventListener('input', function () {
        out.textContent = this.value + '/10';
      });

      container.appendChild(wrap);
    });
  }

  function readMeasures(kind) {
    var result = {};
    B.STUDY_MEASURES.forEach(function (measure) {
      var input = document.getElementById(kind + '-' + measure.id);
      if (input) result[measure.id] = parseInt(input.value, 10);
    });
    return result;
  }

  function setMeasures(kind, value) {
    B.STUDY_MEASURES.forEach(function (measure) {
      var input = document.getElementById(kind + '-' + measure.id);
      var out = document.getElementById(kind + '-' + measure.id + '-val');
      if (input) input.value = String(value);
      if (out) out.textContent = value + '/10';
    });
  }

  function loadStudySettings() {
    try {
      var raw = localStorage.getItem(STUDY_KEY);
      var data = raw ? JSON.parse(raw) : {};
      state.study.enabled = !!data.enabled;
      state.study.code = data.code || '';
      state.study.group = data.group || '';
    } catch (e) {
      state.study.enabled = false;
    }

    if ($('#studyEnabled')) $('#studyEnabled').checked = state.study.enabled;
    if ($('#studyCode')) $('#studyCode').value = state.study.code;
    if ($('#studyGroup')) $('#studyGroup').value = state.study.group;
    if ($('#studyFields')) $('#studyFields').hidden = !state.study.enabled;
    state.study.consent = false;
  }

  function saveStudySettings() {
    try {
      localStorage.setItem(STUDY_KEY, JSON.stringify({
        enabled: state.study.enabled,
        code: state.study.code,
        group: state.study.group
      }));
    } catch (e) { /* sin almacenamiento */ }
  }

  function renderTheory() {
    var t = B.THEORY;
    if (!t) return;

    if ($('#theoryTitle')) $('#theoryTitle').textContent = t.title;
    if ($('#theoryIntro')) $('#theoryIntro').textContent = t.intro;

    var body = $('#theoryBody');
    if (body) {
      body.textContent = '';
      t.paragraphs.forEach(function (text) {
        body.appendChild(el('p', null, text));
      });
    }

    if ($('#theoryCaveat')) $('#theoryCaveat').textContent = t.caveat;

    var principles = $('#theoryPrinciples');
    if (principles) {
      principles.textContent = '';
      t.principles.forEach(function (text) {
        principles.appendChild(el('li', null, text));
      });
    }

    var refs = $('#theoryRefs');
    if (refs) {
      refs.textContent = '';
      t.refs.forEach(function (key, index) {
        if (index) refs.appendChild(document.createElement('br'));
        refs.appendChild(document.createTextNode(B.REFS[key] || key));
      });
    }
  }

  function bindStudy() {
    var on = function (id, evt, handler) {
      var node = document.getElementById(id);
      if (node) node.addEventListener(evt, handler);
    };

    on('studyEnabled', 'change', function () {
      state.study.enabled = this.checked;
      if ($('#studyFields')) $('#studyFields').hidden = !this.checked;
      if (!this.checked) {
        state.study.consent = false;
        if ($('#studyConsent')) $('#studyConsent').checked = false;
      }
      saveStudySettings();
    });

    on('studyCode', 'input', function () {
      state.study.code = this.value.trim();
      saveStudySettings();
    });

    on('studyGroup', 'input', function () {
      state.study.group = this.value.trim();
      saveStudySettings();
    });

    on('studyConsent', 'change', function () {
      state.study.consent = this.checked;
    });
  }

  /* ------------------------------------------------------------------ navegación */
  function bindNav() {
    var toggle = $('#navToggle');
    var nav = $('#navMenu');

    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    $$('a', nav).forEach(function (a) {
      a.addEventListener('click', function () {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });

    document.addEventListener('click', function (e) {
      if (!nav.classList.contains('open')) return;
      if (nav.contains(e.target) || toggle.contains(e.target)) return;
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    });

    if ('IntersectionObserver' in window) {
      var links = {};
      $$('a', nav).forEach(function (a) { links[a.getAttribute('href').slice(1)] = a; });
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          $$('a', nav).forEach(function (a) { a.classList.remove('active'); });
          var link = links[entry.target.id];
          if (link) link.classList.add('active');
        });
      }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
      ['crear', 'laboratorio', 'protocolos', 'evidencia', 'estudio', 'bitacora', 'guia'].forEach(function (id) {
        var section = document.getElementById(id);
        if (section) observer.observe(section);
      });
    }
  }

  /* ------------------------------------------------------------------- init */
  function init() {
    drawHeroWave();
    renderChips();
    renderProtocols();
    renderBands();
    renderTheory();
    renderPresetOptions();
    renderSavedOptions();
    buildMeasures($('#preMeasures'), 'pre');
    buildMeasures($('#postMeasures'), 'post');
    setMeasures('pre', 5);
    setMeasures('post', 5);
    loadStudySettings();
    bindAdvanced();
    bindSession();
    bindJournalForm();
    bindJournal();
    bindLab();
    bindStudy();
    bindNav();
    syncAdvancedUI();
    syncLabUI();
    drawLabWave();
    renderJournal();

    $('#btnGenerate').addEventListener('click', generateFromText);
    $('#btnRandom').addEventListener('click', randomProtocol);

    $('#goal').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        generateFromText();
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (!$('#journalDialog').hidden) { closeJournalDialog(); return; }
      if (!$('#session').hidden) { stopSession(false); }
    });

    // Si la pestaña estuvo en segundo plano, el audio pudo terminar sin que
    // corriera la animación: al volver, cerramos la sesión correctamente.
    document.addEventListener('visibilitychange', function () {
      if (document.hidden || $('#session').hidden) return;
      if (!state.raf) tickSession();
    });

    window.addEventListener('beforeunload', function () {
      // No dejamos audio huérfano si se cierra la pestaña.
      if (B.Audio.isPlaying()) B.Audio.stop(0.2);
    });

    // Caché offline (solo en http/https; con file:// los archivos ya son locales).
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('sw.js').catch(function () { /* sin soporte o sin permiso */ });
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

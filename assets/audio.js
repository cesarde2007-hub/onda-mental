/* =========================================================================
   Onda Mental — motor de audio binaural (modo laboratorio)
   Cadena: oscL/oscR -> ganancia por oído -> merger L/R -> volumen
           -> modulación de amplitud -> fundido -> limitador -> salida.
   El volumen del usuario y el fundido viven en nodos separados para que
   mover el volumen a mitad de sesión no cancele el cierre programado.
   -------------------------------------------------------------------------
   El motor acepta frecuencias independientes por oído (leftHz / rightHz),
   barridos (leftEndHz / rightEndHz), forma de onda, balance de oídos,
   ruido rosa/marrón/blanco y modulación de amplitud tipo isocrónica.
   ========================================================================= */
window.BEATLAB = window.BEATLAB || {};

(function (B) {
  'use strict';

  var ctx = null;
  var nodes = null;
  var session = null;
  var state = 'idle'; // idle | playing | stopping
  var noiseBuffers = {};

  var MAX_GAIN = 0.5;
  var DEFAULT_FADE_IN = 10;
  var DEFAULT_FADE_OUT = 12;
  var WAVES = ['sine', 'triangle', 'square', 'sawtooth'];

  function clamp(v, min, max) {
    v = Number(v);
    if (!isFinite(v)) return min;
    return Math.min(max, Math.max(min, v));
  }

  function ensureContext() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    return ctx;
  }

  function gainForVolume(v) {
    // Curva perceptual suave y techo duro: nunca más de 0.5 de amplitud.
    var x = Math.min(100, Math.max(0, Number(v) || 0)) / 100;
    return Math.min(MAX_GAIN, Math.pow(x, 1.6) * 0.55);
  }

  /* Ruido: rosa (Voss-McCartney), marrón (integración) o blanco. */
  function getNoiseBuffer(type) {
    type = (type === 'brown' || type === 'white') ? type : 'pink';
    if (noiseBuffers[type]) return noiseBuffers[type];

    var seconds = 4;
    var len = Math.floor(ctx.sampleRate * seconds);
    var buffer = ctx.createBuffer(2, len, ctx.sampleRate);

    for (var ch = 0; ch < 2; ch++) {
      var d = buffer.getChannelData(ch);
      var i;
      if (type === 'white') {
        for (i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      } else if (type === 'brown') {
        var last = 0;
        for (i = 0; i < len; i++) {
          var w = Math.random() * 2 - 1;
          last = (last + 0.02 * w) / 1.02;
          d[i] = last * 3.5;
        }
      } else {
        var b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (i = 0; i < len; i++) {
          var white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.10;
          b6 = white * 0.115926;
        }
      }
    }

    noiseBuffers[type] = buffer;
    return buffer;
  }

  function disconnectAll(n) {
    if (!n) return;
    try { n.oscL.stop(); } catch (e) { /* ya detenido */ }
    try { n.oscR.stop(); } catch (e) { /* ya detenido */ }
    try { if (n.noiseSrc) n.noiseSrc.stop(); } catch (e) { /* ya detenido */ }
    try { if (n.lfo) n.lfo.stop(); } catch (e) { /* ya detenido */ }
    [n.oscL, n.oscR, n.gainL, n.gainR, n.merger, n.volumeGain, n.amGain,
      n.fadeGain, n.limiter, n.noiseSrc, n.noiseGain, n.lfo, n.lfoGain
    ].forEach(function (node) {
      if (!node) return;
      try { node.disconnect(); } catch (e) { /* ya desconectado */ }
    });
  }

  /* Cierra una sesión concreta. Si mientras tanto empezó otra, no la toca. */
  function cleanup(target) {
    var n = target || nodes;
    if (!n) return;
    disconnectAll(n);
    if (n === nodes) {
      nodes = null;
      session = null;
      state = 'idle';
    }
  }

  var Audio = {
    supported: function () {
      return !!(window.AudioContext || window.webkitAudioContext);
    },

    /* cfg: {
         leftHz, rightHz, leftEndHz, rightEndHz,
         beat, carrier, beatEnd,          // compatibilidad con protocolos
         wave, leftGain, rightGain,
         durationSec, volume,
         noiseType, noiseLevel, noise,    // noise = compatibilidad antigua
         am: { enabled, rate, depth },    // depth 0..1
         fadeIn, fadeOut
       } */
    start: function (cfg) {
      return new Promise(function (resolve, reject) {
        var c = ensureContext();
        if (!c) { reject(new Error('Este navegador no soporta Web Audio.')); return; }

        if (state !== 'idle') Audio.stop(0.25);

        var run = function () {
          try {
            var now = c.currentTime;
            var duration = Math.min(600, Math.max(30, Number(cfg.durationSec) || 480));
            var left = clamp(cfg.leftHz != null ? cfg.leftHz
              : (cfg.carrier != null ? cfg.carrier : 200), 40, 1200);
            var beat = clamp(cfg.beat != null ? cfg.beat : 10, 0, 60);
            var right = clamp(cfg.rightHz != null ? cfg.rightHz : left + beat, 40, 1200);
            var leftEnd = clamp(cfg.leftEndHz != null ? cfg.leftEndHz : left, 40, 1200);
            var rightEnd = clamp(cfg.rightEndHz != null ? cfg.rightEndHz : right, 40, 1200);

            var wave = WAVES.indexOf(cfg.wave) !== -1 ? cfg.wave : 'sine';
            var leftGain = clamp(cfg.leftGain != null ? cfg.leftGain : 0.5, 0, 1);
            var rightGain = clamp(cfg.rightGain != null ? cfg.rightGain : 0.5, 0, 1);
            var volume = cfg.volume == null ? 28 : cfg.volume;

            var noiseType = cfg.noiseType || 'pink';
            var noiseLevel = clamp(cfg.noiseLevel != null ? cfg.noiseLevel
              : (cfg.noise || 0) * 100 / 0.7, 0, 30);

            var am = cfg.am || {};
            var amEnabled = !!am.enabled && Number(am.depth) > 0.001;
            var amRate = clamp(am.rate == null ? 4 : am.rate, 0.1, 40);
            var amDepth = clamp(am.depth == null ? 0.5 : am.depth, 0, 1);

            // Los fundidos nunca comen más del 45 % de la sesión.
            var fadeIn = clamp(cfg.fadeIn == null
              ? Math.min(DEFAULT_FADE_IN, duration * 0.15) : cfg.fadeIn, 0.05, duration * 0.45);
            var fadeOut = clamp(cfg.fadeOut == null
              ? Math.min(DEFAULT_FADE_OUT, duration * 0.2) : cfg.fadeOut, 0.05, duration * 0.45);

            var oscL = c.createOscillator();
            var oscR = c.createOscillator();
            oscL.type = wave;
            oscR.type = wave;
            oscL.frequency.setValueAtTime(left, now);
            oscR.frequency.setValueAtTime(right, now);
            if (Math.abs(leftEnd - left) > 0.01) {
              oscL.frequency.linearRampToValueAtTime(leftEnd, now + duration);
            }
            if (Math.abs(rightEnd - right) > 0.01) {
              oscR.frequency.linearRampToValueAtTime(rightEnd, now + duration);
            }

            var gainL = c.createGain();
            var gainR = c.createGain();
            gainL.gain.value = leftGain;
            gainR.gain.value = rightGain;

            var merger = c.createChannelMerger(2);
            var volumeGain = c.createGain();
            var amGain = c.createGain();
            var fadeGain = c.createGain();
            var limiter = c.createDynamicsCompressor();

            limiter.threshold.value = -3;
            limiter.knee.value = 0;
            limiter.ratio.value = 12;
            limiter.attack.value = 0.003;
            limiter.release.value = 0.25;

            volumeGain.gain.setValueAtTime(gainForVolume(volume), now);

            /* Modulación de amplitud: LFO que resta profundidad al gain.
               Profundidad 100 % = pulso de 0 a 1; 0 % = sin pulso. */
            var lfo = null;
            var lfoGain = null;
            if (amEnabled) {
              lfo = c.createOscillator();
              lfo.type = 'sine';
              lfo.frequency.value = amRate;
              lfoGain = c.createGain();
              lfoGain.gain.value = amDepth / 2;
              amGain.gain.value = 1 - amDepth / 2;
              lfo.connect(lfoGain);
              lfoGain.connect(amGain.gain);
            } else {
              amGain.gain.value = 1;
            }

            /* Fundido de entrada, sostenimiento y salida. */
            fadeGain.gain.setValueAtTime(fadeIn > 0.06 ? 0.0001 : 1, now);
            if (fadeIn > 0.06) {
              fadeGain.gain.exponentialRampToValueAtTime(1, now + fadeIn);
            }
            var fadeStart = now + Math.max(fadeIn, duration - fadeOut);
            if (fadeStart > now + fadeIn + 0.01) {
              fadeGain.gain.setValueAtTime(1, fadeStart);
            }
            fadeGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

            oscL.connect(gainL);
            oscR.connect(gainR);
            gainL.connect(merger, 0, 0);
            gainR.connect(merger, 0, 1);
            merger.connect(volumeGain);
            volumeGain.connect(amGain);
            amGain.connect(fadeGain);
            fadeGain.connect(limiter);
            limiter.connect(c.destination);

            var noiseSrc = null;
            var noiseGain = null;
            if (noiseType !== 'off' && noiseLevel > 0.05) {
              noiseSrc = c.createBufferSource();
              noiseSrc.buffer = getNoiseBuffer(noiseType);
              noiseSrc.loop = true;
              noiseGain = c.createGain();
              noiseGain.gain.value = (noiseLevel / 100) * 0.7;
              noiseSrc.connect(noiseGain);
              noiseGain.connect(volumeGain);
              noiseSrc.start(now);
            }

            oscL.start(now);
            oscR.start(now);
            if (lfo) lfo.start(now);

            nodes = {
              oscL: oscL, oscR: oscR, gainL: gainL, gainR: gainR,
              merger: merger, volumeGain: volumeGain, amGain: amGain,
              fadeGain: fadeGain, limiter: limiter,
              noiseSrc: noiseSrc, noiseGain: noiseGain, lfo: lfo, lfoGain: lfoGain
            };

            session = {
              startedAt: now,
              duration: duration,
              left: left,
              right: right,
              leftEnd: leftEnd,
              rightEnd: rightEnd,
              beat: right - left,
              beatEnd: rightEnd - leftEnd,
              wave: wave,
              amEnabled: amEnabled,
              amRate: amRate,
              amDepth: amDepth,
              fadeIn: fadeIn,
              fadeOut: fadeOut,
              volume: volume,
              timer: null
            };
            state = 'playing';

            session.timer = setTimeout(function () {
              session.timer = null;
              cleanup(nodes);
            }, (duration + 0.6) * 1000);

            resolve();
          } catch (err) {
            cleanup(nodes);
            reject(err);
          }
        };

        if (c.state === 'suspended') {
          // En iOS/Safari el contexto puede quedar suspendido hasta un gesto real.
          // Si no arranca, avisamos en vez de dejar la interfaz colgada.
          var settled = false;
          var fail = function () {
            if (settled) return;
            settled = true;
            reject(new Error('El navegador bloqueó el audio. Pulsa «Iniciar sesión» otra vez.'));
          };
          var fallback = setTimeout(fail, 1800);
          c.resume().then(function () {
            if (settled) return;
            settled = true;
            clearTimeout(fallback);
            run();
          }).catch(function (err) {
            if (settled) return;
            settled = true;
            clearTimeout(fallback);
            reject(err);
          });
        } else {
          run();
        }
      });
    },

    stop: function (fadeSec) {
      if (state === 'idle' || !nodes || !ctx) return;
      var fade = fadeSec == null ? 2 : Math.max(0.05, Number(fadeSec));
      state = 'stopping';

      var target = nodes;
      var now = ctx.currentTime;
      var g = target.fadeGain.gain;
      var current = Math.max(0.0001, g.value);
      try {
        g.cancelScheduledValues(now);
        g.setValueAtTime(current, now);
        g.exponentialRampToValueAtTime(0.0001, now + fade);
      } catch (e) { /* ignore */ }

      if (session && session.timer) {
        clearTimeout(session.timer);
        session.timer = null;
      }
      setTimeout(function () { cleanup(target); }, fade * 1000 + 140);
    },

    setVolume: function (v) {
      if (!nodes || !ctx) return;
      var target = Math.max(0.0001, gainForVolume(v));
      if (session) session.volume = v;
      var now = ctx.currentTime;
      var g = nodes.volumeGain.gain;
      try {
        g.cancelScheduledValues(now);
        g.setValueAtTime(Math.max(0.0001, g.value), now);
        g.linearRampToValueAtTime(target, now + 0.15);
      } catch (e) { /* ignore */ }
    },

    /* Cambia el balance de oídos en vivo (sin reiniciar la sesión). */
    setEarGains: function (leftGain, rightGain) {
      if (!nodes || !ctx) return;
      var now = ctx.currentTime;
      try {
        nodes.gainL.gain.setTargetAtTime(clamp(leftGain, 0, 1), now, 0.05);
        nodes.gainR.gain.setTargetAtTime(clamp(rightGain, 0, 1), now, 0.05);
      } catch (e) { /* ignore */ }
    },

    isPlaying: function () {
      return state === 'playing';
    },

    /* Estado para la interfaz: tiempo, fase y frecuencias actuales. */
    getState: function () {
      if (!session || !ctx) return null;
      var elapsed = Math.max(0, Math.min(session.duration, ctx.currentTime - session.startedAt));
      var phase;
      if (elapsed < session.fadeIn) phase = 'Inducción';
      else if (elapsed < session.duration - session.fadeOut) phase = 'Sostenimiento';
      else phase = 'Cierre';

      var t = elapsed / session.duration;
      var left = session.left + (session.leftEnd - session.left) * t;
      var right = session.right + (session.rightEnd - session.right) * t;

      return {
        elapsed: elapsed,
        remaining: Math.max(0, session.duration - elapsed),
        duration: session.duration,
        progress: Math.min(1, t),
        phase: phase,
        leftHz: left,
        rightHz: right,
        beat: Math.abs(right - left),
        beatSigned: right - left,
        wave: session.wave,
        amEnabled: session.amEnabled,
        amRate: session.amRate,
        playing: state === 'playing'
      };
    }
  };

  B.Audio = Audio;

})(window.BEATLAB);

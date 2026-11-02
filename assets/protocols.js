/* =========================================================================
   Onda Mental — biblioteca de protocolos
   Datos abiertos, sin dependencias. Todo se ejecuta en el navegador.
   -------------------------------------------------------------------------
   Bandas EEG de referencia (convención estándar en investigación):
     Delta 0.5–4 Hz · Theta 4–8 Hz · Alpha 8–13 Hz · Beta 13–30 Hz · Gamma 30–100 Hz
   Los protocolos usan batidos binaurales: dos tonos puros, uno por oído,
   separados por la frecuencia del batido. Requieren auriculares estéreo.
   ========================================================================= */
window.BEATLAB = window.BEATLAB || {};

(function (B) {
  'use strict';

  B.BANDS = [
    {
      id: 'delta', name: 'Delta', min: 0.5, max: 4, color: '#8b5cf6',
      short: 'Sueño profundo y restauración',
      long: 'Ondas lentas y amplias, dominantes en el sueño profundo (N3). Se asocian a restauración física y consolidación de memoria.'
    },
    {
      id: 'theta', name: 'Theta', min: 4, max: 8, color: '#6366f1',
      short: 'Somnolencia, imaginación, meditación',
      long: 'Presentes al quedarse dormido, en meditación y en tareas creativas. Relacionadas con memoria y procesamiento emocional.'
    },
    {
      id: 'alpha', name: 'Alpha', min: 8, max: 13, color: '#22d3ee',
      short: 'Relajación despierta',
      long: 'Ritmo característico de vigilia tranquila con ojos cerrados. Aumenta al relajarse y disminuye al abrir los ojos o concentrarse.'
    },
    {
      id: 'beta', name: 'Beta', min: 13, max: 30, color: '#f59e0b',
      short: 'Alerta, foco y pensamiento activo',
      long: 'Predomina en la vigilia activa, el razonamiento y la atención sostenida. Puede aumentar con la cafeína y el estrés.'
    },
    {
      id: 'gamma', name: 'Gamma', min: 30, max: 100, color: '#fb7185',
      short: 'Integración cognitiva de alta frecuencia',
      long: 'Oscilaciones rápidas vinculadas a atención, memoria de trabajo y binding perceptual. Su medición en superficie es exigente.'
    }
  ];

  B.BAND_BY_ID = B.BANDS.reduce(function (acc, b) { acc[b.id] = b; return acc; }, {});

  /* Banda especial para el modo control: los dos oídos reciben la misma
     frecuencia y no existe batido. Se usa como condición de comparación. */
  B.CONTROL_BAND = {
    id: 'control', name: 'Sin batido', min: 0, max: 0.5, color: '#94a3b8',
    short: 'Condición de control',
    long: 'Misma frecuencia en ambos oídos. No hay batido binaural; sirve como comparación en un experimento.'
  };
  B.BAND_BY_ID.control = B.CONTROL_BAND;

  /* -----------------------------------------------------------------------
     Evidencia: referencias reales. `level` es una síntesis honesta del
     peso de la evidencia, no una garantía de efecto individual.
     3 = moderada (meta-análisis) · 2 = preliminar (estudios pequeños)
     1 = exploratoria (hipótesis, resultados mixtos)
     ----------------------------------------------------------------------- */
  B.REFS = {
    oster1973: 'Oster, G. (1973). Auditory beats in the brain. Scientific American, 229(4), 94–102.',
    licklider1950: 'Licklider, J. C. R., Webster, J. C., & Hedlun, J. M. (1950). On the frequency limits of binaural beats. Journal of the Acoustical Society of America, 22(4), 468–473.',
    lane1998: 'Lane, J. D., Kasian, S. J., Owens, J. E., & Marsh, G. R. (1998). Binaural auditory beats affect vigilance performance and mood. Physiology & Behavior, 63(2), 249–252.',
    huang2008: 'Huang, T. L., & Charyton, C. (2008). A comprehensive review of the psychological effects of brainwave entrainment. Alternative Therapies in Health and Medicine, 14(5), 38–50.',
    gao2014: 'Gao, X., Cao, H., Ming, D., Qi, H., Wang, X., Wang, Y., et al. (2014). Analysis of EEG activity in response to binaural beats with different frequencies. International Journal of Psychophysiology, 94(3), 399–406.',
    chaieb2015: 'Chaieb, L., Wilpert, E. C., Reber, T. P., & Fell, J. (2015). Auditory beat stimulation and its effects on cognition and mood states. Frontiers in Psychiatry, 6, 70.',
    beauchene2016: 'Beauchene, C., Abaid, N., Moran, R., Diana, R. A., & Leonessa, A. (2016). The effect of binaural beats on visuospatial working memory and cortical connectivity. PLoS ONE, 11(11), e0166630.',
    jirakittayakorn2017: 'Jirakittayakorn, N., & Wongsawat, Y. (2017). Brain responses to a 6-Hz binaural beat: effects on general theta rhythm and frontal midline theta activity. Frontiers in Neuroscience, 11, 365.',
    garcia2019: 'Garcia-Argibay, M., Santed, M. A., & Reales, J. M. (2019). Efficacy of binaural auditory beats in cognition, anxiety, and pain perception: a meta-analysis. Psychological Research, 83(2), 357–372.',
    reedijk2013: 'Reedijk, S. A., Bolders, A., & Hommel, B. (2013). The impact of binaural beats on creativity. Frontiers in Human Neuroscience, 7, 786.',
    ingendoh2023: 'Ingendoh, R. M., Posny, E. S., & Heine, A. (2023). Binaural beats to entrain the brain? A systematic review of the effects of binaural beat stimulation on brain oscillatory activity. PLoS ONE, 18(5), e0286023.',
    grinberg1987: 'Grinberg-Zylberbaum, J. (1987). La teoría sintérgica. México: INPEC.',
    grinberg1994: 'Grinberg-Zylberbaum, J., Delaflor, M., Attie, L., & Goswami, A. (1994). The Einstein-Podolsky-Rosen paradox in the brain: The transferred potential. Physics Essays, 7(4), 422–428.'
  };

  /* -----------------------------------------------------------------------
     Protocolos. Cada uno cabe en 10 minutos o menos (límite del laboratorio).
     ----------------------------------------------------------------------- */
  B.PROTOCOLS = [
    {
      id: 'calma',
      name: 'Calma Alpha',
      tagline: 'Bajar el volumen del ruido mental y soltar la tensión del cuerpo.',
      band: 'alpha',
      beat: 10,
      carrier: 200,
      durationSec: 480,
      noise: 0.05,
      color: '#22d3ee',
      evidence: {
        level: 3,
        title: 'Evidencia moderada',
        summary: 'El meta-análisis de Garcia-Argibay y colaboradores (2019) encontró un efecto pequeño pero consistente de los batidos binaurales sobre la ansiedad. Los efectos son modestos y variables entre personas.',
        refs: ['garcia2019', 'chaieb2015', 'huang2008']
      },
      rationale: '10 Hz cae en el centro de la banda alpha (8–13 Hz), el ritmo de la relajación despierta. La portadora de 200 Hz es baja, lo que facilita la percepción del batido (por debajo de ~1000 Hz se percibe con claridad).',
      goals: ['relajarme', 'bajar la ansiedad', 'soltar tensión'],
      experiment: {
        title: 'El escáner de tres puertas',
        steps: [
          'Cierra los ojos y elige tres puntos del cuerpo: mandíbula, hombros y abdomen.',
          'Recorre cada puerta durante ~2 minutos. No corrijas nada: solo nota la temperatura y la presión.',
          'Cuando aparezca un pensamiento, ponle una etiqueta de una palabra y vuelve al punto del cuerpo.',
          'En el cierre, nota si alguna puerta se abrió (se soltó) sin que tú la forzaras.'
        ]
      },
      caution: 'Si sientes mareo, presión en los oídos o irritabilidad, baja el volumen o detén la sesión.'
    },
    {
      id: 'foco',
      name: 'Foco Beta 16',
      tagline: 'Entrar en modo tarea: atención sostenida y menos dispersión.',
      band: 'beta',
      beat: 16,
      carrier: 250,
      durationSec: 600,
      noise: 0.04,
      color: '#f59e0b',
      evidence: {
        level: 3,
        title: 'Evidencia moderada',
        summary: 'Lane y colaboradores (1998) hallaron que el batido beta (16 Hz) mejoraba la vigilancia, mientras el theta/delta la reducía. El meta-análisis de 2019 reporta efectos pequeños en atención, con heterogeneidad alta.',
        refs: ['lane1998', 'garcia2019', 'chaieb2015']
      },
      rationale: '16 Hz se sitúa en beta media, la franja asociada a vigilancia y control atencional en los estudios clásicos de batidos binaurales. Portadora de 250 Hz para un batido claro y poco fatigante.',
      goals: ['concentrarme', 'estudiar', 'trabajar sin distraerme'],
      experiment: {
        title: 'La tarea única',
        steps: [
          'Antes de empezar, elige UNA sola tarea y escríbela en una frase.',
          'Deja el móvil fuera de la mesa. Si aparece una distracción, anótala en una hoja y vuelve.',
          'Cuenta cuántas veces vuelves (no cuántas te distraes): cada retorno es una repetición de atención.',
          'Al terminar, compara: ¿la tarea te costó arrancar o mantenerla?'
        ]
      },
      caution: 'Beta a volumen alto puede resultar estimulante o irritante. Empieza bajo. No lo uses justo antes de dormir.'
    },
    {
      id: 'meditacion',
      name: 'Meditación Theta 6',
      tagline: 'Soltar el control y observar el pensamiento sin perseguirlo.',
      band: 'theta',
      beat: 6,
      carrier: 210,
      durationSec: 480,
      noise: 0.06,
      color: '#6366f1',
      evidence: {
        level: 2,
        title: 'Evidencia preliminar',
        summary: 'Jirakittayakorn y Wongsawat (2017) observaron que un batido de 6 Hz aumentaba la actividad theta frontal media. Es un estudio pequeño: sugiere un efecto electrofisiológico, no prueba un beneficio clínico.',
        refs: ['jirakittayakorn2017', 'gao2014', 'ingendoh2023']
      },
      rationale: '6 Hz está en el centro de theta, banda vinculada a somnolencia ligera, imaginación y meditación. Se usa una portadora de 210 Hz y un colchón de ruido suave para que el tono no resulte áspero.',
      goals: ['meditar', 'observar mis pensamientos', 'soltar el control'],
      experiment: {
        title: 'Las nubes que no son tuyas',
        steps: [
          'Imagina un cielo abierto y plano frente a ti.',
          'Cada pensamiento que llegue se convierte en una nube. No la empujes ni la retengas.',
          'Si te descubres dentro de una nube, abre los ojos 3 segundos y vuelve al cielo.',
          'Al final, pregúntate: ¿quién estaba mirando las nubes?'
        ]
      },
      caution: 'Theta profundo puede dar somnolencia. No lo uses conduciendo ni con tareas que exijan alerta.'
    },
    {
      id: 'creatividad',
      name: 'Creatividad Alpha',
      tagline: 'Abrir asociaciones laterales y generar ideas sin juzgarlas.',
      band: 'alpha',
      beat: 10,
      carrier: 180,
      durationSec: 480,
      noise: 0.05,
      color: '#5eead4',
      evidence: {
        level: 2,
        title: 'Evidencia preliminar',
        summary: 'Reedijk, Bolders y Hommel (2013) encontraron que un batido alpha de 10 Hz mejoraba el pensamiento divergente frente a gamma y control. Muestra pequeña; se necesita replicación.',
        refs: ['reedijk2013', 'chaieb2015']
      },
      rationale: 'La banda alpha se ha relacionado con menor inhibición cortical y mayor fluidez asociativa. 10 Hz con portadora de 180 Hz produce un batido muy perceptible y un timbre cálido.',
      goals: ['tener ideas', 'desbloquearme', 'pensar distinto'],
      experiment: {
        title: 'Diez usos imposibles',
        steps: [
          'Elige un objeto común: un clip, una silla, una cuchara.',
          'Genera 10 usos absurdos sin evaluarlos. Prohibido decir "no sirve".',
          'Cuando llegues al sexto, baja el ritmo: los últimos suelen ser los más originales.',
          'Al cerrar, elige el uso que más te sorprendió y anota por qué.'
        ]
      },
      caution: 'No hay que "esforzarse" en tener ideas: el esfuerzo evalúa. Deja que el juicio llegue después.'
    },
    {
      id: 'sueno',
      name: 'Descenso Delta',
      tagline: 'Soltar el día y preparar el cuerpo para dormir.',
      band: 'delta',
      beat: 2.5,
      carrier: 150,
      durationSec: 600,
      noise: 0.07,
      color: '#8b5cf6',
      evidence: {
        level: 1,
        title: 'Evidencia exploratoria',
        summary: 'La evidencia sobre batidos binaurales para inducir o mejorar el sueño es limitada y con resultados mixtos. Se usa aquí como ritual de relajación, no como tratamiento del insomnio.',
        refs: ['huang2008', 'chaieb2015', 'ingendoh2023']
      },
      rationale: '2.5 Hz cae en delta, la banda dominante del sueño profundo. La portadora de 150 Hz y el ruido suave buscan un paisaje sonoro estable, sin cambios bruscos que reactiven la alerta.',
      goals: ['dormir', 'descansar', 'soltar el día'],
      experiment: {
        title: 'La escalera de diez peldaños',
        steps: [
          'Acuéstate y visualiza una escalera que baja hacia una habitación oscura y segura.',
          'Baja un peldaño por respiración, contando de 10 a 0.',
          'En cada peldaño, suelta una parte del cuerpo: pies, piernas, cadera, espalda, hombros, cara.',
          'Si llegas a 0 y sigues despierto, no te reclames: quédate escuchando el tono sin meta.'
        ]
      },
      caution: 'Úsalo solo acostado y con la luz baja. Nunca al volante. Si tienes insomnio persistente, consulta a un profesional.'
    },
    {
      id: 'memoria',
      name: 'Memoria Gamma 40',
      tagline: 'Sostener y manipular información en la mente por unos minutos.',
      band: 'gamma',
      beat: 40,
      carrier: 340,
      durationSec: 540,
      noise: 0.04,
      color: '#fb7185',
      evidence: {
        level: 2,
        title: 'Evidencia preliminar',
        summary: 'Beauchene y colaboradores (2016) reportaron mejoras en memoria de trabajo visoespacial y cambios en conectividad cortical con batidos de 40 Hz. Estudio pequeño y con tareas específicas.',
        refs: ['beauchene2016', 'chaieb2015']
      },
      rationale: '40 Hz es la frecuencia gamma más estudiada en batidos binaurales y en estimulación sensorial. La portadora de 340 Hz mantiene el batido dentro del rango audible cómodo.',
      goals: ['memorizar', 'recordar', 'entrenar mi memoria'],
      experiment: {
        title: 'Cinco objetos en una mesa',
        steps: [
          'Visualiza una mesa con cinco objetos cotidianos. Nómbralos en voz baja.',
          'Cierra los ojos y recórrelos en orden inverso.',
          'Añade un sexto objeto y repite la lista sin mirar.',
          'Al terminar la sesión, anota cuántos recordaste y en qué orden.'
        ]
      },
      caution: 'Gamma puede sonar más "agudo" o fatigante. Mantén el volumen bajo y descansa los oídos si notas presión.'
    },
    {
      id: 'flow',
      name: 'Transición Alpha → Beta',
      tagline: 'Pasar de la calma al impulso: activarte sin sobresalto.',
      band: 'alpha',
      beat: 10,
      beatEnd: 14,
      carrier: 220,
      durationSec: 600,
      noise: 0.05,
      color: '#a78bfa',
      evidence: {
        level: 1,
        title: 'Evidencia exploratoria',
        summary: 'La idea de "arrastrar" la frecuencia del batido de alpha a beta es plausible pero poco estudiada como protocolo. Se incluye como experimento personal, no como intervención validada.',
        refs: ['chaieb2015', 'ingendoh2023']
      },
      rationale: 'El batido asciende lentamente de 10 a 14 Hz durante toda la sesión: empieza en relajación alpha y termina en beta baja, buscando un despertar gradual en lugar de un cambio brusco.',
      goals: ['activarme', 'entrar en flow', 'empezar con energía'],
      experiment: {
        title: 'El termómetro de activación',
        steps: [
          'Al empezar, puntúa tu energía de 0 a 10.',
          'Mientras el tono sube, imagina que llenas un depósito desde los pies hasta la cabeza.',
          'En los últimos 2 minutos, elige la primera acción concreta que harás al terminar.',
          'Al cerrar, vuelve a puntuar tu energía y compara.'
        ]
      },
      caution: 'Si aparecen nerviosismo o palpitaciones, detén la sesión. No uses este protocolo para dormir.'
    }
  ];

  /* Palabras clave para el motor de intención (sin acentos: se normalizan). */
  var KEYWORDS = {
    calma: ['ansiedad', 'ansioso', 'ansiosa', 'estres', 'estresado', 'estresada', 'relajar', 'relajarme',
      'relajacion', 'relax', 'calma', 'calmarme', 'calmado', 'tranquil', 'tranquilidad', 'nervios',
      'nervioso', 'panico', 'respirar', 'respiracion', 'serenidad', 'sereno', 'paz', 'agobio',
      'agobiado', 'tension', 'soltar', 'desconectar', 'despejar', 'aflojar'],
    foco: ['concentrar', 'concentracion', 'concentrarme', 'concentrado', 'enfocar', 'enfoque', 'foco',
      'atencion', 'estudiar', 'estudio', 'leer', 'trabajar', 'trabajo', 'productividad', 'distraigo',
      'distraccion', 'dispersion', 'tarea', 'examen', 'alerta', 'vigilia'],
    meditacion: ['meditar', 'meditacion', 'mindfulness', 'observar', 'pensamientos', 'presencia',
      'consciencia', 'conciencia', 'espiritual', 'soltar el control', 'vipassana', 'zen'],
    creatividad: ['creatividad', 'creativo', 'creativa', 'ideas', 'idea', 'imaginar', 'imaginacion',
      'inspiracion', 'desbloquear', 'bloqueo', 'artistico', 'escribir', 'diseñar', 'disenar',
      'brainstorming', 'lluvia de ideas', 'pintar', 'pintura', 'dibujar', 'dibujo', 'cuadro',
      'abstracto', 'musica', 'componer', 'original', 'proyecto creativo', 'guion', 'historia'],
    sueno: ['dormir', 'sueno', 'suenos', 'insomnio', 'descansar', 'descanso', 'siesta', 'duerme',
      'conciliar', 'noche', 'acostarme', 'descanso nocturno'],
    memoria: ['memoria', 'memorizar', 'recordar', 'recuerdo', 'retencion', 'retener', 'aprender',
      'estudiar de memoria', 'cognicion', 'concentracion mental'],
    flow: ['activar', 'activarme', 'energia', 'flow', 'fluir', 'impulso', 'motivacion', 'despertar',
      'empezar', 'arrancar', 'adrenalina', 'rendimiento']
  };

  B.PROTOCOLS.forEach(function (p) {
    p.keywords = KEYWORDS[p.id] || [];
  });

  B.PROTOCOL_BY_ID = B.PROTOCOLS.reduce(function (acc, p) { acc[p.id] = p; return acc; }, {});

  /* -----------------------------------------------------------------------
     Utilidades
     ----------------------------------------------------------------------- */
  B.normalize = function (text) {
    return String(text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9ñ\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  B.bandFor = function (beat) {
    beat = Number(beat) || 0;
    if (beat < 0.5) return B.CONTROL_BAND;
    for (var i = 0; i < B.BANDS.length; i++) {
      var b = B.BANDS[i];
      if (beat >= b.min && beat < b.max) return b;
    }
    return B.BANDS[B.BANDS.length - 1];
  };

  /* Motor de intención: puntuación por palabras clave.
     Devuelve el protocolo más afinado + la lista de palabras que coincidieron. */
  B.matchProtocol = function (text) {
    var t = B.normalize(text);
    if (!t) return null;

    var best = null;
    var bestScore = 0;
    var bestHits = [];

    B.PROTOCOLS.forEach(function (p) {
      var score = 0;
      var hits = [];

      p.keywords.forEach(function (k) {
        var key = B.normalize(k);
        if (!key) return;
        if (t.indexOf(key) !== -1) {
          // Las palabras más largas son más específicas y pesan más.
          score += Math.min(6, key.length) + 1;
          hits.push(k);
        }
      });

      // Coincidencia con el nombre del protocolo o la banda.
      if (t.indexOf(B.normalize(p.name)) !== -1) score += 4;

      if (score > bestScore) {
        bestScore = score;
        best = p;
        bestHits = hits;
      }
    });

    if (!best) return null;
    return { protocol: best, score: bestScore, hits: bestHits };
  };

  /* ---------------------------------------------------------------
     Atajos de intención (chips de la interfaz)
     --------------------------------------------------------------- */
  B.INTENTS = [
    { label: 'Bajar la ansiedad', text: 'Quiero bajar mi ansiedad y sentir el cuerpo más tranquilo.' },
    { label: 'Concentrarme', text: 'Necesito concentrarme en una tarea y dejar de distraerme.' },
    { label: 'Meditar', text: 'Quiero meditar y observar mis pensamientos sin perseguirlos.' },
    { label: 'Ideas nuevas', text: 'Busco ideas nuevas y desbloquear mi creatividad.' },
    { label: 'Dormir', text: 'Quiero relajarme para dormir y soltar el día.' },
    { label: 'Memoria', text: 'Quiero entrenar mi memoria de trabajo y retener información.' },
    { label: 'Activarme', text: 'Quiero activarme y entrar en flow para empezar a trabajar.' }
  ];

  /* -----------------------------------------------------------------------
     Presets del laboratorio. No son "protocolos validados": son puntos de
     partida reproducibles para comparar condiciones.
     ----------------------------------------------------------------------- */
  B.LAB_PRESETS = [
    {
      id: 'calma', name: 'Alpha 10 Hz', hint: 'Relajación despierta. Portadora baja y batido claro.',
      opts: { carrier: 200, beat: 10, sweep: false, independent: false, wave: 'sine',
        noiseType: 'pink', noiseLevel: 5, amEnabled: false, amRate: 4, amDepth: 50,
        durationSec: 480, fadeIn: 10, fadeOut: 12 }
    },
    {
      id: 'theta', name: 'Theta 6 Hz', hint: 'Atención relajada e imaginería. Menos vigilancia.',
      opts: { carrier: 210, beat: 6, sweep: false, independent: false, wave: 'sine',
        noiseType: 'pink', noiseLevel: 6, amEnabled: false, amRate: 4, amDepth: 50,
        durationSec: 480, fadeIn: 12, fadeOut: 15 }
    },
    {
      id: 'beta', name: 'Beta 16 Hz', hint: 'Vigilia y tarea sostenida. No usar justo antes de dormir.',
      opts: { carrier: 250, beat: 16, sweep: false, independent: false, wave: 'sine',
        noiseType: 'pink', noiseLevel: 4, amEnabled: false, amRate: 4, amDepth: 50,
        durationSec: 600, fadeIn: 8, fadeOut: 10 }
    },
    {
      id: 'gamma', name: 'Gamma 40 Hz', hint: 'Alta frecuencia. Volumen bajo y sesiones cortas.',
      opts: { carrier: 340, beat: 40, sweep: false, independent: false, wave: 'sine',
        noiseType: 'pink', noiseLevel: 4, amEnabled: false, amRate: 4, amDepth: 50,
        durationSec: 540, fadeIn: 8, fadeOut: 10 }
    },
    {
      id: 'delta', name: 'Delta 2.5 Hz', hint: 'Descanso profundo. Solo acostado y con luz baja.',
      opts: { carrier: 150, beat: 2.5, sweep: false, independent: false, wave: 'sine',
        noiseType: 'brown', noiseLevel: 8, amEnabled: false, amRate: 4, amDepth: 50,
        durationSec: 600, fadeIn: 15, fadeOut: 20 }
    },
    {
      id: 'barrido', name: 'Barrido 6 → 10 Hz', hint: 'Theta a alpha: de la imaginación a la calma alerta.',
      opts: { carrier: 200, beat: 6, beatEnd: 10, carrierEnd: 200, sweep: true,
        independent: false, wave: 'sine', noiseType: 'pink', noiseLevel: 5,
        amEnabled: false, amRate: 4, amDepth: 50, durationSec: 600, fadeIn: 12, fadeOut: 15 }
    },
    {
      id: 'control', name: 'Control sin batido', hint: 'Misma frecuencia en ambos oídos. Condición de comparación.',
      opts: { carrier: 200, beat: 0, sweep: false, independent: false, wave: 'sine',
        noiseType: 'pink', noiseLevel: 5, amEnabled: false, amRate: 4, amDepth: 50,
        durationSec: 480, fadeIn: 10, fadeOut: 12 }
    },
    {
      id: 'isocronico', name: 'Pulso isocrónico 10 Hz', hint: 'Sin batido: una portadora única pulsada 10 veces por segundo.',
      opts: { carrier: 200, beat: 0, sweep: false, independent: false, wave: 'sine',
        noiseType: 'off', noiseLevel: 0, amEnabled: true, amRate: 10, amDepth: 75,
        durationSec: 480, fadeIn: 8, fadeOut: 10 }
    },
    {
      id: 'sintergica', name: 'Exploración theta (Grinberg)', hint: 'Theta 6 Hz con ruido marrón. Inspirada en la Teoría Sintérgica, sin validación.',
      opts: { carrier: 200, beat: 6, sweep: false, independent: false, wave: 'sine',
        noiseType: 'brown', noiseLevel: 8, amEnabled: false, amRate: 4, amDepth: 50,
        durationSec: 600, fadeIn: 15, fadeOut: 20 }
    }
  ];

  B.LAB_PRESET_BY_ID = B.LAB_PRESETS.reduce(function (acc, p) {
    acc[p.id] = p;
    return acc;
  }, {});

  /* -----------------------------------------------------------------------
     Medidas simples para el modo estudio (0–10, autoinforme).
     ----------------------------------------------------------------------- */
  B.STUDY_MEASURES = [
    { id: 'relax', label: 'Relajación', hint: 'Tensión corporal y mental' },
    { id: 'focus', label: 'Foco', hint: 'Claridad y atención sostenida' },
    { id: 'vivid', label: 'Viveza imaginal', hint: 'Intensidad de imágenes o sensaciones' },
    { id: 'absorb', label: 'Absorción', hint: 'Grado de inmersión en la experiencia' }
  ];

  /* -----------------------------------------------------------------------
     Marco teórico. Se presenta como inspiración histórica, NO como evidencia.
     ----------------------------------------------------------------------- */
  B.THEORY = {
    title: 'Marco teórico: la Teoría Sintérgica',
    intro: 'Jacobo Grinberg-Zylberbaum (1946–1994), neurofisiólogo mexicano, propuso que la experiencia consciente surge de la interacción entre el campo neuronal y una estructura energética del espacio que llamó «retícula» o lattice.',
    paragraphs: [
      'En su modelo, el cerebro no produce la conciencia por sí solo: la percibe al entrar en resonancia con esa estructura. La meditación, la atención sostenida y ciertos estados alterados serían formas de reducir el ruido del yo consciente para que esa interacción se hiciera más evidente.',
      'Grinberg también reportó experimentos de «potenciación» y «transferencia de información» entre cerebros aislados, y acuñó la idea de un «campo neuronal» compartido. Son ideas sugerentes, pero no forman parte del consenso neurocientífico actual.',
      'En este laboratorio las usamos como marco metafórico y como invitación a la autoobservación, no como explicación demostrada. El sitio no afirma que el sonido «active el subconsciente» ni que aumente capacidades: registra tu experiencia y te deja comparar condiciones.'
    ],
    caveat: 'Advertencia epistémica: los resultados de Grinberg sobre transferencia de potencial no se han replicado de forma independiente y robusta. La Teoría Sintérgica es una hipótesis histórica, no una teoría aceptada. Trátala como inspiración para formular preguntas, no como evidencia de un mecanismo. «Subconsciente» se usa aquí en sentido coloquial, no como una entidad medible.',
    principles: [
      'Atención relajada: observar sin forzar.',
      'Comparar condiciones: con batido, sin batido y con pulso isocrónico.',
      'Registrar también los resultados nulos.',
      'No inducir estados en otras personas sin su consentimiento.'
    ],
    refs: ['grinberg1987', 'grinberg1994']
  };

})(window.BEATLAB);

# Onda Mental

**Sitio publicado:** <https://cesarde2007-hub.github.io/onda-mental/>

Laboratorio web de **sonidos binaurales para experimentos mentales**. Describe qué quieres
explorar, el sitio propone un protocolo con referencias publicadas o te deja construir la onda
desde cero, la reproduce durante **10 minutos o menos** y guarda tu experiencia en una bitácora
local.

También incluye un **modo estudio** para registrar varias personas con consentimiento, medidas
antes/después y exportación en CSV, y un marco teórico inspirado en la **Teoría Sintérgica** de
Jacobo Grinberg, presentado con sus límites y sin afirmaciones médicas.

- 100 % gratis: sin cuentas, sin pagos, sin anuncios, sin servidores.
- 100 % privado: la bitácora vive en `localStorage`, en tu navegador.
- 100 % estático: HTML + CSS + JavaScript. Cero dependencias y cero build.
- Funciona offline una vez cargado (service worker) y se puede instalar como app.

> **Aviso:** no es un dispositivo médico ni sustituye atención psicológica. La evidencia sobre
> beneficios de los batidos binaurales es modesta y heterogénea. Úsalo como experimento personal,
> con volumen bajo, y nunca mientras conduces. No induzcas estados en otras personas sin su
> consentimiento explícito.

---

## Empezar

**Opción 1 — sin servidor**

Abre `index.html` con doble clic. Funciona en Chrome, Edge, Firefox y Safari modernos.
El audio necesita un clic para arrancar (política de autoplay de los navegadores).

**Opción 2 — servidor local**

```bash
python -m http.server 8765
# luego abre http://localhost:8765
```

Con `localhost` o HTTPS se activa además el service worker (modo offline).

---

## Publicar gratis

El sitio es completamente estático: no hay comando de build ni variables de entorno. Publica la
raíz del proyecto tal cual.

### GitHub Pages

```bash
git init
git add .
git commit -m "Onda Mental"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/onda-mental.git
git push -u origin main
```

En el repositorio: **Settings → Pages → Source: Deploy from a branch → main / (root)**.
Quedará en `https://TU-USUARIO.github.io/onda-mental/`.

### Netlify / Cloudflare Pages / Vercel

Arrastra la carpeta completa a [app.netlify.com/drop](https://app.netlify.com/drop), o conecta el
repositorio en Cloudflare Pages o Vercel. Directorio de publicación: la raíz. Sin build.

La carpeta `_deploy/` contiene una copia limpia solo con los archivos públicos, por si prefieres
subir esa carpeta.

---

## Cómo se usa

1. **Intención.** Escribe qué buscas («bajar la ansiedad antes de una entrevista», «concentrarme
   para estudiar») o elige una sugerencia. El recomendador puntúa palabras clave y propone un
   protocolo; también puedes partir de la biblioteca.
2. **Ajustes rápidos.** Cambia el batido, la portadora, la duración y el volumen del protocolo
   elegido. Los ajustes manuales se marcan como exploración: la evidencia citada corresponde al
   protocolo original.
3. **Laboratorio de ondas.** Controla cada oído por separado (80–600 Hz), el batido (0–40 Hz), el
   barrido, la forma de onda (seno, triángulo, cuadrada, sierra), el balance, el pulso de amplitud,
   el ruido (rosa, marrón, blanco) y los fundidos. Guarda, exporta e importa ajustes en JSON.
4. **Sesión.** Auriculares estéreo, volumen bajo, una sola intención. La interfaz guía la
   respiración y muestra la banda, el tiempo restante y las frecuencias reales de cada oído.
5. **Observación.** Al terminar, puntúa tu ánimo y describe lo que notaste. La entrada guarda los
   parámetros exactos para que el experimento sea reproducible.
6. **Exportar.** Descarga la bitácora en CSV (Excel/Sheets) o JSON para analizarla.

### Condiciones de comparación

El laboratorio incluye tres condiciones que conviene no mezclar:

| Condición | Qué hace | Para qué sirve |
|---|---|---|
| Batido binaural | Dos frecuencias distintas, una por oído | Condición experimental |
| Control sin batido | La misma frecuencia en ambos oídos | Comparar sin el batido |
| Pulso isocrónico | Una portadora con volumen pulsado | Comparar otro tipo de estimulación |

Si solo pruebas la condición experimental, no puedes saber si el cambio se debe al batido, a la
música, al descanso o a la expectativa.

---

## Laboratorio de ondas

| Parámetro | Rango | Nota |
|---|---|---|
| Portadora / oído izquierdo | 80–600 Hz | Tono base |
| Batido | 0–40 Hz | 0 Hz = condición de control |
| Oído derecho independiente | 80–700 Hz | Permite batidos negativos o mayores |
| Barrido | inicio → final | Interpolación lineal durante la sesión |
| Forma de onda | seno, triángulo, cuadrada, sierra | El seno es el más limpio para batidos |
| Balance | −100 % izquierda a +100 % derecha | Ganancia independiente por oído |
| Pulso de amplitud | 0.5–40 Hz, profundidad 0–100 % | No es un batido; modula el volumen |
| Ruido | rosa, marrón, blanco o ninguno | Nivel 0–30 % |
| Duración | 1–10 min | Límite duro del motor: 600 s |
| Fundidos | 0–30 s cada uno | Nunca ocupan más del 45 % de la sesión |

Presets incluidos: Alpha 10, Theta 6, Beta 16, Gamma 40, Delta 2.5, barrido 6→10, control sin
batido, pulso isocrónico 10 Hz y una exploración theta inspirada en Grinberg. Ninguno es un
protocolo validado: son puntos de partida reproducibles.

Los ajustes guardados y el último estado del modo estudio se almacenan en:

- `ondamental.journal.v1` — bitácora
- `ondamental.study.v1` — modo estudio (sin el consentimiento, que no se persiste)
- `ondamental.lab.presets.v1` — ajustes guardados del laboratorio

---

## Cómo se genera el sonido

El batido binaural no es un tono que «contiene» una frecuencia cerebral: es una ilusión auditiva.
Se emiten **dos tonos, uno por oído**, con una diferencia de frecuencia:

```
oído izquierdo: 200.0 Hz
oído derecho:   210.0 Hz
diferencia:      10.0 Hz  ← lo que se percibe como pulso
```

El motor usa la Web Audio API:

- dos `OscillatorNode` independientes, uno por canal, unidos con un `ChannelMergerNode` (sin mezcla
  entre oídos, por eso hacen falta auriculares);
- ganancia independiente por oído para el balance;
- un `GainNode` de volumen y otro de fundido, separados para que mover el volumen no cancele el
  cierre programado;
- un `DynamicsCompressorNode` como limitador y techo de ganancia (0.5);
- ruido rosa, marrón o blanco generado en el navegador;
- modulación de amplitud con un LFO;
- fundidos de entrada y salida y parada automática a los 10 minutos como máximo.

Referencias fisiológicas: Oster (1973); Licklider, Webster & Hedlun (1950).

---

## Protocolos publicados

| Protocolo | Banda | Batido | Portadora | Duración | Evidencia |
|---|---|---|---|---|---|
| Calma Alpha | Alpha | 10 Hz | 200 Hz | 8 min | Moderada (meta-análisis) |
| Foco Beta 16 | Beta | 16 Hz | 250 Hz | 10 min | Moderada |
| Meditación Theta 6 | Theta | 6 Hz | 210 Hz | 8 min | Preliminar (EEG) |
| Creatividad Alpha | Alpha | 10 Hz | 180 Hz | 8 min | Preliminar |
| Descenso Delta | Delta | 2.5 Hz | 150 Hz | 10 min | Exploratoria |
| Memoria Gamma 40 | Gamma | 40 Hz | 340 Hz | 9 min | Preliminar |
| Transición Alpha → Beta | Alpha→Beta | 10→14 Hz | 220 Hz | 10 min | Exploratoria |

Fuentes principales:

- Oster, G. (1973). *Auditory beats in the brain.* Scientific American, 229(4), 94–102.
- Lane, Kasian, Owens & Marsh (1998). *Binaural auditory beats affect vigilance performance and
  mood.* Physiology & Behavior, 63(2), 249–252.
- Huang & Charyton (2008). *A comprehensive review of the psychological effects of brainwave
  entrainment.* Alternative Therapies in Health and Medicine, 14(5), 38–50.
- Reedijk, Bolders & Hommel (2013). *The impact of binaural beats on creativity.* Frontiers in
  Human Neuroscience, 7, 786.
- Chaieb, Wilpert, Reber & Fell (2015). *Auditory beat stimulation and its effects on cognition and
  mood states.* Frontiers in Psychiatry, 6, 70.
- Beauchene, Abaid, Moran, Diana & Leonessa (2016). *The effect of binaural beats on visuospatial
  working memory and cortical connectivity.* PLoS ONE, 11(11), e0166630.
- Jirakittayakorn & Wongsawat (2017). *Brain responses to a 6-Hz binaural beat.* Frontiers in
  Neuroscience, 11, 365.
- Garcia-Argibay, Santed & Reales (2019). *Efficacy of binaural auditory beats in cognition,
  anxiety, and pain perception: a meta-analysis.* Psychological Research, 83(2), 357–372.
- Ingendoh, Posny & Heine (2023). *Binaural beats to entrain the brain? A systematic review.*
  PLoS ONE, 18(5), e0286023.

Las citas completas están en `assets/protocols.js` (`B.REFS`).

---

## Modo estudio

El modo estudio añade a cada sesión:

- un **código de participante** (nunca un nombre real);
- un **grupo o condición** libre (por ejemplo `alpha`, `control`, `sesión 1`);
- **consentimiento informado** explícito, que no se guarda entre recargas;
- cuatro medidas de autoinforme 0–10 antes y después: relajación, foco, viveza imaginal y absorción;
- los parámetros exactos del audio y el histórico de la sesión.

El CSV exportado incluye 40 columnas: identificadores, fecha, modo, protocolo, banda, batido,
portadora, frecuencias por oído, forma de onda, balance, barrido, ruido, pulso, fundidos, duración,
ánimo antes/después, notas, código, grupo, consentimiento y las ocho medidas pre/post.

### Cómo convertir esto en una investigación mínimamente honesta

1. **Pregunta concreta y medible.** «¿El batido de 10 Hz cambia mi relajación frente a una
   condición sin batido?», no «¿me activa el subconsciente?».
2. **Compara condiciones.** Usa al menos la onda experimental y un control sin batido. Alterna el
   orden entre sesiones para reducir el efecto de la expectativa.
3. **Repite.** Una sesión no demuestra nada. Haz varias por condición, en días distintos y a la
   misma hora si puedes. Anota sueño, cafeína y estrés.
4. **Mide y registra.** Usa las medidas 0–10 antes y después. Guarda también los resultados nulos y
   las sesiones interrumpidas.
5. **Interpreta con humildad.** Con pocas personas y autoinforme no puedes demostrar causalidad ni
   generalizar. Habla de «lo que observé», no de «lo que prueba».
6. **Cuida a las personas.** Consentimiento informado, posibilidad de retirarse, sin nombres reales,
   sin presión y sin promesas terapéuticas. No uses a menores ni a personas en crisis sin
   supervisión profesional.

El modo estudio no convierte esto en un ensayo clínico. Es una herramienta de exploración y
autoobservación, no un dispositivo médico.

---

## Marco teórico: Grinberg

Jacobo Grinberg-Zylberbaum (1946–1994), neurofisiólogo mexicano, propuso la **Teoría Sintérgica**:
la experiencia consciente surgiría de la interacción entre el campo neuronal y una estructura
energética del espacio que llamó «retícula» o *lattice*. La meditación y la atención sostenida
reducirían el ruido del yo consciente para hacer más evidente esa interacción.

En este laboratorio la teoría se usa como **marco metafórico y como invitación a la
autoobservación**, no como explicación demostrada. El sitio no afirma que el sonido «active el
subconsciente» ni que aumente capacidades: registra tu experiencia y te deja comparar condiciones.

> **Advertencia epistémica:** los resultados de Grinberg sobre «transferencia de potencial» no se
> han replicado de forma independiente y robusta. La Teoría Sintérgica es una hipótesis histórica,
> no una teoría aceptada por la neurociencia actual. «Subconsciente» se usa aquí en sentido
> coloquial, no como una entidad medible.

Referencias:

- Grinberg-Zylberbaum, J. (1987). *La teoría sintérgica.* México: INPEC.
- Grinberg-Zylberbaum, J., Delaflor, M., Attie, L., & Goswami, A. (1994). The
  Einstein-Podolsky-Rosen paradox in the brain: The transferred potential. *Physics Essays, 7*(4),
  422–428.

---

## Añadir un protocolo

Edita `assets/protocols.js` y añade un objeto a `B.PROTOCOLS`:

```js
{
  id: 'mi-protocolo',
  name: 'Mi protocolo',
  tagline: 'Una frase que describa la experiencia.',
  band: 'theta',            // delta | theta | alpha | beta | gamma
  beat: 7.5,                // Hz del batido
  beatEnd: 9,               // opcional: transición a lo largo de la sesión
  carrier: 220,             // Hz del tono portador
  durationSec: 420,         // 420 = 7 min (máximo 600)
  noise: 0.05,              // colchón de ruido rosa (0–0.2)
  color: '#5eead4',
  evidence: {
    level: 2,               // 3 moderada · 2 preliminar · 1 exploratoria
    title: 'Evidencia preliminar',
    summary: 'Qué encontró el estudio, con sus límites.',
    refs: ['chaieb2015']    // claves de B.REFS
  },
  rationale: 'Por qué esta frecuencia y esta portadora.',
  goals: ['relajarme'],     // se usa para el botón de la biblioteca
  experiment: {
    title: 'Nombre del experimento mental',
    steps: ['Paso 1…', 'Paso 2…']
  },
  caution: 'Advertencia específica.'
}
```

Después añade sus palabras clave en `KEYWORDS` (al final del archivo, antes de
`B.PROTOCOL_BY_ID`). No hace falta tocar el HTML: las tarjetas se generan solas.

Para añadir un preset del laboratorio, edita `B.LAB_PRESETS`; para una medida de estudio, edita
`B.STUDY_MEASURES`.

---

## Privacidad

- No hay backend, analítica ni cookies.
- La intención, el ánimo y las notas se guardan solo en `localStorage`.
- «Borrar todo» elimina la bitácora de este navegador; los CSV/JSON exportados quedan en tu equipo.
- El service worker cachea los archivos del sitio para uso offline. No envía datos a ningún sitio.
- Si publicas el sitio, el hosting verá las peticiones HTTP normales (IP, user-agent), como cualquier
  web estática. No hay datos de sesión en el servidor.

---

## Seguridad

- Usa auriculares estéreo y volumen bajo. El sitio limita la ganancia, pero el volumen del sistema
  también cuenta.
- No conduzcas ni operes maquinaria durante la sesión.
- Consulta antes si tienes epilepsia, tinnitus, vértigo, un marcapasos, antecedentes de crisis
  disociativas o un trastorno psiquiátrico.
- Detén la sesión ante mareo, presión en los oídos, dolor de cabeza, palpitaciones o irritabilidad.
- El protocolo «Descenso Delta» solo debe usarse acostado y no si necesitas permanecer alerta.
- No induzcas estados en otra persona sin su consentimiento explícito. El laboratorio es para
  autoobservación, no para controlar a nadie.
- El pulso de amplitud y los barridos pueden resultar más intensos: empieza con profundidad baja y
  sesiones cortas.

---

## Estructura

```
index.html              Estructura y contenido
assets/styles.css       Diseño y responsive
assets/protocols.js     Bandas, protocolos, referencias, presets y modo estudio
assets/audio.js         Motor binaural (Web Audio API)
assets/app.js           Interfaz, sesión, laboratorio, estudio y exportación
manifest.webmanifest    Metadatos de instalación
sw.js                   Caché offline
assets/icon.svg         Icono
```

Sin frameworks, sin `npm install`, sin paso de compilación.

---

## Licencia

MIT. Puedes usarlo, modificarlo y publicarlo gratis, manteniendo el aviso de copyright.

# Legado de las Anclas

Action-RPG 2D cenital al estilo de los de la GBA, con mundo, personajes e historia propios.
El continente de Aurel se mantiene estable gracias a las _anclas_, cristales antiguos enterrados
bajo cada región. La Atalaya es un gremio de guardianes que saben volar, con base en una torre
sobre la costa. Y alguien está arrancando las anclas: las tierras empiezan a temblar y a hundirse.

**Juégalo en el navegador:** https://krojasalfaro7.github.io/legado-de-las-anclas/

El juego completo: cuatro personajes jugables, tres arcos y nueve capítulos, barreras por
personaje, misiones secundarias, transformaciones, un final y un post-juego.

Proyecto personal sin fines de lucro. Todo el contenido (arte, sonido, personajes e historia) es
original; no se usa material de otros juegos, animes ni mangas.

## Requisitos

- Node 22+ y npm.

## Uso

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + build en dist/
npm run preview    # sirve dist/
npm run test       # Vitest (lógica pura)
npm run lint       # Biome (lint + formato)
npm run format     # Biome con autofix
npm run assets     # regenera tileset y mapas desde scripts/
```

### Parámetros de URL (desarrollo)

| Parámetro               | Efecto                                                                                    |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| `?debug=1`              | Arranca con el overlay de debug activo (también se alterna con **F1**).                   |
| `?zone=<id>&spawn=<id>` | Salta el título y empieza una partida nueva en esa zona. Ej.: `?zone=field&spawn=flight`. |

En builds de desarrollo, `window.__game` y `window.__session` están disponibles en la consola.

## Controles

Se cambian en `src/config/controls.ts` (códigos `KeyboardEvent.code` y botones del mapping
estándar de gamepad).

| Acción              | Teclado                              | Gamepad            |
| ------------------- | ------------------------------------ | ------------------ |
| Moverse             | Flechas                              | Stick izq. / D-pad |
| Correr              | Flecha 2 veces                       | D-pad 2 veces      |
| Golpe (combo de 4)  | D                                    | A                  |
| Usar especial       | S                                    | B                  |
| Bloquear (mantener) | A                                    | RB                 |
| Elegir especial     | Q                                    | LB                 |
| Volar / aterrizar   | Shift                                | X                  |
| Cambiar personaje   | R                                    | RT                 |
| Interactuar         | E (o D frente a un NPC/cofre/puerta) | A                  |
| Lente (analizar)    | Tab                                  | Back / Select      |
| Pausa / menú        | Esc / Enter                          | Start              |
| Pantalla completa   | F                                    | -                  |
| Debug               | F1                                   | —                  |

Las acciones están todas bajo la mano izquierda (alrededor de A/S/D) para mover con las flechas.
En los menús: flechas para moverse, D/E/Espacio para aceptar, S/Esc para salir y Q/A (LB/RB)
para cambiar de pestaña. La pestaña **Misiones** de la pausa dice qué hacer ahora: muestra los
pasos cumplidos y el actual de cada misión (historia y secundarias), sin adelantar los siguientes.
Las misiones son datos en `src/data/objectives.ts` (cada paso con su condición de cumplido).

### En el móvil

En teléfonos y tablets aparecen controles en pantalla (`src/services/touchControls.ts`), y se
juega en horizontal (si el teléfono está en vertical, pide girarlo):

- **Pulgar izquierdo**: un joystick aparece donde apoyas el dedo, en la mitad izquierda.
- **Pulgar derecho**: Golpe, Especial (mantén para cargar), Guardia, Cargar (Guardia + Especial)
  y Volar.
- **Barra superior**: Elegir especial, Cambiar de personaje, Usar, Lente, Pausa y Pantalla
  completa (en iPhone, "Añadir a pantalla de inicio" lo abre a pantalla completa).
- Tocar la pantalla avanza los diálogos. Durante diálogos y menús los botones se atenúan.

Cada botón mantiene pulsada su tecla, así que todo funciona igual que con el teclado.

## Selector de especiales

Arriba a la izquierda, bajo el retrato, están las técnicas de ki y la transformación del
personaje. **Q** (LB) elige y **S** (B) ejecuta lo seleccionado: lanza la técnica o activa y
desactiva la transformación. Las casillas que no puedes pagar con tu ki se ven apagadas.

## Vuelo

Al aire libre, **Shift** (X en el mando) despega. Volando vas un 60% más rápido y pasas por encima de
agua, arbustos, rocas, cajas y chatarra; solo te frenan los tiles altos (`blocksFlight`: muros de
roca, árboles, paredes). En el aire solo puedes lanzar ki (sin golpes ni bloqueo), el ki no se
recupera y no puedes abrir cofres, hablar ni usar círculos: aterriza primero. No puedes aterrizar
sobre un tile sólido. Dentro de la Atalaya no se vuela.

## Mapa del continente

Los **círculos de corriente** abren el mapa del continente en perspectiva: la cámara vuela
detrás del personaje mirando al norte, con relieve, niebla a lo lejos y nubes que pasan bajo
tus pies. Las flechas mueven al norte, sur, oeste y este; arriba a la derecha hay un minimapa
con un altímetro al lado. Mantén **D** (A) para subir: el suelo se aleja y vas más rápido.
Mantén **S** (B) para bajar: si llegas al suelo dentro de un anillo marcado, aterrizas ahí;
fuera de un anillo te quedas planeando bajo. Al despegar subes solo a la altura de crucero. El terreno se
genera por código (`src/systems/terrain.ts`, determinista por semilla); las zonas de aterrizaje
se definen en `src/data/worldMap.ts` (posición, radio, estilo y la zona donde aterrizas). Un
punto sin `zone` es un adelanto bloqueado. La zona debe tener `flightSpawn`, y su `unlockFlag`
decide si ya puedes aterrizar.

## Recorrido de la demo

1. **Nueva partida**: habla con la **Capitana Iolé** en la Atalaya (te da la misión).
2. Usa el **círculo de corriente** del muelle y vuela por el mapa hasta el **Valle Bruma**.
3. Sube a **nivel 5** y rompe la **puerta turquesa** del noroeste (requiere Tavi Nv 5).
4. Consigue los **3 coleccionables**: en el cofre de la arboleda (tras la puerta), en el cofre
   que aparece al limpiar el campamento de saqueadores, y en un rincón escondido del sureste.
5. Entrégaselos a **Pim** (archivo de reliquias) para aprender **Rayo Faro**.
6. Vence a **Grell** junto al ancla del norte. Al 50% de HP pasa a la fase 2.
7. Guarda en un **círculo de guardado**, recarga la página y elige **Continuar**.

## Estructura

```
src/
  main.ts            configuración de Phaser y registro de escenas
  config/            constantes, controles, balance (fórmulas documentadas en balance.ts)
  data/              contenido: personajes, enemigos, objetos, técnicas, zonas, NPCs, diálogos
  entities/          objetos de Phaser: Player, Enemy, Projectile, interactables (cofres, puertas...)
  systems/           lógica pura sin Phaser (testeada): combate, stats, niveles, inventario,
                     guardado/migraciones, IA, reglas de NPC, party
  services/          singletons del navegador: input, sesión, guardado (localStorage), audio, opciones
  scenes/            Boot, Preload, Title, World, UI (HUD), Pause (+ pestañas), Dialogue, Lens, GameOver
  ui/                fuente pixel, sprites procedurales, barras y menús
  i18n/es.ts         TODOS los textos del juego
scripts/             generadores de assets (tileset PNG/TSJ y mapas .tmj)
public/assets/       mapas, tileset y carpeta de audio (opcional)
tests/               Vitest
```

## Cómo añadir contenido

### Un enemigo

1. Añade una entrada en `src/data/enemies.ts` (`level`, `hp`, `atk`, `def`, `speed`, `exp`,
   `look` y `ai`). `ai.kind` puede ser `melee` (persigue y golpea), `ranged` (mantiene
   `preferredDistance` y dispara `projectile`) o `tank` (carga y embiste con `chargeSpeed`).
2. Para un jefe, añade `phases`: cada fase se activa cuando el HP baja de `hpBelow` y define
   `speedMult`, `cooldownMult`, `patterns` (`melee`, `tripleShot`, `radialBurst`, `dash`) y un
   `dialogueId` opcional.
3. Añade `nameKey`/`descKey` en `src/i18n/es.ts` (los muestra la lente).
4. Colócalo en un mapa con un objeto `enemy` (ver abajo). No hace falta tocar la lógica.

### Un objeto

Entrada en `src/data/items.ts`: `kind: 'consumable'` con `heal` (fracción de HP/ki) o
`kind: 'equipment'` con `equip` (`expMult`, `speedMult`, `defBonus`). Para que aparezca, ponlo en
un cofre (`itemId`) o como botín de un enemigo (`drops`).

### Un coleccionable

Entrada en `src/data/collectibles.ts` y sus textos. El NPC del museo lo cuenta automáticamente.
Colócalo en un cofre (`collectibleId`) o en el suelo con un objeto `collectible`.

### Un NPC o un diálogo

- Diálogos: `src/data/dialogue/index.ts` (líneas con `speaker` y `text`, claves de `es.ts`). Los
  textos pueden usar `{delivered}`, `{total}` y `{player}`.
- NPCs: `src/data/npcs.ts`. `rules` se evalúan en orden y gana la primera cuya condición se cumple
  (`flag`, `notFlag`, `bossDefeated`, `undeliveredCollectibles`, `allDelivered`). Los efectos
  (`setFlag`, `deliverCollectibles`, `learnTechnique`, `giveItem`) se aplican al hablar.
  `chain: true` vuelve a evaluar al terminar (entregar y luego recompensar).

### Una zona

1. Crea `scripts/maps/<id>.ts` con un `MapSpec` (filas ASCII + objetos en coordenadas de tile;
   puedes usar `AsciiCanvas` de `scripts/maps/paint.ts`) y regístralo en `scripts/maps/index.ts`.
   Alternativa: dibuja el `.tmj` directamente en Tiled con el tileset `placeholder.tsj`
   **embebido** (Phaser no carga tilesets externos).
2. `npm run assets` genera `public/assets/maps/<id>.tmj`.
3. Añade la zona en `src/data/zones.ts` (`mapKey`, `nameKey`, `flightSpawn` si se puede volar
   hasta ella, `unlockFlag` opcional, `music` opcional).

Leyenda ASCII (`scripts/maps/types.ts`): `.` pasto, `,` flores, `:` tierra, `s` arena, `#` muro
de roca, `T` árbol, `~` agua, `b` arbusto, `_` suelo de madera, `=` suelo de piedra, `W` muro de
piedra, `C` estantería, `O` ventana, `x` ceniza, `a` prado, `*` cristales, `r` alfombra, `o` roca
grande, espacio = mar, `h` muelle, `B` puente, `w` chatarra, `"` pasto alto, `c` caja,
`^` acantilado, `A` cristal de ancla.

Los tiles con forma (árboles, rocas, cajas...) son transparentes alrededor; el compilador pone
debajo el suelo más común de los tiles vecinos.

## Mapas de Tiled: capas y propiedades

Cada mapa necesita estas capas:

| Capa        | Tipo    | Uso                                                                                                                 |
| ----------- | ------- | ------------------------------------------------------------------------------------------------------------------- |
| `Ground`    | tiles   | Suelo, solo visual.                                                                                                 |
| `Collision` | tiles   | Tiles con `collides: true` bloquean a pie; con `blocksFlight: true` también en vuelo; `low: true` deja pasar el ki. |
| `Objects`   | objetos | Todo lo interactivo (tabla siguiente).                                                                              |

El campo `type` (o _class_ en Tiled ≥ 1.9) de cada objeto define qué es. El `name` del objeto
forma su id persistente (`<zona>:<name>`). Si lo cambias, se pierde su estado guardado.

| `type`         | Forma      | Propiedades                                                                                       |
| -------------- | ---------- | ------------------------------------------------------------------------------------------------- |
| `playerSpawn`  | punto      | El `name` es el id del spawn (`start`, `flight`...).                                              |
| `enemy`        | punto      | `enemyId` (string), `group` (string, opcional).                                                   |
| `npc`          | punto      | `npcId`, `facing` (`down`/`up`/`left`/`right`).                                                   |
| `chest`        | punto      | `itemId` **o** `collectibleId`; `hiddenUntilGroupCleared` (id de `group`) para cofres invisibles. |
| `collectible`  | punto      | `collectibleId` (se recoge al tocarlo).                                                           |
| `gate`         | rectángulo | `requiredCharacter` (id de personaje), `requiredLevel` (int).                                     |
| `saveCircle`   | punto      | —                                                                                                 |
| `flightCircle` | punto      | — (los destinos salen de `zones.ts`).                                                             |
| `transition`   | rectángulo | `targetZone`, `targetSpawn` (al pisarlo cambia de zona).                                          |

Propiedades del mapa: `nameKey` (informativa; el nombre mostrado sale de `zones.ts`).

## Guardado

`localStorage` (`anclas.save`), con `version` y migraciones en `src/systems/saveMigrations.ts`. Si
cambias `GameState`, sube `SAVE_VERSION` y añade una migración `n → n+1` en `MIGRATIONS`. Una
partida corrupta o incompatible no rompe el juego: el título simplemente oculta "Continuar".
Las opciones (volumen, mostrar controles) se guardan aparte (`anclas.options`).

Las partidas anteriores a la versión 2 (el prototipo) ya no se pueden cargar.

## Arte

Todo el arte se genera por código con el mismo acabado: contorno de color, luz desde arriba a la
izquierda y paleta de 15 bits (`finishGrid` en `src/ui/humanoid.ts`, `scripts/gen-tileset.ts`).
Los personajes tienen 14 poses por dirección (reposo x2, caminar x4, combo de 3 golpes, ki,
bloqueo, daño y vuelo x2) y rasgos opcionales en su `look`: `scarf`, `wing`, `glow`, `bigEyes`.

Para usar hojas dibujadas a mano, sigue `docs/SPRITES.md`: plantillas con
`npm run sprites:templates`, hojas en `public/assets/sprites/<clave>.png` y validación con
`npm run sprites:check`. Una hoja que falta o no es válida se sustituye por la generada.

## Audio

El juego suena con un sintetizador WebAudio de respaldo. Para usar archivos propios, ponlos en
`public/assets/audio/` y regístralos en `src/data/audio.ts` (efectos por id y música por zona).

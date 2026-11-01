# Plan para terminar el juego (arcos 2 y 3, final y post-juego)

Escrito el 2026-10-31, cuando el usuario pidió terminar el juego con autonomía total. Cada fase
es un commit con lint/tsc/tests/build en verde y una prueba E2E. Las decisiones quedan en
CLAUDE.md; lo que el usuario debería mirar va a `docs/REVIEW.md`.

## Infraestructura (fase 18)

- **Iolé** y **Nilo** jugables (`CharacterDef`):
  - Iolé: vuela, pelea con ráfagas del ala (alcance largo, empuje fuerte) y usa técnicas de
    viento.
  - Nilo: no vuela (está en formación), es rápido y lanza dardos y bolas de humo.
- **Ausencias**: `CharacterDef.absent` (`{ from, until }`). Mientras está ausente, el personaje
  no se puede jugar (Tavi desaparece en el arco 2).
- **Pasos nuevos de escena**:
  - `play` (cambia el personaje activo).
  - `flag` con `value: false` (borra una bandera).
  - `heal` (recupera al grupo).
  - `credits` (lanza los créditos).
- **Barreras nuevas**:
  - `vent`: respiradero de viento. Lo abre Iolé con su ráfaga.
  - `crawl`: grieta baja. Nilo se cuela y abre el paso por el otro lado.
- **Objetos de zona**: NPCs y enemigos con `requiresFlag` / `hiddenFlag`.
- **Bajas por tipo de enemigo** (`state.kills`): permiten misiones de caza (el tablón de
  encargos).
- **Música**: no hay pistas. Se anota en REVIEW.

## Arco 2: "Tierras que se Hunden"

**Cap. 4, Marismas de Sal** (zona `marsh`, landmark ya revelado)
- Personajes: Tavi y Okun.
- El poblado salinero de Salinar se hunde.
- Misión: rescatar a 3 salineros perdidos. Cada uno se escolta hablándole.
- Los gólems injertados de Vesk extraen la luz del ancla de la marisma.
- Jefe: **Coloso de Salmuera** (gólem grande injertado, 3 fases).
- Vesk aparece, se presenta y huye a La Grieta.
- Barreras plantadas: un respiradero (Iolé) y una grieta baja (Nilo), con recompensas.

**Cap. 5, La Grieta** (zona `rift`)
- Un cañón que baja en terrazas con el convoy de la Mano Gris.
- Grell vuelve como **Grell, Arpón de Cristal** (revancha).
- Al fondo, Vesk injerta luz en la veta.
- Jefe: **Vesk** (alquimista: frascos, gólems pequeños, escudo de cristal).
- Al caer Vesk, la tierra se abre y algo del Fondo arrastra a Tavi.
- Banderas: `taviTaken`. Tavi queda ausente.

**Cap. 6, La Atalaya Resiste** (zona `cliffs`, el acantilado bajo la torre)
- Personajes: Iolé (se une) y Okun.
- La Mano Gris asedia la Atalaya: 3 grupos que limpiar y un ariete de cristal.
- Nilo ayuda desde la torre.
- Jefe: **Sarn** sin cristal, que vuelve a buscar a Vesk y termina de mala gana dando la pista
  del Fondo.
- Iolé decide bajar a por Tavi.

**Cap. 7, Bajo la Tierra** (zona `hollow`, la Hondura)
- Personaje: Tavi sola, sin vuelo (techo de roca).
- Raíces luminosas, ecos del Fondo.
- Prueba: **Sombra de Tavi**.
- Tavi gana su segunda forma, **Marea Profunda**.
- Reencuentro con Iolé y Okun, que bajaron a buscarla.
- Fin del arco 2: `arc2Done`.

## Arco 3: "El Fondo"

**Cap. 8, Las Tres Luces** (regreso a zonas conocidas)
- Nilo se une tras salvar a Pim en la Atalaya colapsada (grieta baja).
- Para abrir el sello del Fondo hacen falta 3 luces de ancla:
  - Hondonada de Cobre: tras una grieta de Nilo; guardián **Gólem Ancestral**.
  - Marismas: tras un respiradero de Iolé; guardián **Leviatán de Salmuera**.
  - Valle Bruma: en el ancla rota, prueba de Okun.
- Con las tres, el sello de La Grieta se abre: `fondoOpen`.

**Cap. 9, El Fondo** (zonas `abyss1` → `abyss2`)
- Mazmorra final con todo el grupo.
- Vesk fusionado: **Vesk, Injerto Final**.
- Sarn reaparece y paga su deuda (escena).
- Jefe final: **El Fondo** (corazón enorme con fases y ataque definitivo).

**Epílogo y post-juego**
- Epílogo en la Atalaya ("no hay vuelta atrás") y créditos.
- Se vuelve al mundo con `gameCleared`:
  - superjefe opcional en El Fondo (**Eco del Fondo**),
  - encargos extra,
  - tienda ampliada.

## Misiones secundarias (por zona)

- Tablón de encargos en la Atalaya (cazas por bajas, recompensa en esquirlas y objetos).
- Marismas: faroles de sal (coleccionables) para la anciana del poblado.
- La Grieta: las herramientas perdidas de un minero.
- Acantilado: los mensajes de Nilo (correos sin entregar de Tavi).

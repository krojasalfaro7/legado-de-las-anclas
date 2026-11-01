# Hojas de sprites dibujadas a mano

Cualquier personaje, NPC o enemigo puede usar una hoja dibujada en lugar de la generada por
código. Si la hoja falta o no es válida, el juego usa la generada.

## Formato

| Clase      | Quién                              | Frame | Hoja completa |
| ---------- | ---------------------------------- | ----- | ------------- |
| `humanoid` | personajes, NPCs, enemigos humanos | 24×32 | 336×128       |
| `large`    | gólems y criaturas grandes         | 48×42 | 672×168       |
| `heavy`    | humanos grandes (brutos)           | 36×48 | 504×192       |
| `giant`    | colosos (jefes gólem a 3×)         | 72×63 | 1008×252      |

- **Columnas (14 poses)**, de izquierda a derecha: reposo 1, reposo 2, paso 1-4, golpe 1-3
  (puñetazo, cruzado, patada), ki, bloqueo, daño, vuelo 1, vuelo 2.
- **Filas (4 direcciones)**, de arriba abajo: abajo, izquierda, derecha, arriba. La derecha
  puede ser el espejo de la izquierda, pero tiene que estar dibujada en la hoja.
- **Pivote**: abajo al centro. En reposo, pasos 2 y 4 y bloqueo, la fila más baja con píxeles es
  la **última** del frame (ahí va el contorno bajo los pies). En vuelo, dibújalo igual que en el
  suelo: el juego lo eleva.
- **Cuerpo físico**: caja de pies centrada (10×7 en `humanoid`, 26×10 en `large`, 16×9 en `heavy`), 1 px por encima
  del borde inferior. Las plantillas la marcan en azul.
- **Paleta**: como mucho **15 colores opacos + transparente** por hoja (una paleta GBA de 16).
  Colores de **15 bits**: cada canal es un múltiplo de 8 (0, 8, …, 248) o su versión expandida
  (…, 255). Sin píxeles semitransparentes.
- **Contorno**: 1 px de color (más oscuro que el relleno, no negro puro), luz desde arriba a la
  izquierda, igual que las hojas generadas.
- **Sombra**: no se dibuja. El juego pone la sombra en el suelo bajo los pies.
- **Animación**: reposo a 2,5 fps, paso a 9 fps y vuelo a 7 fps. Golpes, ki, bloqueo y daño son
  poses fijas.

## Nombres de archivo

`public/assets/sprites/<clave>.png`, por ejemplo:

- `actor-tavi.png`, `actor-tavi-anchorAwakening.png` (transformación), `actor-okun.png`
- `actor-npc-iole.png`, `actor-npc-pim.png`
- `actor-enemy-raider.png`, `actor-enemy-ballastGolem.png` (clase `large`)

`npm run sprites:check` muestra la lista completa si un nombre no coincide.

## Flujo de trabajo

1. `npm run sprites:templates` genera `docs/sprite-templates/<clave>.png`: la hoja en (0, 0) con
   el tamaño exacto, la silueta generada de referencia, guías (rojo: centro y última fila; azul:
   cuerpo) y rótulos en los márgenes derecho e inferior.
2. Ábrela en tu editor, dibuja en una capa nueva encima y, para exportar, oculta la plantilla y
   recorta el lienzo al tamaño de la hoja desde arriba a la izquierda.
3. Guarda el PNG en `public/assets/sprites/` y ejecuta `npm run sprites:check`: revisa tamaño,
   frames vacíos, paleta y pies, y actualiza `manifest.json` con las hojas válidas.
   `npm run dev` y `npm run build` lo ejecutan solos (sin fallar).

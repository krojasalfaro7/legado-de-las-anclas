# Para revisar (cuando estés en línea)

Cosas que decidí solo mientras terminaba el juego y que conviene que mires. La más reciente va
arriba.

- **Decidido (2026-11-01)**: el final se queda como está; los créditos dicen "Un juego de Kevin
  Rojas"; los encargos de caza (Maela y Dámaso) cuentan desde que se aceptan.
- **Dificultad del final (ajustado)**: medí cuánto tarda en caer cada jefe a golpes efectivos al
  nivel de su capítulo. Los de capítulo caen en 20-35 s; Vesk Final (36 s) se queda; el Corazón
  del Fondo pedía 60 s y además huye en sus dos primeras fases, así que bajó de 4800 a 3900 PV y
  su forma de coloso (la que pelea cuerpo a cuerpo) ocupa ahora el 40 % final de la barra. El Eco
  del Fondo (opcional, nivel 40) bajó de 6400 a 5800: sigue siendo el reto más largo. Si lo
  juegas y se siente fácil o difícil, dime cuál.
- **Retratos de jefes gigantes**: salen como un recorte oscuro (entra en la mejora de arte).

- **Sensación de combate (ronda de feedback)**: el golpe solo conecta cuando el puño toca, el
  rayo empuja según el peso del enemigo, y los disparos y rayos chocan con lo que se ve (los
  objetos bajos solo frenan disparos a ras de suelo; en vuelo pasan por encima). La guardia con
  ki (A+S) cubre la mitad del daño sin gastar ki, y se quitó el apuntado automático de las
  ráfagas. Si algún valor no se siente bien (alcance, empuje, recarga de ki), dímelo con el
  personaje y la situación.
- **Cap. 7, la sombra de Tavi**: la sombra no se destruye, Tavi la acepta y de ahí nace Marea
  Profunda. Es una decisión de tono (más introspectiva); revisa si te gusta el diálogo.

- **Coloso de Salmuera (jefe cap. 4)**: es el gólem de siempre ampliado ×3. Funciona y se lee
  como "enorme", pero es un bloque bastante simple; si quieres un diseño propio de jefe gigante,
  es candidato a redibujar.

- **Música (hecho, 2026-11-01)**: banda sonora original compuesta y sintetizada en el juego
  (`src/audio/tracks.ts`), más todos los efectos rehechos. Si alguna pieza no te convence, dime
  cuál y la reescribo: cada una es texto corto y fácil de cambiar.
- **Pose de recoger objeto**: reutiliza el frame de "daño" mirando hacia abajo, que tiene los
  brazos alzados. Si quieres una pose propia, hay que añadir una columna a las hojas de sprites.

# Ficha de App Store Connect — Zancudos al Ataque

Borrador en español (Chile), basado en el contenido real del juego en el commit `0c1cd44` del repo público `MILLO-GAMES/zancudos-al-ataque` (12 nov 2026). No se inventaron funciones.

Christian se refirió a este juego como «Mosquitos al Ataque». El nombre oficial, el que está en el juego, el repo y este borrador, es **Zancudos al Ataque**. No usar «Mosquitos al Ataque» como nombre de tienda: no coincide con lo que ve el jugador y puede chocar con la guía de precisión de metadatos (2.3).

Bundle ID propuesto: `cl.millogames.zancudos`  
Versión de marketing en Xcode: 1.0 (build 2).  
Idioma principal: español (Chile).  
Precio: gratis (sin compras dentro de la app en esta versión).

## Nombre

Zancudos al Ataque

(18 caracteres de 30. Comprobar en App Store Connect que no esté tomado.)

## Subtítulo

AR: caza zancudos en tu pieza

(29 caracteres de 30.)

Alternativa un poco más corta, si se prefiere no ir al límite: «Caza zancudos en tu pieza» (25).

## Descripción

¡Los zancudos invadieron tu pieza!

Quédate en tu sitio, gira el iPhone, apunta con la mira y mantén SPRAY para rociarles insecticida. Son zancudos de cómic: el común, el explorador (más rápido) y el acorazado (hay que rociarlo varias veces). Cuando uno zumba más fuerte, tiembla y se pone rojo, viene a picarte: rocíalo o dale un MANOTAZO. Si te pica, pierdes energía.

Si la cámara reconoce un mueble —la tele, el sillón, la mesa u otros—, algunos zancudos se posan encima, se quedan quietos y valen el doble. En cada oleada aparecen criaderos (baldes, neumáticos o floreros con agua): rocíalos o tócalos para vaciarlos y que no salgan más zancudos. Cuando se acabe el spray, agita el iPhone para recargar la lata.

Hay un álbum de seis láminas estilo cómic que se desbloquean jugando, un modo copiloto para marcar zancudos en el radar (pensado para jugar en dos con el teléfono abierto) y datos reales de prevención entre oleadas y al final de la partida (criaderos, dengue en Chile, uso seguro del insecticida). También puedes jugar sin cámara, en el modo holodeck.

El detector de objetos corre dentro del teléfono: la imagen de la cámara no se graba ni se envía. El récord y el álbum quedan guardados solo en el aparato. El juego funciona sin internet.

Una app de Christian Jaramillo.

## Palabras clave

zancudos,mosquitos,spray,realidad aumentada,ar,camara,caza,insectos,pieza,oleadas

(81 caracteres de 100. Sin tildes, como recomienda Apple. No se repite el nombre «Zancudos al Ataque», que ya es buscable. Se incluye «mosquitos» porque en Chile se usa como sinónimo y es como Christian nombra el juego.)

## Categoría sugerida

- **Principal:** Juegos (Games)
- **Género primario:** Acción (Action)
- **Género secundario (opcional):** Familia (Family) o Casual

Es un juego con oleadas, puntaje, combo, tipos de enemigo y un álbum. No es una utilidad de cámara.

## Clasificación de edad (sugerencia)

**9+**, sujeta al cuestionario oficial de App Store Connect (hay que completarlo con sinceridad, no basta esta sugerencia).

Fundamento de lo que hay en la app:

- Violencia de caricatura: el jugador rocía y «caza» zancudos dibujados estilo cómic; hay un sprite de zancudo muerto, «¡auch!» al recibir una picada y la pantalla «¡Te picaron!». No hay sangre realista, no hay violencia hacia personas ni animales reales.
- Sin lenguaje soez, sin contenido sexual, sin compras dentro de la app, sin anuncios y sin cuentas de usuario.
- Entre oleadas hay datos reales sobre zancudos, dengue en Chile y prevención (vaciar agua estancada, mosquiteros, uso seguro del insecticida). Es informativo, no gráfico.
- No hay rastreo ni datos de ubicación.

En el cuestionario, marcar violencia de caricatura o fantasía (frecuencia: el combate es el núcleo del juego; intensidad: leve / no realista). «Sin restricción» en sexo, alcohol, drogas, etc., solo si corresponde. Aunque el tema son insectos y no personas, no conviene pedir 4+ si el revisor considera frecuente la violencia de caricatura.

## Privacidad (App Privacy / nutrition labels)

Sugerencia, basada en el código de esta build:

- **Datos no recopilados** (no se transmiten fuera del dispositivo ni los guarda el desarrollador en un servidor).
- Cámara: se usa en el aparato para el fondo AR y, de forma opcional, para detectar muebles. Los cuadros no se almacenan ni se envían. Eso se declara en el Info.plist y en la política, no como «dato recopilado».
- Movimiento/orientación: solo para apuntar y recargar el spray; no se guarda ni se envía.
- No hay identificadores, anuncios, analíticas ni tracking. No aplica App Tracking Transparency.
- El récord, el álbum y las preferencias quedan en el almacenamiento local del iPhone.

## Capturas necesarias

Hay que tomarlas en un iPhone real (la cámara es el fondo del AR). En simulador solo se puede mostrar el menú o el modo holodeck, y eso no representa la experiencia que promete la ficha.

JPEG o PNG **sin transparencia**, de 1 a 10 por tamaño. Fuente: especificaciones de capturas de App Store Connect (documentación de Apple, 2026).

### Obligatorio

1. **iPhone con Dynamic Island (pantalla mediana)** — al menos una, hasta 10, en vertical (recomendado) o también alguna horizontal si el juego se usa girando el teléfono:
   - 1179 × 2556 px, o
   - 1206 × 2622 px

Este proyecto quedó **solo para iPhone**. No hace falta captura de iPad.

Las capturas de iPhone con Dynamic Island de pantalla grande (1260×2736, 1290×2796 o 1320×2868) son opcionales: si no se suben, Connect escala las de la ranura obligatoria.

### Qué mostrar (propuesta de 5 a 6 tomas, todas de la app real)

1. Menú principal, con el título «¡Zancudos al Ataque!» y el botón Jugar en AR.
2. Partida en AR: pieza real de fondo, mira, un zancudo de cómic y la mano con el spray.
3. Un zancudo posado en un mueble detectado (tele o sillón), con el marcador y el ×2.
4. Un criadero en el suelo (balde, neumático o florero) y el spray o el toque para vaciarlo.
5. Álbum de láminas, con alguna ficha desbloqueada.
6. (Opcional) Pantalla final con el resumen (cazados, criaderos, consejo de prevención).

No usar el modo holodeck como captura principal si se está vendiendo el AR en la pieza. No mostrar textos de «PWA», Safari o «añadir a pantalla de inicio».

En el repo hay material de promo (`promo/zancudos.gif`, `promo/zancudos.mp4`, `promo/og-zancudos.jpg`) útil para redes, pero **no reemplaza** las capturas oficiales de la app nativa.

### También conviene preparar

- Ícono 1024×1024: ya está en `ios/App/App/Assets.xcassets/AppIcon.appiconset/` (arte del repo, zancudo cómic y spray sobre fondo naranjo).
- Política de privacidad: el HTML está listo en `/workspace/ios-apps/mosquitos-privacidad/privacidad.html` y va empaquetado en la app (`privacidad.html`, enlace en el menú). **Todavía no tiene URL pública.** Propuesta, pendiente de publicar: https://zancudos.millogames.online/privacidad.html
  Responsable: Christian Jaramillo. Contacto: millo@millo.cl. Fecha: 16-11-2026.
- Copyright: app © 2026 Christian Jaramillo. Three.js: MIT. MediaPipe: Apache-2.0. Fuente Bangers: SIL Open Font License (incluida en `assets/fonts/OFL.txt`).

## Notas para la revisión

- La app funciona sin internet (juego, modelo de detección y wasm van en el paquete).
- No se debe presentar como «atajo a un sitio web» ni como la PWA de GitHub Pages.
- No hay compras ni anuncios en esta versión.
- En las Notas de revisión conviene explicar, en español o inglés, que la cámara se usa solo como fondo AR y para detectar muebles en el dispositivo, que no se envía ningún fotograma, y que el revisor puede jugar también en modo holodeck si no desea conceder la cámara. Pedir que pruebe en un iPhone real.
- Antes de enviarla a revisión de Apple, pasar build y ficha por el Auditor de Seguridad.

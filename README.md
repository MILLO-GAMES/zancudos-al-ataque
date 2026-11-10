Juego en vivo: https://millo-games.github.io/asedio-neon/

# Asedio Neón · Millo Games — Invasión de zancudos

Juego de **realidad aumentada en tu pieza** pensado para el **iPhone Duo** (plegable) y jugable en cualquier iPhone.
Te quedas parado, giras con el teléfono, apuntas con la mira y les tiras **insecticida** a zancudos estilo cómic que zumban frente a ti.
Si la cámara reconoce un mueble (la tele, el sillón, la mesa…), algunos zancudos **se posan encima** y valen el doble.
Nombre, arte y sonidos son propios de Millo Games.

> Es una **app web instalable (PWA)**: se instala desde Safari con "Añadir a pantalla de inicio" y abre a pantalla completa. **No** es una app de App Store ni usa ARKit nativo.

## Cómo se juega
- **Apuntar**: gira el teléfono (giroscopio). La cámara trasera muestra tu pieza de fondo.
- **SPRAY**: mantén el botón 💨 (o cualquier parte de la vista AR). Sale una nube de insecticida en cono: no hace falta atinarle exacto, el cono se abre con la distancia.
- **La lata se gasta**: cuando se vacíe, **agita el iPhone** para recargarla (o toca ⟳).
- **Picadas con aviso**: cuando un zancudo va a picarte **tiembla, se pone rojo y su zumbido sube**. Rocíalo o mantén **MANOTAZO** ✋ para espantarlo si viene de frente. Si te pica: "¡auch!" y pierdes energía.
- **Zancudos**: común (burdeos, 2 rociadas), **explorador** morado (más rápido y zigzagueante, desde la oleada 2) y **acorazado** café (6 rociadas, desde la oleada 3).
- **Posados**: un zancudo posado en un objeto se queda quieto frotándose las patas. Es blanco fácil, recibe el doble de spray y da **×2 puntos**.
- Combo: zancudos seguidos suben el multiplicador (hasta ×5). Recibir una picada lo reinicia.
- Entre oleadas aparece un **"¿Sabías que…?"** con datos reales sobre zancudos (quiénes pican, cómo evitar criaderos, el dengue en Chile, uso seguro de insecticida).
- **Recentrar** (panel): fija "el frente" hacia donde estás mirando. Los zancudos aparecen y vuelan en un arco frontal de ±45° horizontal y ±20° vertical respecto a ese frente.
- En PC: arrastrar con el mouse/flechas para mirar, **Espacio** spray, **Shift** manotazo, **R** agitar, **P** pausa.

## Misiones, álbum y modo copiloto
- **Misión: elimina el criadero**: en cada oleada aparecen en el suelo baldes, neumáticos o floreros con agua estancada (con larvas). Mientras tengan agua, de ahí salen zancudos. **Rocíalos o tócalos** para vaciarlos: +250 puntos y dejan de salir zancudos.
- **Spray con carga limitada**: la lata dura ~6 s de spray continuo y **no se rellena sola**. Para recargarla **agita el iPhone** (DeviceMotion; usa el mismo permiso de movimiento). Botón ⟳ o tecla **R** de respaldo.
- **Álbum de láminas** (📖 en el menú y en la pantalla final): 6 fichas estilo cómic que se desbloquean jugando (zancudo común, explorador, acorazado, cazador de muebles, adiós criadero, manotazo justo). Cada una trae su personalidad y un dato real. Se guarda en el teléfono (`localStorage`).
- **Modo copiloto** (panel → *Copiloto: sí*), pensado para el **Duo abierto**: la columna lateral se agranda y el radar pasa a ser el mapa del copiloto. Un jugador apunta con el teléfono y el otro **toca el radar** donde ve un zancudo: queda marcado con un círculo amarillo en la vista AR y aparece "COPILOTO: ¡IZQUIERDA!" (o derecha, arriba, atrás…). En el radar: rojo = zancudo, blanco = viene a picar, amarillo = posado o marcado, verde = objeto detectado, celeste = criadero.
- **Pantalla final con resumen**: cazados, picadas evitadas, criaderos eliminados, posados, picadas recibidas, puntería, más un **consejo real de prevención** (mosquitero, repelente, mallas, vaciar el agua) y un "¿Sabías que…?".

## Más fácil que la versión anterior
- Los zancudos vuelan **de frente** (arco frontal), lento y en zigzag suave; ya no rodean ni disparan.
- Pocos a la vez al principio (2 en la oleada 1) y la cantidad sube de a poco (máximo 7).
- Una sola picada a la vez al inicio, siempre avisada por sonido y color.
- 150 de energía, +25 entre oleadas, hitbox amplia y cono de spray que ayuda a apuntar.

## Sonidos (todos sintetizados con WebAudio, sin archivos)
Zumbido "bzzz" por zancudo con paneo izquierda/derecha y volumen según la distancia (sube de tono cuando pica), "pssst" del spray mientras lo mantienes, "plop + boing" cuando cae, tos chistosa cuando lo rocías, "¡auch!" cuando te pica, "paf" del manotazo y "chk-chk" al agitar la lata.

## Posarse en objetos (detector en el navegador)
- Usa **MediaPipe Object Detector** (Google AI Edge, modelo **EfficientDet-Lite0**, clases COCO) sobre el video de la cámara, **dentro del teléfono** (nada se envía).
- Corre a ~2-4 cuadros por segundo (baja solo si el teléfono se demora) para no afectar el juego.
- Objetos: tele, sillón, silla, mesa, cama, notebook, refri, planta, microondas, reloj, florero, libro, botella, taza y otros. Aparecen marcados con un corchete y su nombre.
- El borde superior del objeto se proyecta como un rayo desde la cámara a **3 m fijos**, usando la orientación del teléfono en ese momento.
- Archivos incluidos en el repo (`vendor/mediapipe/`, `models/`, ~19 MB), con respaldo en el CDN oficial. El service worker los guarda la primera vez que se usan, así después funciona sin internet.
- Si el modelo no carga (sin red la primera vez, navegador antiguo), el juego sigue normal, solo que sin posarse. Se puede apagar en el panel: **Posarse en objetos: sí/no**.
- En **modo holodeck** (sin cámara) hay una tele virtual para que igual se posen.

## Instalar en el iPhone
1. Abre la URL en **Safari** (la cámara y los sensores exigen HTTPS).
2. Toca **Compartir** → **Añadir a pantalla de inicio** → **Añadir**.
3. Abre **Asedio Neón** desde el ícono y toca **JUGAR EN AR**.
4. Acepta **Movimiento y orientación** y **Cámara**. Si los rechazaste: Ajustes → Safari → Configuración del sitio, o borra el ícono y vuelve a agregarlo.
5. Si tenías la versión anterior instalada, ciérrala y ábrela de nuevo (el service worker nuevo, `asedio-neon-v2-zancudos`, reemplaza la caché vieja).

## Pantallas: Duo cerrado vs abierto
| Situación | Layout |
|---|---|
| Duo **cerrado** (5,4") / iPhone normal | `layout-compacto`: AR a pantalla completa, HUD compacto, mini-radar, mira central, mano con spray abajo a la derecha (más chica), SPRAY grande abajo a la derecha (pulgar), MANOTAZO a la izquierda. Panel completo con ☰. |
| Duo **abierto** (7,6") o pantalla ancha | `layout-abierto`: AR grande + **columna lateral fija** con radar grande (zancudos y objetos detectados), puntaje, récord, oleada, zancudos restantes, spray, energía, manotazo, puntería, estado del detector y objetos vistos. |
| Plegable que reporta **2 segmentos** | Usa la **Viewport Segments API** y `env(viewport-segment-*)`: AR en un segmento, panel en el otro, respetando la bisagra. |

En el panel, **Layout: auto/compacto/abierto** fuerza un modo para probar.

## AR: qué técnica usa
- **Safari de iPhone no soporta WebXR `immersive-ar`**. El modo principal es **cámara trasera de fondo + orientación del dispositivo + Three.js**: solo rota (3 grados de libertad).
- Si el navegador sí tiene WebXR AR (Chrome Android, visores), aparece el botón **"Jugar con WebXR (experimental)"**.
- Sin cámara o sin permiso → **modo holodeck**. Sin sensores → arrastrar para mirar.

## Correr en local
Requisitos: Node 18+. Sin build ni dependencias npm: Three.js y MediaPipe van en `vendor/`.
```bash
npx http-server -S -C cert.pem -K key.pem .   # o cualquier servidor estático con HTTPS
```
Las herramientas de desarrollo (`dev.sh`, `server.mjs`, pruebas con Chromium headless y cámara falsa) se quedan en la copia local y no van en el repo público. Para probar basta cualquier servidor estático con HTTPS.

## Estructura
```
index.html              menú, HUD, mano con spray, panel, overlays
sw.js                   service worker (red primero, caché offline, v2)
css/style.css           layouts compacto/abierto/segmentos, mano, textos flotantes
js/main.js              juego: oleadas, zancudos (sprites), spray, picadas, posarse, radar, HUD, datos
js/extras.js            criaderos dibujados en canvas, álbum de láminas, detector de agitar
js/detector.js          MediaPipe Object Detector (local con respaldo CDN, degrada sin romper)
js/audio.js             sonidos WebAudio sintetizados (zumbido espacial, spray, plop, tos, auch)
js/sensors.js           cámara trasera, permisos iOS, orientación → cámara 3D, FOV
js/layout.js            detección Duo (segmentos / tamaño) y modo forzado
assets/sprites/         zancudos (aleteo 4 cuadros, muerto, explorador, acorazado) y mano (6 cuadros), WebP
vendor/                 Three.js r170 y MediaPipe Tasks Vision 1.2.2 (Apache-2.0)
models/                 efficientdet_lite0.tflite (int8, COCO)
```

## Limitaciones
- PWA, no App Store; sin ARKit, sin oclusión ni anclaje real a superficies (3DoF).
- **Posado aproximado**: como el juego solo sabe hacia dónde apunta el teléfono (no dónde está), el objeto se ancla en la dirección en que se vio, a 3 m fijos. Si caminas por la pieza, el zancudo posado ya no calza con el mueble; si te quedas en tu sitio y solo giras, calza bastante bien. La brújula de iOS puede correrse un poco: usa **Recentrar**.
- La detección de objetos depende de la luz y del ángulo; a veces confunde una cama con un sillón.
- El botón de volumen no se puede usar como gatillo desde la web y Safari iOS no tiene vibración.
- No se ha probado en un Duo físico; si el layout falla, usa **Layout** en el panel.

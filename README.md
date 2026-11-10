Juego en vivo: https://millo-games.github.io/asedio-neon/

# Asedio Neón · Millo Games

Shooter de **realidad aumentada en tu pieza** por oleadas, pensado para el **iPhone Duo** (plegable) y jugable ya en un iPhone normal (probado en layout de iPhone 15 Pro Max).
Te quedas parado al centro, giras con el teléfono, apuntas con la mira y le disparas a drones neón que aparecen a tu alrededor. Es un homenaje original a los shooters arcade de VR por oleadas: nombre, arte y sonidos son propios de Millo Games.

> Es una **app web instalable (PWA)**: se instala desde Safari con "Añadir a pantalla de inicio" y abre a pantalla completa. **No** es una app de App Store ni usa ARKit nativo.

## Cómo se juega
- **Apuntar**: gira el teléfono (giroscopio). La cámara trasera muestra tu pieza de fondo.
- **Disparar**: toca o mantén el botón **FUEGO** (o cualquier parte de la vista AR). Mantener = ráfaga (7 tiros/s).
- **Escudo**: mantén **ESCUDO**. Bloquea los disparos que vienen **de frente** (cono de ~60°). Gasta energía; si se agota, se rompe y se recarga solo.
- **Recargar**: botón ⟳ (cargador de 30; recarga automática al vaciarse).
- Los drones avisan antes de disparar: el núcleo **parpadea en blanco**. También puedes **derribar sus proyectiles**.
- Enemigos: **dron** (dispara), **veloz** amarillo (kamikaze, desde la oleada 2), **acorazado** rosado (4 impactos, ráfagas de 3, desde la oleada 3).
- Flechas rojas en el borde = enemigos fuera de pantalla. Radar: tú al centro, arriba es hacia donde miras.
- Combo: aciertos seguidos suben el multiplicador (hasta ×5). Fallar o recibir daño lo reinicia.
- **Recentrar** (panel): vuelve a fijar "el frente" de la arena hacia donde estás mirando.
- En PC: arrastrar con el mouse/flechas para mirar, **Espacio** fuego, **Shift** escudo, **R** recargar, **P** pausa.

## Instalar en el iPhone
1. Abre la URL **HTTPS** en **Safari** (la cámara y los sensores exigen HTTPS).
2. Toca **Compartir** → **Añadir a pantalla de inicio** → **Añadir**.
3. Abre **Asedio Neón** desde el ícono y toca **JUGAR EN AR**.
4. Acepta **Movimiento y orientación** y **Cámara**. Si los rechazaste: Ajustes → Safari → Avanzado/Configuración del sitio, o borra el ícono y vuelve a agregarlo.

## Pantallas: Duo cerrado vs abierto
| Situación | Layout |
|---|---|
| Duo **cerrado** (5,4") / iPhone 15 Pro Max | `layout-compacto`: AR a pantalla completa, HUD compacto arriba, mini-radar, mira central, FUEGO grande abajo a la derecha (pulgar), ESCUDO a la izquierda. El panel completo sale como cajón con ☰. |
| Duo **abierto** (7,6") o pantalla ancha | `layout-abierto`: AR grande + **columna lateral fija** con radar grande, puntaje, récord, oleada, drones restantes, munición (celdas), energía, escudo, precisión. |
| Plegable que reporta **2 segmentos** | Usa la **Viewport Segments API** (`window.viewport.segments`) y `@media (horizontal-viewport-segments: 2)` + `env(viewport-segment-*)`: AR en un segmento, panel en el otro, respetando la bisagra. Si son apilados → AR arriba, panel abajo. |

Detección: segmentos si el navegador los expone; si no, por tamaño CSS (lado menor ≥ 560 px → abierto). Las dos pantallas del Duo tienen el mismo aspect ratio, así que todo el HUD escala con `clamp()` + `vmin`. Se respeta `safe-area-inset-*` (Dynamic Island). En el panel, **Layout: auto/compacto/abierto** fuerza un modo para probar.

## AR: qué técnica usa
- **Safari de iPhone no soporta WebXR `immersive-ar`** (tampoco en iOS 27). Por eso el modo principal es **cámara trasera de fondo + orientación del dispositivo (IMU) + Three.js**: los drones viven en una esfera alrededor tuyo, como en una arena VR. Solo rota (3 grados de libertad): si caminas, los drones no se "quedan" pegados a los muebles.
- Si el navegador sí tiene WebXR AR (Chrome Android, visores), aparece el botón **"Jugar con WebXR (experimental)"** (sin probar en dispositivo real).
- Sin cámara o sin permiso → **modo holodeck** (rejilla neón y estrellas). Sin sensores → arrastrar para mirar.

## Correr en local
Requisitos: Node 18+ y (opcional) `cloudflared`. Sin build, sin dependencias npm: Three.js va en `vendor/`.
```bash
./dev.sh          # crea certificado autofirmado, levanta https://localhost:8443 y un túnel Cloudflare, muestra la URL
./dev.sh stop     # detiene servidor y túnel
node server.mjs 8443            # solo servidor HTTPS
HTTP=1 node server.mjs 8080     # HTTP simple (para poner detrás de otro túnel/proxy)
cloudflared tunnel --protocol http2 --url http://localhost:8080   # túnel manual
```
En LAN puedes abrir `https://IP-DEL-PC:8443` en el iPhone, pero Safari reclamará el certificado autofirmado; lo ideal es un túnel o hosting con HTTPS real.

Pruebas: `python3 tools/smoke.py` (capturas en 4 tamaños en `tools/shots/`) y `python3 tools/hit_test.py` (verifica impacto y puntaje).

## Estructura
```
index.html              menú, HUD, panel, overlays
manifest.webmanifest    PWA (display standalone, íconos, theme-color)
sw.js                   service worker (red primero, caché offline)
css/style.css           layouts compacto/abierto/segmentos, safe-area, neón
js/main.js              juego: oleadas, enemigos, disparo, escudo, radar, HUD
js/sensors.js           cámara trasera, permisos iOS, orientación → cámara 3D, FOV
js/layout.js            detección Duo (segmentos / tamaño) y modo forzado
js/audio.js             efectos WebAudio sintetizados
vendor/three.module.min.js  Three.js r170
icons/                  íconos generados (tools/make_icons.py)
server.mjs, dev.sh      servidor HTTPS + túnel
```

## Limitaciones
- PWA, no App Store; sin ARKit, sin anclaje a superficies ni oclusión (3DoF, solo giro).
- El botón de volumen no se puede usar como gatillo desde la web.
- No hay vibración háptica en Safari iOS (`navigator.vibrate` no existe).
- La detección "Duo abierto" depende de lo que Safari reporte en el dispositivo real (segmentos o ancho); no se ha probado en un Duo físico. Si falla, usa **Layout** en el panel.
- La brújula de iOS puede derivar un poco; usa **Recentrar** si el frente se corre.

# Instalar Studies4Kids (Windows 10 u 11)

Studies4Kids es una app de estudio para los hijos: resúmenes, tarjetas, tests, simulacros de examen y un tutor, a partir de su propio temario. Se instala en un PC de casa y se abre desde cualquier dispositivo de la misma red.

La instalación la hace un script. Tú solo tienes que copiar la carpeta, hacer doble clic y responder a tres preguntas.

> **Estado de las pruebas:** la instalación completa se ha hecho con éxito en un mini PC con Windows 11 Pro.
> No se ha probado en Windows 10 ni en otras ediciones. Si algo falla, mira "Si algo va mal".
> Para **macOS** hay un instalador aparte, todavía sin probar: mira "Instalación en macOS" al final.

## Qué necesitas

- Un PC con **Windows 10 u 11** que pueda quedarse encendido (un mini PC es ideal).
- Una **cuenta de administrador** en ese PC.
- **Internet**.
- Tu propia **cuenta de ChatGPT**. La app usa tu plan a través de Codex, la herramienta oficial de OpenAI; no se comparte la cuenta de otra familia. Comprueba en la web de OpenAI que tu plan incluye Codex.

## 1. Preparar el PC

- Inicia sesión en Windows con la cuenta de administrador. Esa cuenta será la dueña de la app y de la sesión de ChatGPT.
- Reserva la **IP del PC en el router**, para que la dirección de la app no cambie.

## 2. Copiar la app

Elige tu caso:

**A. Has descargado el zip de GitHub o te lo han pasado (instalación nueva)**

1. Haz clic derecho sobre el zip → *Propiedades* → marca **Desbloquear** si aparece → *Aceptar*.
2. Clic derecho → **Extraer todo** y elige una carpeta, por ejemplo `C:\Studies4Kids`. No ejecutes nada desde dentro del zip.

**B. Ya la usabas en otro PC y quieres llevarte vuestros datos**

1. En el PC antiguo, **para la app**, para que la base de datos no cambie a medias.
2. Copia la carpeta del proyecto entera al PC nuevo, por ejemplo a `C:\Studies4Kids`.
   - **Incluye** la carpeta `data`: ahí están los perfiles, los PIN, el material, las tarjetas, las notas y la racha.
   - **No hace falta** copiar `node_modules` ni `.next` (pesan mucho y el script los vuelve a crear).

En ambos casos, usa una ruta corta y sin caracteres raros, y evita carpetas sincronizadas con OneDrive.

## 3. Instalar

Dentro de la carpeta, haz **doble clic en `instalar.cmd`** y acepta el aviso de administrador. Si Windows muestra "Windows protegió su PC", pulsa *Más información* → *Ejecutar de todas formas*.

El script hace todo esto, en orden:

| Paso | Qué hace |
|---|---|
| Node.js | Lo instala si falta (con `winget`). |
| Codex | Instala la herramienta que conecta con tu cuenta de ChatGPT. |
| App | Descarga sus piezas y la compila. La primera vez tarda varios minutos. |
| Datos | Si hay una carpeta `data` con datos, la conserva. Si no, la app empieza de cero. |
| Red | Si la red está como "Pública", **te pregunta** si la marca como "Privada". Di que sí solo si es la red de casa. |
| Cortafuegos | Permite el puerto 3000, únicamente en redes privadas. |
| Suspensión | **Te pregunta** si evita que el equipo se suspenda solo. Recomendado. |
| Arranque | Crea una tarea programada que arranca la app al encender el equipo, sin necesidad de iniciar sesión. |
| ChatGPT | Si Codex no tiene sesión, abre el navegador para que inicies sesión con tu cuenta. |

Al terminar muestra las direcciones para abrir la app, del tipo `http://192.168.1.x:3000`.

## 4. Primera configuración

Abre la dirección en el navegador.

- **Instalación nueva:** la app te pide el **PIN de padres** y el **nombre y curso de cada hijo**. Cada hijo elegirá su propio PIN la primera vez que entre. Hazlo tú antes de darles la dirección: quien abre la app primero es quien fija el PIN de padres.
- **Si traías datos:** aparecen los perfiles de siempre, con sus PIN.

Después, en el panel de padres:

1. En *Inteligencia artificial* debe poner **Cuenta de ChatGPT (Codex)** y **Codex con sesión iniciada**.
2. Pulsa **Probar conexión**. Debe responder con un saludo en unos 10 segundos.

Desde ese mismo panel puedes añadir hijos, cambiarles el nombre, borrar un perfil, restablecer un PIN y pasarlos de curso.

## 5. Uso diario

No hay que hacer nada: la app arranca sola al encender el PC y se reinicia si se cae.

Órdenes útiles, desde una terminal de PowerShell como administrador:

```powershell
Stop-ScheduledTask -TaskName Studies4Kids
```

```powershell
Start-ScheduledTask -TaskName Studies4Kids
```

Lo que va pasando queda escrito en `data\logs\app.log`.

## 6. Copia de seguridad

Todo lo vuestro está en la carpeta `data`. La sesión de ChatGPT no: vive en la carpeta `.codex` de tu usuario de Windows y se rehace con `codex login`.

1. Para la app (`Stop-ScheduledTask -TaskName Studies4Kids`).
2. Copia la carpeta `data` a otro disco.
3. Vuelve a arrancarla (`Start-ScheduledTask -TaskName Studies4Kids`).

Para restaurar: para la app, sustituye `data` por la copia y arranca.

## 7. Actualizar la app

Cuando haya una versión nueva del código:

1. Copia los archivos nuevos encima de los instalados, **sin tocar la carpeta `data`**.
2. Vuelve a hacer doble clic en `instalar.cmd`. Para la app, la recompila y la arranca de nuevo.

## 8. Cambiar el puerto

Abre una terminal en la carpeta de la app y ejecuta:

```powershell
.\instalar.cmd -Puerto 8080
```

## 9. Pasar la app a otra familia

Haz doble clic en **`empaquetar.cmd`**. Crea `compartir\Studies4Kids.zip` con el programa y esta guía.

El zip **no lleva** vuestra carpeta `data` (perfiles, PIN, material, notas) ni vuestra sesión de ChatGPT: la otra familia empieza de cero, con sus hijos y su propia cuenta. No les pases la carpeta del proyecto tal cual, porque dentro va `data`.

## Privacidad y seguridad

- La app está pensada para la **red de casa**. No abras su puerto a internet en el router: la protección es un PIN corto y la conexión no va cifrada.
- El temario que se sube y lo que escriben los hijos se envía a OpenAI para generar resúmenes, tests y respuestas, con tu cuenta de ChatGPT.
- Todo lo demás se guarda solo en la carpeta `data` de tu PC.

## Si algo va mal

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| El script se cierra diciendo que lo ejecutas como otro usuario | Aceptaste el aviso de administrador con una cuenta distinta a la de la sesión | Inicia sesión en Windows con la cuenta de administrador y repite |
| Falla "npm ci" o la compilación | Sin internet, o la carpeta está dentro del zip o en OneDrive | Extrae el zip a una carpeta normal como `C:\Studies4Kids` y repite |
| "La app no ha respondido en un minuto" | Fallo al arrancar | Mira `data\logs\app.log`. Si está vacío, abre el Programador de tareas, busca "Studies4Kids" y mira el resultado de la última ejecución |
| La tarea no arranca al encender, pero sí a mano | La tarea "sin iniciar sesión" no funciona con tu tipo de cuenta | En el Programador de tareas, edita "Studies4Kids" y cambia el desencadenador a "Al iniciar sesión"; después configura el inicio de sesión automático de Windows |
| Se abre en el PC pero no desde el móvil | La red sigue como "Pública", o el router aísla los dispositivos Wi-Fi | Marca la red como Privada en Configuración → Red e Internet; revisa en el router el "aislamiento de clientes" |
| "Codex sin sesión" en el panel de padres | No se inició sesión, o se hizo con otra cuenta de Windows | Abre una terminal normal (no de administrador) y ejecuta `codex login` |
| "Probar conexión" falla | Sin internet, plan de ChatGPT sin Codex, o límite del plan agotado | Comprueba la conexión y tu plan, y prueba más tarde |
| Has olvidado el PIN de padres | No se puede recuperar desde la app | Para la app y borra la carpeta `data` para empezar de cero (se pierde todo), o restaura una copia de seguridad |

## Quitar la app

Desde PowerShell como administrador:

```powershell
Unregister-ScheduledTask -TaskName Studies4Kids -Confirm:$false
```

```powershell
Remove-NetFirewallRule -DisplayName Studies4Kids
```

Después borra la carpeta. Guarda antes `data` si quieres conservar lo estudiado.

## Instalación en macOS (sin probar)

> **Aviso:** el instalador de macOS está escrito y revisado, pero **todavía no se ha ejecutado en ningún Mac**.
> Si lo pruebas, cuenta cómo te ha ido abriendo una incidencia en el repositorio de GitHub.

Lo que cambia respecto a Windows:

1. **Carpeta:** extrae el zip y mueve la carpeta a tu carpeta de usuario, por ejemplo `~/Studies4Kids`. **No la dejes en Escritorio, Documentos, Descargas ni iCloud**: macOS impide que un servicio en segundo plano lea esas carpetas, y el instalador se negará a continuar.
2. **Node.js:** si no lo tienes, instala la versión LTS desde https://nodejs.org. Si usas Homebrew, el instalador lo pone por ti.
3. **Instalar:** abre **Terminal**, escribe `bash ` (con el espacio final), arrastra el archivo `instalar.command` a la ventana y pulsa Intro. Así se evita el bloqueo de macOS a los archivos descargados. No uses `sudo`.
4. **Preguntas:** el instalador pregunta si evita que el Mac se suspenda solo, y abre el navegador para iniciar sesión en ChatGPT.
5. **Cortafuegos:** si macOS pregunta si "node" puede aceptar conexiones entrantes, pulsa **Permitir**.
6. **Primera configuración:** igual que en Windows (apartado 4).

Diferencias de funcionamiento:

- La app arranca **al iniciar sesión** en el Mac, no al encenderlo. Para que funcione sola tras un apagón, activa el inicio de sesión automático en *Ajustes del Sistema → Usuarios y grupos*.
- Un portátil con la tapa cerrada se suspende igualmente.
- Codex se instala en `~/.studies4kids`, sin contraseña de administrador.

Órdenes útiles en Terminal:

```bash
launchctl bootout gui/$(id -u)/com.studies4kids.app
```

```bash
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.studies4kids.app.plist
```

La primera para la app y la segunda la arranca. El registro está en `data/logs/app.log`. Para actualizar, copia los archivos nuevos sin tocar `data` y repite el paso 3. Para otro puerto, añade `--puerto 8080` al final de la orden del paso 3.

Para quitarla: para la app con la primera orden, borra `~/Library/LaunchAgents/com.studies4kids.app.plist`, la carpeta `~/.studies4kids` y la carpeta de la app.

## Alternativa con Docker (Linux o NAS)

Si lo quieres en un equipo con Linux o en un NAS, el proyecto incluye `Dockerfile` y `docker-compose.yml`.
Esa vía **no está probada**. En resumen:

1. Copia el proyecto al equipo, sin `node_modules` ni `.next`.
2. Si traes datos, van un nivel más abajo que en Windows: el contenido de `data` se copia a `data/app`.
3. Da permisos a la carpeta: `sudo chown -R 1000:1000 data`.
4. Arranca con `docker compose up -d --build`.
5. Inicia sesión de ChatGPT con `docker compose exec app codex login --device-auth`.

La zona horaria está en `docker-compose.yml` (`TZ: Europe/Madrid`); en Canarias sería `Atlantic/Canary`.

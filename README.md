# Studies4Kids

App web de estudio para los hijos, que se instala en un PC de casa y se usa desde cualquier dispositivo de la misma red. A partir del temario que sube cada alumno (PDF, fotos de los apuntes o texto), la IA prepara resúmenes, tarjetas, tests y simulacros de examen, y un tutor que responde dudas.

Funciona con **tu propia cuenta de ChatGPT**, a través de Codex, la herramienta oficial de OpenAI. No necesita una clave de API de pago por uso, aunque también la admite.

## Qué hace

- **Perfiles por hijo**, cada uno con su PIN, y un panel de padres protegido.
- **Cursos, asignaturas y temas.** Al pasar de curso, el anterior queda archivado.
- **Material:** PDF, PDF escaneados, fotos de apuntes y texto pegado.
- **Resumen y términos clave** de cada tema.
- **Tarjetas** con modo aprender y repaso espaciado.
- **Test rápido y simulacro de examen** con tiempo, corregidos por la IA, y versión para imprimir.
- **Exámenes con fecha** y una ruta de estudio para llegar preparado.
- **"Explícalo con tus palabras":** el alumno cuenta el tema y la IA le dice qué domina y qué le falta.
- **Tutor por chat** que da pistas en vez de la respuesta y se ciñe al material del tema.
- **Racha, puntos y progreso semanal**, también visibles para los padres.
- El tono y la dificultad se adaptan a la etapa: Primaria, ESO o Bachillerato.

## Qué necesitas

- Un PC con **Windows 10 u 11** que pueda quedarse encendido (un mini PC es ideal).
- Una cuenta de administrador en ese PC e internet.
- Una **cuenta de ChatGPT** cuyo plan incluya Codex.

## Instalación rápida

1. Descarga el proyecto: botón **Code → Download ZIP**, y extráelo en una carpeta como `C:\Studies4Kids`.
2. Haz doble clic en **`instalar.cmd`** y acepta el aviso de administrador.
3. Responde a las preguntas del instalador e inicia sesión con tu cuenta de ChatGPT cuando te lo pida.
4. Abre la dirección que muestra al final, crea el PIN de padres y los perfiles de tus hijos.

El instalador pone Node.js y Codex si faltan, compila la app, abre el puerto solo en redes privadas y deja la app arrancando sola al encender el equipo.

La guía completa, con copias de seguridad, actualización y solución de problemas, está en **[INSTALAR.md](INSTALAR.md)**.

Hay también un `Dockerfile` y un `docker-compose.yml` para Linux o un NAS, pero esa vía **no está probada**.

## Privacidad y seguridad

- La app está pensada para la **red de casa**. No abras su puerto a internet: la protección es un PIN corto y la conexión no va cifrada.
- El temario que se sube y lo que escriben los alumnos se envía a OpenAI para generar los resúmenes, tests y respuestas, con tu cuenta.
- Todo lo demás (perfiles, material, notas y progreso) se guarda únicamente en la carpeta `data` de tu PC.

## Para quien quiera tocar el código

Hecha con Next.js (App Router), React y TypeScript, con SQLite integrado en Node.js (`node:sqlite`) y CSS sin frameworks. Requiere Node.js 24 o posterior.

```bash
npm ci
```

```bash
npm run dev
```

La base de datos y los archivos subidos van a `data/`, o a la carpeta que indique la variable de entorno `DATA_DIR`. La capa de IA está en `src/lib/ai.ts` y admite dos proveedores: Codex CLI con la sesión de ChatGPT del equipo, o una clave de la API de OpenAI (esta segunda vía no está probada).

## Aviso

Proyecto personal, hecho para una familia y compartido tal cual, sin garantías. No está afiliado a OpenAI ni respaldado por ella. El uso de la cuenta de ChatGPT a través de Codex está sujeto a las condiciones de OpenAI.

## Licencia

[MIT](LICENSE).

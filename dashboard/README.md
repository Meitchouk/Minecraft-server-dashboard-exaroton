# Exaroton Panel

Dashboard en Next.js 16 + shadcn/ui (Base UI) + Tailwind 4 para administrar servidores de Exaroton.
El token de la API vive **solo en el servidor de Next.js**: el navegador habla con `/api/*`, que hace proxy a `api.exaroton.com`.

## Arranque

```bash
npm install --ignore-scripts
npm run dev
```

Abre http://localhost:3000.

### Variables (`.env.local`)

| Variable | Descripcion |
|---|---|
| `EXAROTON_TOKEN` | Token de API (https://exaroton.com/account/ → API). Tambien puede venir como variable de entorno del sistema. |
| `EXAROTON_SERVER_ID` | Servidor por defecto. Se puede cambiar desde el selector del sidebar (se guarda en el navegador). |
| `FIREBASE_SERVICE_ACCOUNT` | Clave de cuenta de servicio: ruta a un archivo (local) o el JSON completo. |
| `FIREBASE_SERVICE_ACCOUNT_B64` | Alternativa para despliegues: el mismo JSON en base64 (`npm run sa:b64` lo genera). Tiene prioridad sobre la anterior. |
| `AUTH_SECRET` | Secreto (32+ caracteres) para firmar las sesiones. |
| `SEED_ADMIN_USER` / `SEED_ADMIN_PASSWORD` | Admin inicial para `npm run seed`. |

## Despliegue

1. Copia `.env.example` como referencia y define las variables en el hosting (Vercel, Railway, Docker, VPS…).
2. La clave de Firebase **no se sube al repo**: genera el base64 en tu PC con `npm run sa:b64` y pegalo en
   `FIREBASE_SERVICE_ACCOUNT_B64`. (Pegar el JSON tal cual en `FIREBASE_SERVICE_ACCOUNT` tambien funciona, pero
   algunos paneles rompen los saltos de linea de `private_key`.)
3. `AUTH_SECRET` nuevo y largo en produccion; `npm run seed` una vez para crear el admin (o crea usuarios desde /admin).
4. Las copias automaticas corren dentro del proceso de Next (`instrumentation.ts`): en plataformas serverless
   (Vercel) no hay proceso permanente, asi que ahi conviene un VPS/contenedor o un cron externo que llame a
   `POST /api/backup/run` con una sesion de admin.

## Usuarios y acceso

- Todo el panel exige sesion. Cualquiera puede **registrarse** (`/register`) y entrar; pero el servidor del administrador (su API key) solo se habilita cuando un **admin aprueba** la cuenta en `/admin`. Sin aprobar, el usuario puede operar sus propios servidores con su API key.
- Usuarios en Firestore (`users/<username>`, contraseña con scrypt). Sesion en cookie httpOnly firmada (JWT, `AUTH_SECRET`).
- Admin inicial: `npm run seed` (lee `SEED_ADMIN_USER` / `SEED_ADMIN_PASSWORD` de `.env.local`).
- Cada usuario puede usar **su propia API key de Exaroton** desde Ajustes: se guarda solo en `sessionStorage` de esa pestaña,
  viaja en la cabecera `x-exaroton-token` y el servidor la usa al vuelo sin almacenarla ni auditarla.

## Datos en Firestore

| Coleccion | Contenido |
|---|---|
| `users/<u>` (+ `favorites`) | cuentas, roles, aprobacion; favoritos por usuario |
| `servers/<id>/players/<p>/snapshots` | copias automaticas de inventario + cofre de Ender |
| `servers/<id>/trash` · `warps` · `custom_items` | papelera, ubicaciones e items de mod (compartidos por servidor) |
| `servers/<id>/audit` (y `-` para eventos globales) | auditoria: quien ejecuto que |
| `settings/backup` | ajustes de las copias automaticas |

Si no hay clave de servicio, las copias y la auditoria caen a archivos en `data/` y el resto de colecciones no esta disponible.

## Secciones

| Ruta | Que hace |
|---|---|
| `/` | Estado en vivo, jugadores (con kick), RAM, software, creditos, controles Iniciar/Reiniciar/Detener |
| `/console` | Log en vivo con filtro, envio de comandos con historial (↑↓), compartir log en mclo.gs |
| `/commands` | **Rapidos** (clima, tiempo, gamemode, gamerules, whitelist…), **Give** con catalogo de items + encantamientos + nombre + irrompible, **Efectos** con presets, **Invocar** criaturas, **Favoritos** guardados en el navegador |
| `/config` | `server.properties` como formulario agrupado (Juego, Acceso, Mundo, Rendimiento, Resource pack) con barra de cambios pendientes |
| `/players` | Whitelist, OPs, baneados y IPs baneadas |
| `/files` | Explorador con editor de texto, subir, crear carpeta, eliminar, descargar |
| `/settings` | Mi API key (temporal por sesion), RAM (slider), MOTD con vista previa y colores §, datos del servidor y cuenta |
| `/discipline` | Castigos y premios rapidos para un jugador |
| `/messages` | Bienvenida con titulo al entrar, consejos automaticos, reglas (/rules) y avisos a Discord por webhook — sin mods, via observador de consola |
| `/stats` | Estadisticas reales por jugador (world/players/stats) e historial de conexiones (grafica 24h/7d/30d, sesiones) |
| `/admin` | (solo admin) aprobar/revocar usuarios, roles, contraseñas y auditoria |

## Observador de consola

`lib/watcher.ts` mantiene una conexion permanente al stream de consola del servidor por defecto (arranca en
`instrumentation.ts`). Detecta entradas/salidas (`logged in with entity id` / `lost connection`), envia la bienvenida,
registra presencia y muestras cada 5 min (Firestore `servers/<id>/presence` y `samples`), publica en Discord si hay webhook
y emite los consejos automaticos. Se reconecta solo.

## Catalogo de items

`/api/items` descarga items/encantamientos/efectos/entidades de [PrismarineJS/minecraft-data](https://github.com/PrismarineJS/minecraft-data)
para la version del servidor (o la mas cercana disponible) y lo cachea en memoria. Los items de mods no estan ahi:
en la pestaña Give se pueden agregar por ID (`modid:item`) y quedan guardados en el navegador.

## Estructura

```
src/
  app/
    api/            # Route handlers → proxy a Exaroton (token solo aqui)
    commands/       # Pagina de comandos (quick, give, effects, summon, favorites)
    console/ config/ players/ files/ settings/
  components/
    app-shell.tsx   # Sidebar + topbar + selector de servidor
    server-controls.tsx, status-badge.tsx, target-picker.tsx, command-runner.tsx
    ui/             # shadcn
  hooks/
    use-server.ts   # usePoll / useServer / useDraft
    use-catalog.ts  # catalogo de items + helpers localStorage
  lib/
    exaroton.ts     # cliente de la API (server-only)
    route.ts        # helpers para route handlers
    client.ts       # fetch del navegador, tipos, utilidades
```

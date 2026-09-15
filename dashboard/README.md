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
| `FIREBASE_SERVICE_ACCOUNT` | Ruta (o JSON) de la clave de cuenta de servicio de Firebase. |
| `AUTH_SECRET` | Secreto (32+ caracteres) para firmar las sesiones. |
| `SEED_ADMIN_USER` / `SEED_ADMIN_PASSWORD` | Admin inicial para `npm run seed`. |

## Usuarios y acceso

- Todo el panel exige sesion. Cualquiera puede **registrarse** (`/register`), pero solo entra cuando un **admin aprueba** la cuenta en `/admin`.
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
| `/admin` | (solo admin) aprobar/revocar usuarios, roles, contraseñas y auditoria |

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

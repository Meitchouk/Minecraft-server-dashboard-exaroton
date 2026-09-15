# exaroton-manager

CLI en Node (sin dependencias) para administrar un servidor de Exaroton desde la terminal.

## Configuracion

1. Copia `.env.example` a `.env` (ya esta hecho) y rellena:
   - `EXAROTON_TOKEN`: https://exaroton.com/account/ -> API -> Create token
   - `EXAROTON_SERVER_ID`: obtenlo con `npm run servers`
2. `.env` esta en `.gitignore`; nunca lo compartas.

## Uso

```bash
npm run servers            # lista servidores e IDs
npm run status             # estado del servidor
npm run start / stop / restart
npm run exa -- cmd say hola
npm run exa -- config server.properties
npm run exa -- config-set server.properties difficulty=hard pvp=false
npm run exa -- file-backup server.properties
npm run exa -- list-add whitelist Jugador1 Jugador2
```

`npm run exa -- help` muestra todos los comandos.

> Los cambios de archivos/config suelen requerir que el servidor este apagado.

## Dashboard web

En `dashboard/` hay un panel completo en Next.js (estado, consola, comandos rapidos, give con catalogo de items,
server.properties, jugadores, archivos, RAM/MOTD). Ver `dashboard/README.md`.

```bash
cd dashboard && npm install --ignore-scripts && npm run dev
```

#!/usr/bin/env node
import * as api from "./api.js";
import { writeFile, mkdir } from "node:fs/promises";
import { readFile } from "node:fs/promises";

const [cmd, ...args] = process.argv.slice(2);
const out = (v) => console.log(typeof v === "string" ? v : JSON.stringify(v, null, 2));

const HELP = `
Uso: npm run exa -- <comando> [args]

  servers                          Lista servidores (id, nombre, estado)
  status                           Estado del servidor actual
  start | stop | restart           Control del servidor
  cmd <comando de consola>         Ejecuta un comando (ej: cmd say hola)
  logs                             Ultimas lineas del log
  logs-share                       Sube el log a mclo.gs y devuelve URL

  ram [gb]                         Ver o cambiar RAM
  motd [texto]                     Ver o cambiar MOTD

  list <lista>                     Ver lista: whitelist | ops | banned-players | banned-ips
  list-add <lista> <nombre...>     Agregar jugadores a la lista
  list-remove <lista> <nombre...>  Quitar jugadores de la lista

  file-info <ruta>                 Info de archivo/directorio (ej: file-info /)
  file-read <ruta>                 Imprime contenido de un archivo
  file-write <ruta> <local>        Sube un archivo local a esa ruta
  file-backup <ruta>               Descarga el archivo a ./backups/
  config <ruta>                    Lee opciones de config (ej: config server.properties)
  config-set <ruta> k=v [k=v...]   Cambia opciones (ej: config-set server.properties difficulty=hard)
`;

async function main() {
  switch (cmd) {
    case undefined:
    case "help": return console.log(HELP);

    case "servers": {
      const list = await api.servers();
      for (const s of list) console.log(`${s.id}  ${s.name.padEnd(20)} ${api.statusName(s.status).padEnd(10)} ${s.address}`);
      return;
    }
    case "status": {
      const s = await api.server();
      return out({ id: s.id, name: s.name, address: s.address, status: api.statusName(s.status),
        players: s.players, software: s.software, motd: s.motd });
    }
    case "start": return out(await api.start());
    case "stop": return out(await api.stop());
    case "restart": return out(await api.restart());
    case "cmd": return out(await api.command(args.join(" ")));
    case "logs": return out((await api.logs()).content);
    case "logs-share": return out(await api.shareLogs());

    case "ram": return out(args[0] ? await api.setRam(args[0]) : await api.getRam());
    case "motd": return out(args.length ? await api.setMotd(args.join(" ")) : await api.getMotd());

    case "list": return out(args[0] ? await api.playerList(args[0]) : await api.playerLists());
    case "list-add": return out(await api.playerListAdd(args[0], args.slice(1)));
    case "list-remove": return out(await api.playerListRemove(args[0], args.slice(1)));

    case "file-info": return out(await api.fileInfo(args[0] ?? "/"));
    case "file-read": return out(await api.fileRead(args[0]));
    case "file-write": {
      const content = await readFile(args[1]);
      return out(await api.fileWrite(args[0], content));
    }
    case "file-backup": {
      const content = await api.fileRead(args[0]);
      await mkdir("backups", { recursive: true });
      const dest = `backups/${args[0].replace(/[\/]/g, "_")}.${Date.now()}`;
      await writeFile(dest, content);
      return console.log(`Guardado en ${dest}`);
    }
    case "config": return out(await api.configRead(args[0]));
    case "config-set": {
      const opts = Object.fromEntries(args.slice(1).map((kv) => {
        const [k, ...v] = kv.split("=");
        const val = v.join("=");
        return [k, val === "true" ? true : val === "false" ? false : /^-?\d+$/.test(val) ? Number(val) : val];
      }));
      return out(await api.configWrite(args[0], opts));
    }
    default:
      console.error(`Comando desconocido: ${cmd}`);
      console.log(HELP);
      process.exit(1);
  }
}

main().catch((e) => { console.error("Error:", e.message); process.exit(1); });

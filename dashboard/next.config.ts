import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // El proxy (auth) bufferiza el cuerpo de las peticiones; por defecto lo corta a 10 MB y truncaba
    // las subidas de mods grandes (p. ej. Ledger, 19 MB). Subimos el limite a 200 MB.
    proxyClientMaxBodySize: "200mb",
  },
};

export default nextConfig;

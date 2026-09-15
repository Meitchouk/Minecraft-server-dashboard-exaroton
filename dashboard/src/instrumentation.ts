// Se ejecuta una vez al arrancar el servidor de Next: arranca el programador de copias de inventario
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { schedule } = await import("@/lib/backup");
    await schedule();
  }
}

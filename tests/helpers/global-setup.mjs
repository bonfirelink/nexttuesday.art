import { startServer } from "./serve.mjs";

// NTS_BASE set: test that URL (a preview or the live site), no server of our own.
export default async function globalSetup() {
  if (process.env.NTS_BASE) return;
  const srv = await startServer();
  process.env.NTS_BASE = srv.url;
  return () => srv.close();
}

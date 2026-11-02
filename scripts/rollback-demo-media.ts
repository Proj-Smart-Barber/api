import { readFile, writeFile } from "node:fs/promises";
const path = process.argv[2];
if (!path) throw new Error("Informe o arquivo .batch.json do lote.");
const apply = process.argv.includes("--apply");
const base = (
  process.env.MEDIA_IMPORT_API_URL ?? "http://127.0.0.1:3336"
).replace(/\/$/, "");
if (apply && !["127.0.0.1", "localhost"].includes(new URL(base).hostname))
  throw new Error("Rollback limitado à homologação local.");
(async () => {
  const ledger = JSON.parse(await readFile(path, "utf8"));
  const result = {
    mode: apply ? "APPLY" : "DRY_RUN",
    items: 0,
    detached: 0,
    preserved: 0,
  };
  for (const entry of Object.values(ledger) as any[]) {
    if (entry.state === "ROLLED_BACK") continue;
    result.items++;
    if (!apply) continue;
    const token =
      process.env[
        "MEDIA_IMPORT_ACCESS_TOKEN_" +
          String(entry.mediaKey ?? "").toUpperCase()
      ] ?? process.env.MEDIA_IMPORT_ACCESS_TOKEN;
    if (!token) throw new Error("Sessão owner de homologação ausente.");
    async function request(route: string, method = "GET") {
      const response = await fetch(base + route, {
        method,
        headers: { Authorization: "Bearer " + token },
      });
      if (!response.ok)
        throw new Error("Rollback recusado: HTTP " + response.status);
      return response.json() as Promise<any>;
    }
    if (entry.purpose === "SERVICE_PHOTO")
      await request(
        `/api/barbershops/${entry.shopId}/services/${entry.serviceId}/media/${entry.mediaId}`,
        "DELETE",
      );
    else if (entry.galleryItemId)
      await request(
        `/api/barbershops/${entry.shopId}/gallery/${entry.galleryItemId}`,
        "DELETE",
      );
    else if (entry.purpose === "BARBERSHOP_LOGO") {
      const current = await request(`/api/barbershops/${entry.shopId}`);
      if (current.avatarUrl && current.avatarUrl !== entry.publicUrl) {
        result.preserved++;
        continue;
      }
      await request(`/api/barbershops/${entry.shopId}/logo`, "DELETE");
    }
    await request("/api/media/" + entry.mediaId, "DELETE");
    entry.state = "ROLLED_BACK";
    await writeFile(path, JSON.stringify(ledger, null, 2));
    result.detached++;
  }
  console.log(JSON.stringify(result));
})().catch((error) => {
  console.error(error instanceof Error ? error.message : "Rollback falhou");
  process.exitCode = 1;
});

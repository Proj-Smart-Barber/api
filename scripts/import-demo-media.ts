import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname, sep } from "node:path";
import { createHash } from "node:crypto";
const manifestPath = resolve(
  process.argv[2] ?? "docs/media-prepared-20261102/manifest.json",
);
const apply = process.argv.includes("--apply");
const base = (
  process.env.MEDIA_IMPORT_API_URL ?? "http://127.0.0.1:3336"
).replace(/\/$/, "");
const origin = new URL(base);
if (apply && !["localhost", "127.0.0.1"].includes(origin.hostname))
  throw new Error("Este importador está limitado à API de homologação local.");
const ledgerPath = manifestPath + ".batch.json";
(async () => {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  let ledger: Record<string, any> = {};
  try {
    ledger = JSON.parse(await readFile(ledgerPath, "utf8"));
  } catch {}
  const summary = {
    mode: apply ? "APPLY" : "DRY_RUN",
    eligible: 0,
    pending: 0,
    alreadyImported: 0,
    bytes: 0,
    uploaded: 0,
  };
  for (const item of manifest.items) {
    if (
      item.status !== "PREPARED_NOT_UPLOADED" ||
      item.publicationApproved !== true ||
      !item.shopId ||
      (item.purpose === "SERVICE_PHOTO" && !item.serviceId)
    ) {
      summary.pending++;
      continue;
    }
    const variant = item.variants.find((variant: any) =>
      variant.file.includes("main."),
    );
    if (!variant) throw new Error("Derivado principal ausente.");
    const file = resolve(variant.file);
    if (!file.startsWith(dirname(manifestPath) + sep))
      throw new Error("Derivado fora da pasta do manifesto.");
    const data = await readFile(file);
    if (createHash("sha256").update(data).digest("hex") !== variant.sha256)
      throw new Error("Hash do derivado não confere.");
    const key = [
      item.shopId,
      item.serviceId ?? "",
      item.purpose,
      variant.sha256,
    ].join(":");
    summary.eligible++;
    summary.bytes += data.length;
    if (ledger[key]?.state === "ASSOCIATED") {
      summary.alreadyImported++;
      continue;
    }
    if (!apply) continue;
    const token =
      process.env["MEDIA_IMPORT_ACCESS_TOKEN_" + item.mediaKey.toUpperCase()] ??
      process.env.MEDIA_IMPORT_ACCESS_TOKEN;
    if (!token) throw new Error("Sessão owner de homologação não configurada.");
    async function api(path: string, method = "GET", body?: unknown) {
      const response = await fetch(base + path, {
        method,
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (!response.ok)
        throw new Error("Operação de mídia recusada: HTTP " + response.status);
      return response.json() as Promise<any>;
    }
    if (!ledger[key]) {
      const intent = await api("/api/media/upload-intent", "POST", {
        purpose: item.purpose,
        barbershopId: item.shopId,
        fileName: item.assetId + ".webp",
        contentType: variant.mimeType,
        fileSize: data.length,
      });
      ledger[key] = {
        mediaId: intent.mediaId,
        mediaKey: item.mediaKey,
        shopId: item.shopId,
        serviceId: item.serviceId,
        purpose: item.purpose,
        state: "PENDING",
        sha256: variant.sha256,
      };
      await writeFile(ledgerPath, JSON.stringify(ledger, null, 2));
      const destination = new URL(intent.uploadUrl);
      if (
        destination.protocol !== "https:" ||
        !destination.hostname.endsWith(".r2.cloudflarestorage.com")
      )
        throw new Error("Destino de storage não reconhecido.");
      const put = await fetch(destination, {
        method: "PUT",
        headers: { "Content-Type": variant.mimeType },
        body: data,
      });
      if (!put.ok) throw new Error("Falha no PUT da mídia.");
      ledger[key].state = "UPLOADED";
      await writeFile(ledgerPath, JSON.stringify(ledger, null, 2));
    }
    if (ledger[key].state === "PENDING") {
      const resumed = await api(
        "/api/media/" + ledger[key].mediaId + "/upload-url",
        "POST",
        {},
      );
      const destination = new URL(resumed.uploadUrl);
      if (
        destination.protocol !== "https:" ||
        !destination.hostname.endsWith(".r2.cloudflarestorage.com")
      )
        throw new Error("Destino de storage não reconhecido.");
      const put = await fetch(destination, {
        method: "PUT",
        headers: { "Content-Type": variant.mimeType },
        body: data,
      });
      if (!put.ok) throw new Error("Falha ao retomar upload.");
      ledger[key].state = "UPLOADED";
      await writeFile(ledgerPath, JSON.stringify(ledger, null, 2));
    }
    const entry = ledger[key];
    const ready = await api(
      "/api/media/" + entry.mediaId + "/confirm",
      "POST",
      {},
    );
    if (ready.media.status !== "READY")
      throw new Error("Mídia ainda não está pronta.");
    if (item.purpose === "SERVICE_PHOTO")
      await api(
        `/api/barbershops/${item.shopId}/services/${item.serviceId}/media`,
        "POST",
        { mediaId: entry.mediaId, displayOrder: item.order ?? 0 },
      );
    else if (item.purpose === "BARBERSHOP_LOGO") {
      if (!entry.previousLogoRecorded) {
        const previous = await api(`/api/barbershops/${item.shopId}`);
        entry.previousLogo = previous.avatarUrl ?? null;
        entry.previousLogoRecorded = true;
        await writeFile(ledgerPath, JSON.stringify(ledger, null, 2));
      }
      if (entry.previousLogo && entry.previousLogo !== ready.media.publicUrl)
        throw new Error(
          "Unidade já tem logo. Substituição não habilitada para este lote.",
        );
      await api(`/api/barbershops/${item.shopId}/logo`, "PATCH", {
        mediaId: entry.mediaId,
      });
    } else {
      const current = await api(`/api/barbershops/${item.shopId}/gallery`);
      const existing = current.items?.find(
        (photo: any) => photo.mediaId === entry.mediaId,
      );
      if (existing) entry.galleryItemId = existing.id;
      else {
        const response = await api(
          `/api/barbershops/${item.shopId}/gallery`,
          "POST",
          {
            mediaId: entry.mediaId,
            caption:
              item.context === "equipe-ilustrativa"
                ? "Pessoas ilustrativas de banco de imagens"
                : "Ambiente ilustrativo",
            isCover: false,
          },
        );
        entry.galleryItemId = response.item.id;
      }
    }
    entry.publicUrl = ready.media.publicUrl;
    entry.state = "ASSOCIATED";
    await writeFile(ledgerPath, JSON.stringify(ledger, null, 2));
    summary.uploaded++;
  }
  await writeFile(
    manifestPath + ".import-summary.json",
    JSON.stringify(summary, null, 2),
  );
  console.log(JSON.stringify(summary));
})().catch((error) => {
  console.error(error instanceof Error ? error.message : "Falha na importação");
  process.exitCode = 1;
});

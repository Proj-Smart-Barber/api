import { readFile, realpath } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import sharp from "sharp";
import {
  DEMO_BARBERSHOPS,
  DEMO_SERVICES,
} from "../src/infra/drizzle/demo-seed/canonical/fixtures";

async function verify() {
  const root = await realpath(resolve("assets/demo-media"));
  const manifest = JSON.parse(
    await readFile(resolve(root, "manifest.json"), "utf8"),
  );
  const identities = new Set();
  let files = 0,
    bytes = 0;
  for (const item of manifest.items) {
    if (item.decision === "excluded") {
      assert.equal(item.file, undefined);
      continue;
    }
    assert.ok(
      DEMO_BARBERSHOPS.some((shop) => shop.logicalKey === item.shopKey),
    );
    const path = await realpath(resolve(root, item.file));
    assert.ok(path.startsWith(root + sep));
    const data = await readFile(path);
    assert.equal(data.length, item.bytes);
    assert.equal(createHash("sha256").update(data).digest("hex"), item.sha256);
    const image = await sharp(data).metadata();
    assert.equal(image.format, "webp");
    assert.equal(image.pages ?? 1, 1);
    const identity = [
      item.shopKey,
      item.serviceKey ?? "",
      item.purpose,
      item.sha256,
    ].join("|");
    assert.ok(!identities.has(identity));
    identities.add(identity);
    if (item.purpose === "SERVICE_PHOTO" && item.decision === "import")
      assert.ok(
        DEMO_SERVICES.some(
          (s) =>
            s.logicalKey === item.serviceKey &&
            s.barbershopLogicalKey === item.shopKey,
        ),
      );
    if (item.decision === "reserve") assert.equal(item.serviceKey, null);
    files++;
    bytes += data.length;
  }
  assert.equal(files, 110);
  assert.equal(
    new Set(
      manifest.items
        .filter((i: any) => i.decision !== "excluded")
        .map((i: any) => i.shopKey),
    ).size,
    10,
  );
  console.log(
    JSON.stringify({
      files,
      bytes,
      selected: manifest.items.filter((i: any) => i.decision === "import")
        .length,
      reserve: manifest.items.filter((i: any) => i.decision === "reserve")
        .length,
      excluded: manifest.items.filter((i: any) => i.decision === "excluded")
        .length,
      offline: true,
    }),
  );
}
verify().catch(() => {
  console.error("Pacote invalido. Nenhum banco ou storage foi acessado.");
  process.exitCode = 1;
});

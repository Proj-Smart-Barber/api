import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { hash } from "bcryptjs";
import type { DemoStaffFixture } from "./types";

const CREDENTIALS_FILE_PATH = resolve(
  process.cwd(),
  ".demo-seed-credentials.json",
);

export interface StaffCredential {
  githubUser: string;
  name: string;
  email: string;
  role: string;
  unit: string;
  plainPassword: string;
  passwordHash: string;
}

export interface DatabaseTargetInfo {
  host: string;
  database: string;
  port: number;
  isLocal: boolean;
  maskedUri: string;
}

export function generateSecurePassword(): string {
  // Gera senha forte de 20 caracteres sem ambiguidade
  const raw = randomBytes(15).toString("base64url");
  // Garante pelo menos um caractere maiúsculo, minúsculo, número e símbolo seguro
  return `Sb!${raw}9$`;
}

export async function hashPlainText(password: string): Promise<string> {
  return hash(password, 12);
}

export async function loadOrCreateStaffCredentials(
  staffList: DemoStaffFixture[],
): Promise<Record<string, StaffCredential>> {
  let existingCredentials: Record<string, StaffCredential> = {};

  if (existsSync(CREDENTIALS_FILE_PATH)) {
    try {
      const raw = readFileSync(CREDENTIALS_FILE_PATH, "utf-8");
      existingCredentials = JSON.parse(raw);
    } catch {
      existingCredentials = {};
    }
  }

  const credentialsMap: Record<string, StaffCredential> = {};
  let modified = false;

  for (const staff of staffList) {
    const existing = existingCredentials[staff.logicalKey];

    if (existing && existing.plainPassword && existing.passwordHash) {
      credentialsMap[staff.logicalKey] = existing;
    } else {
      const plainPassword = generateSecurePassword();
      const passwordHash = await hashPlainText(plainPassword);

      const credential: StaffCredential = {
        githubUser: staff.githubUser,
        name: staff.name,
        email: staff.email,
        role: staff.role,
        unit: staff.unitKey,
        plainPassword,
        passwordHash,
      };

      credentialsMap[staff.logicalKey] = credential;
      existingCredentials[staff.logicalKey] = credential;
      modified = true;
    }
  }

  if (modified) {
    writeFileSync(
      CREDENTIALS_FILE_PATH,
      JSON.stringify(existingCredentials, null, 2),
      { encoding: "utf-8", mode: 0o600 },
    );
  }

  return credentialsMap;
}

export function inspectDatabaseTarget(
  connectionString: string,
): DatabaseTargetInfo {
  try {
    const parsed = new URL(connectionString);
    const host = parsed.hostname || "unknown";
    const port = parsed.port ? Number.parseInt(parsed.port, 10) : 5432;
    const database = parsed.pathname.replace(/^\//, "") || "unknown";
    const isLocal =
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host.endsWith(".local");

    const maskedUri = `${parsed.protocol}//${parsed.username ? "***:***@" : ""}${host}:${port}/${database}`;

    return {
      host,
      database,
      port,
      isLocal,
      maskedUri,
    };
  } catch {
    return {
      host: "unknown",
      database: "unknown",
      port: 5432,
      isLocal: false,
      maskedUri: "unparseable-database-url",
    };
  }
}

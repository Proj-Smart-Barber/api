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

export const DEFAULT_DEMO_PASSWORD = "SmartBarber12345!";

export function generateSecurePassword(): string {
  return randomBytes(24).toString("base64url");
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

    if (
      existing &&
      existing.plainPassword !== DEFAULT_DEMO_PASSWORD &&
      existing.passwordHash
    ) {
      credentialsMap[staff.logicalKey] = {
        ...existing,
        email: staff.email,
        name: staff.name,
      };
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
    try {
      writeFileSync(
        CREDENTIALS_FILE_PATH,
        JSON.stringify(existingCredentials, null, 2),
        { encoding: "utf-8", mode: 0o600 },
      );
    } catch {
      // Ignora erro em ambientes de filesystem read-only (ex: Vercel serverless)
    }
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

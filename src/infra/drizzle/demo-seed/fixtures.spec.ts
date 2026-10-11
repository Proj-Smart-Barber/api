import { describe, expect, it } from "vitest";
import { Cpf } from "../../../domain/enterprise/entities/value-objects/cpf";
import { DEMO_CUSTOMERS, DEMO_STAFFS } from "./fixtures";

describe("Demo Seed Fixtures Integrity", () => {
  it("all_fixture_cpfs_are_valid_unique", () => {
    const allFixtures = [...DEMO_STAFFS, ...DEMO_CUSTOMERS];
    const cpfsSeen = new Set<string>();

    for (const fixture of allFixtures) {
      const isValid = Cpf.isValid(fixture.cpf);
      expect(
        isValid,
        `CPF ${fixture.cpf} da fixture ${fixture.logicalKey} deve ser matematicamente válido`,
      ).toBe(true);

      const normalized = Cpf.normalize(fixture.cpf);
      expect(
        cpfsSeen.has(normalized),
        `CPF ${fixture.cpf} não pode estar duplicado entre as fixtures`,
      ).toBe(false);
      cpfsSeen.add(normalized);
    }

    // 8 staffs + 12 customers = 20 CPFs únicos
    expect(cpfsSeen.size).toBe(20);
  });

  it("fixture_email_identity_is_unique", () => {
    const allFixtures = [...DEMO_STAFFS, ...DEMO_CUSTOMERS];
    const emailsSeen = new Set<string>();

    for (const fixture of allFixtures) {
      const email = fixture.email.toLowerCase().trim();
      expect(
        emailsSeen.has(email),
        `Email ${email} não pode estar duplicado entre as fixtures`,
      ).toBe(false);
      emailsSeen.add(email);
    }

    expect(emailsSeen.size).toBe(20);
  });

  it("admin_is_not_inferred_from_email", () => {
    // Nenhuma fixture comum de staff ou customer deve possuir role PLATFORM_ADMIN implicitamente
    for (const staff of DEMO_STAFFS) {
      expect((staff as any).role).not.toBe("PLATFORM_ADMIN");
      expect(staff.role === "OWNER" || staff.role === "BARBERMAN").toBe(true);
    }
    for (const customer of DEMO_CUSTOMERS) {
      expect((customer as any).role).toBeUndefined();
    }
  });
});

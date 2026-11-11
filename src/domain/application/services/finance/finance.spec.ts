import { describe, expect, it } from "vitest";
import { nextDueDate, periodBounds, projectFinance } from "./finance";

describe("Projeção financeira", () => {
  it("ajusta a cópia de uma despesa para o último dia válido do mês", () => {
    expect(nextDueDate("2028-01-31")).toBe("2028-02-29");
    expect(nextDueDate("2026-12-15")).toBe("2027-01-15");
    expect(periodBounds("2028-02").to).toBe("2028-02-29");
    expect(periodBounds("1999-12").to).toBe("1999-12-31");
    expect(nextDueDate("1999-12-31")).toBe("2000-01-31");
  });
  it("exclui cancelamentos e ausências do faturamento e reconhece valores incompletos", () => {
    const summary = projectFinance(
      "2026-11",
      [],
      [
        {
          id: "1",
          date: "2026-11-15",
          status: "COMPLETED",
          amountInCents: 8000,
          receiptId: null,
          professional: "",
          services: "",
        },
        {
          id: "2",
          date: "2026-11-15",
          status: "CONFIRMED",
          amountInCents: 3000,
          receiptId: null,
          professional: "",
          services: "",
        },
        {
          id: "3",
          date: "2026-11-15",
          status: "CANCELLED",
          amountInCents: 9000,
          receiptId: null,
          professional: "",
          services: "",
        },
        {
          id: "4",
          date: "2026-11-15",
          status: "NO_SHOW",
          amountInCents: 7000,
          receiptId: null,
          professional: "",
          services: "",
        },
        {
          id: "5",
          date: "2026-11-15",
          status: "COMPLETED",
          amountInCents: null,
          receiptId: null,
          professional: "",
          services: "",
        },
      ],
    );
    expect(summary).toMatchObject({
      completedInCents: 8000,
      forecastInCents: 3000,
      receivedInCents: 0,
      unknownPrices: 1,
    });
    expect(summary.daily[14]).toMatchObject({
      completedInCents: 8000,
      forecastInCents: 3000,
    });
  });
});

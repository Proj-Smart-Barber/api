import { Slug } from "./slug";

describe("Slug", () => {
  it("deve gerar o slug de uma barbearia a partir do nome", () => {
    const slug = Slug.createFromText("Barbearia do Zé Cortes");

    expect(slug.value).toBe("barbearia-do-ze-cortes");
  });

  it("deve remover espaços extras, símbolos e hífens repetidos", () => {
    const slug = Slug.createFromText("  Corte & Barba   --  Premium!  ");

    expect(slug.value).toBe("corte-barba-premium");
  });

  it("deve manter um slug informado diretamente", () => {
    expect(Slug.create("barbearia-central").value).toBe("barbearia-central");
  });
});

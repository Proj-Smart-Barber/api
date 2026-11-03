/**
 * Resolução de fuso horário comercial brasileiro (IANA) com base em localização.
 *
 * Regras territoriais oficiais brasileiras (Decreto 2.784/1913, Lei 11.662/2008, Lei 12.876/2013):
 * - UTC-2: Fernando de Noronha (PE) -> America/Noronha
 * - UTC-3: Sudeste, Sul, Nordeste, GO, DF, TO, PA, AP -> America/Sao_Paulo
 * - UTC-4: MT -> America/Cuiaba
 *          MS -> America/Campo_Grande
 *          RO -> America/Porto_Velho
 *          RR -> America/Boa_Vista
 *          AM (maioria) -> America/Manaus
 * - UTC-5: AC e 13 municípios do extremo oeste do AM -> America/Rio_Branco
 */

export const BRAZIL_COMMERCIAL_TIMEZONES = [
  "America/Sao_Paulo",
  "America/Noronha",
  "America/Cuiaba",
  "America/Campo_Grande",
  "America/Porto_Velho",
  "America/Boa_Vista",
  "America/Manaus",
  "America/Rio_Branco",
] as const;

export type BrazilCommercialTimezone =
  (typeof BRAZIL_COMMERCIAL_TIMEZONES)[number];

const AM_UTC_MINUS_5_CITIES = new Set([
  "atalaia do norte",
  "benjamin constant",
  "boca do acre",
  "eirunepe",
  "envira",
  "guajara",
  "ipixuna",
  "itamarati",
  "jutai",
  "labrea",
  "pauini",
  "sao paulo de olivenca",
  "tabatinga",
]);

function normalizeText(val?: string | null): string {
  if (!val) return "";
  return val
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export interface ResolveTimezoneOptions {
  state?: string | null;
  city?: string | null;
  cep?: string | null;
  location?: string | null;
}

export function resolveCommercialTimezone(
  options: ResolveTimezoneOptions,
): BrazilCommercialTimezone {
  let state = options.state?.trim().toUpperCase();
  let city = options.city?.trim();
  let cep = options.cep?.replace(/\D/g, "");

  // Se os campos não foram passados diretamente, tentar extrair da string de localização canônica
  // Formato canônico: "Logradouro, Número, Bairro, Cidade - UF, CEP 00000-000"
  if ((!state || !city) && options.location) {
    const loc = options.location;

    // Extrair CEP se presente
    const cepMatch =
      loc.match(/CEP\s*(\d{5}-?\d{3})/i) || loc.match(/\b(\d{5}-\d{3})\b/);
    if (cepMatch && !cep) {
      cep = cepMatch[1].replace(/\D/g, "");
    }

    // Extrair "Cidade - UF"
    const cityStateMatch = loc.match(/,\s*([^,]+?)\s*-\s*([A-Za-z]{2})\b/);
    if (cityStateMatch) {
      if (!city) city = cityStateMatch[1].trim();
      if (!state) state = cityStateMatch[2].trim().toUpperCase();
    } else {
      // Tentar match de UF isolada no final ou após hífen
      const ufMatch = loc.match(/-\s*([A-Za-z]{2})\b/);
      if (ufMatch && !state) {
        state = ufMatch[1].trim().toUpperCase();
      }
    }
  }

  const normCity = normalizeText(city);
  const normLocation = normalizeText(options.location);

  // 1. Fernando de Noronha (PE) - UTC-2
  if (
    normCity.includes("fernando de noronha") ||
    normLocation.includes("fernando de noronha") ||
    (cep && cep.startsWith("53990"))
  ) {
    return "America/Noronha";
  }

  // 2. Acre - UTC-5
  if (
    state === "AC" ||
    normLocation.includes(" - ac") ||
    normLocation.includes("acre")
  ) {
    return "America/Rio_Branco";
  }

  // 3. Amazonas
  if (
    state === "AM" ||
    normLocation.includes(" - am") ||
    normLocation.includes("amazonas")
  ) {
    // Verificar se é um dos 13 municípios da calha do Juruá/Purus
    for (const westCity of AM_UTC_MINUS_5_CITIES) {
      if (normCity.includes(westCity) || normLocation.includes(westCity)) {
        return "America/Rio_Branco";
      }
    }
    return "America/Manaus";
  }

  // 4. Roraima - UTC-4
  if (
    state === "RR" ||
    normLocation.includes(" - rr") ||
    normLocation.includes("roraima")
  ) {
    return "America/Boa_Vista";
  }

  // 5. Rondônia - UTC-4
  if (
    state === "RO" ||
    normLocation.includes(" - ro") ||
    normLocation.includes("rondonia")
  ) {
    return "America/Porto_Velho";
  }

  // 6. Mato Grosso - UTC-4
  if (
    state === "MT" ||
    normLocation.includes(" - mt") ||
    normLocation.includes("mato grosso")
  ) {
    return "America/Cuiaba";
  }

  // 7. Mato Grosso do Sul - UTC-4
  if (
    state === "MS" ||
    normLocation.includes(" - ms") ||
    normLocation.includes("mato grosso do sul")
  ) {
    return "America/Campo_Grande";
  }

  // 8. Demais estados / default - UTC-3
  return "America/Sao_Paulo";
}

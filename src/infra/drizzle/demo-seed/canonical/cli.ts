import "dotenv/config";
import { DemoSeedEngine } from "./engine";
import { buildFullDemoSeedFixtures } from "./full-profile-fixtures";

async function main() {
  const args = process.argv.slice(2);

  const isRollback = args.includes("--rollback");
  const isApply = args.includes("--apply");
  const isDryRun = args.includes("--dry-run") || (!isApply && !isRollback);
  const forceReplenish = args.includes("--replenish");
  const profileArgument = args.find((arg) => arg.startsWith("--profile="));
  const profile = profileArgument?.split("=")[1] ?? "smoke";
  if (profile !== "smoke" && profile !== "full") {
    throw new Error("Perfil inválido. Use --profile=smoke ou --profile=full.");
  }

  let confirmSecret: string | undefined;
  let confirmFullProductionTarget: string | undefined;
  let productionBackupPath: string | undefined;
  let productionBackupSha256: string | undefined;
  for (const arg of args) {
    if (arg.startsWith("--confirm=")) {
      confirmSecret = arg.split("=")[1];
    }
    if (arg.startsWith("--confirm-full-production=")) {
      confirmFullProductionTarget = arg.split("=")[1];
    }
    if (arg.startsWith("--production-backup=")) {
      productionBackupPath = arg.slice("--production-backup=".length);
    }
    if (arg.startsWith("--production-backup-sha256=")) {
      productionBackupSha256 = arg.split("=")[1];
    }
  }

  const engine = new DemoSeedEngine();

  console.log(
    "===============================================================",
  );
  console.log("         SMART BARBER — SEED DE DEMONSTRAÇÃO ISOLADA          ");
  console.log(
    "===============================================================",
  );
  console.log(
    `Modo de Operação: ${isRollback ? "ROLLBACK" : isDryRun ? "DRY-RUN (SIMULAÇÃO SEM ESCRITA)" : "APPLY (ESCRITA NO BANCO)"}`,
  );
  console.log(`Perfil: ${profile}`);

  try {
    const fullProfileFixtures =
      profile === "full" ? buildFullDemoSeedFixtures() : undefined;
    const summary = await engine.run({
      dryRun: isDryRun,
      rollback: isRollback,
      confirmSecret,
      forceReplenishDisposables: forceReplenish,
      profile,
      fullProfileFixtures,
      confirmFullProductionTarget,
      productionBackupPath,
      productionBackupSha256,
    });

    console.log(
      "---------------------------------------------------------------",
    );
    console.log("ALVO DO BANCO DE DADOS:");
    console.log(`  Host:      ${summary.targetDatabase.host}`);
    console.log(`  Porta:     ${summary.targetDatabase.port}`);
    console.log(`  Database:  ${summary.targetDatabase.database}`);
    console.log(
      `  Tipo:      ${summary.targetDatabase.isLocal ? "LOCAL (Desenvolvimento/Homologação)" : "EXTERNO (Produção/Remoto)"}`,
    );
    console.log(`  Namespace: ${summary.namespace}`);
    console.log(`  Data-base: ${summary.baseDateSP} (Fuso: America/Sao_Paulo)`);
    console.log(
      "---------------------------------------------------------------",
    );

    console.log("RELATÓRIO POR TABELA:");
    console.table(
      Object.entries(summary.counts).map(([table, stat]) => ({
        Tabela: table,
        Planejados: stat.planned,
        Criados: stat.created,
        Reaproveitados: stat.reused,
      })),
    );

    if (!isRollback) {
      console.log(
        "---------------------------------------------------------------",
      );
      console.log("UNIDADES DE DEMONSTRAÇÃO GERADAS:");
      console.log(
        `  • Barbearia Horizonte: ${summary.createdIds["horizonte:barbershop"] || "N/A"}`,
      );
      console.log(
        `  • Barbearia Estação:   ${summary.createdIds["estacao:barbershop"] || "N/A"}`,
      );

      console.log(
        "---------------------------------------------------------------",
      );
      console.log("RESERVAS DESCARTÁVEIS (TESTE DE CANCELAMENTO):");
      console.log(
        `  • Horizonte (Arthur): ${summary.createdIds["horizonte:booking:descartavel-cancelamento"] || "N/A"}`,
      );
      console.log(
        `  • Estação (Carlos):   ${summary.createdIds["estacao:booking:descartavel-cancelamento"] || "N/A"}`,
      );

      console.log(
        "---------------------------------------------------------------",
      );
      console.log("SEGURANÇA DE CREDENCIAIS:");
      if (isDryRun) {
        console.log(
          "  [DRY-RUN] Nenhuma credencial foi persistida no banco ou em arquivo.",
        );
      } else {
        const credentialsFile =
          profile === "full"
            ? ".demo-seed-full-credentials.json"
            : ".demo-seed-credentials.json";
        console.log(
          `  [APPLY] Credenciais salvas em '${credentialsFile}' (git-ignored).`,
        );
        if (profile === "full") {
          console.log(
            summary.targetDatabase.isLocal
              ? "  [INFO] A senha padronizada é exclusiva do banco local de teste."
              : "  [ATENÇÃO] O perfil remoto criou contas sintéticas com senha compartilhada; restrinja e rotacione após os testes.",
          );
        }
        console.log(
          "  [INFO] Apenas hashes bcrypt com salt 12 foram gravados no banco de dados.",
        );
      }
    }

    console.log(
      "===============================================================",
    );
    console.log(
      `STATUS: SUCESSO (${isRollback ? "ROLLBACK COMPLETO" : isDryRun ? "DRY-RUN FINALIZADO" : "SEED APLICADO"})`,
    );
    console.log(
      "===============================================================",
    );
    process.exit(0);
  } catch (error) {
    console.error(
      "===============================================================",
    );
    console.error("ERRO DURANTE EXECUÇÃO DO SEED:");
    console.error((error as Error).message);
    console.error(
      "===============================================================",
    );
    process.exit(1);
  }
}

main();

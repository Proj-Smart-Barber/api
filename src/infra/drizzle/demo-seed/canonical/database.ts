import type { db } from "../../index";

/** The reset runner passes one transaction to the engine and its registry. */
export type SeedDatabase = Pick<
  typeof db,
  "select" | "insert" | "update" | "delete" | "execute" | "transaction"
>;

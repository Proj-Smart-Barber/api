import { AsyncLocalStorage } from "node:async_hooks";
import { db } from "./index";

export type DbClient =
  | typeof db
  | Parameters<Parameters<(typeof db)["transaction"]>[0]>[0];

export const drizzleTxContext = new AsyncLocalStorage<DbClient>();

export function getActiveDb(): DbClient {
  return drizzleTxContext.getStore() ?? db;
}

import {describe,it,expect,vi} from 'vitest';
import {isSchemaReady,SCHEMA_MIGRATION_VERSION} from './migrator';
vi.mock('./index',()=>({db:{}}));
describe('release readiness is read-only and fail-closed',() => {
 it('rejects a missing ledger without issuing DDL',async () => {
  const execute=vi.fn().mockResolvedValue({rows:[{relation:null}]});
  expect(await isSchemaReady({execute})).toBe(false);expect(execute).toHaveBeenCalledTimes(1);
 });
 it('requires the exact compatible release version',async () => {
  for(const [version,expected] of [[SCHEMA_MIGRATION_VERSION,true],['old-release',false]] as const) {
   const execute=vi.fn().mockResolvedValueOnce({rows:[{relation:'schema_migrations_meta'}]}).mockResolvedValueOnce({rows:[{version}]});
   expect(await isSchemaReady({execute})).toBe(expected);expect(execute).toHaveBeenCalledTimes(2);
  }
 });
 it('rejects an unavailable database',async () => {
  expect(await isSchemaReady({execute:vi.fn().mockRejectedValue(new Error('offline'))})).toBe(false);
 });
});

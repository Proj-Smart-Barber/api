import { expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
vi.mock('../index', () => ({ db: {} }));
import { DrizzleDiscoveryRepository } from './drizzle-discovery-repository';

it('removes both spatial bounds for null radius and orders globally before pagination', async () => {
  const queries: string[] = [];
  const dialect = new PgDialect();
  const database = {execute: vi.fn(async (query: Parameters<PgDialect['sqlToQuery']>[0]) => {
    const statement = dialect.sqlToQuery(query).sql;
    queries.push(statement);
    return {rows: statement.includes('COUNT(*)::int AS total') ? [{total:0}] : []};
  })};
  const repository = new DrizzleDiscoveryRepository(database);
  vi.spyOn(repository as never, 'isGoogleMapsCacheHealthy' as never).mockResolvedValue(true as never);
  await repository.search({mode:'NEARBY',point:{latitude:-23.5,longitude:-46.6},radiusKm:null,page:2,limit:20});
  const query = queries.find((statement) => statement.includes('ORDER BY'))!;
  expect(query).toBeDefined();
  expect(query).not.toContain('BETWEEN');
  expect(query).toMatch(/ORDER BY.*distance_meters.*ASC, b.id ASC/s);
  expect(query.indexOf('ORDER BY')).toBeLessThan(query.indexOf('LIMIT'));
});

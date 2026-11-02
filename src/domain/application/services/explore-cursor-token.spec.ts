import { describe, it, expect } from 'vitest';
import {
  createExploreCursor,
  verifyAndParseExploreCursor,
  computeFiltersHash,
  InvalidExploreCursorError,
  ExpiredExploreCursorError,
} from './explore-cursor-token';

describe('Explore Cursor Token', () => {
  const secret = 'test-secret-salt-123';

  it('deve gerar e verificar um cursor assinado válido', () => {
    const filtersHash = computeFiltersHash({
      mode: 'NEARBY',
      radiusKm: 10,
      latBucket: -23.55,
      lngBucket: -46.63,
    });

    const token = createExploreCursor(
      {
        offset: 10,
        sessionId: 'sess-abc-123',
        filtersHash,
      },
      secret
    );

    expect(token).toContain('.');

    const parsed = verifyAndParseExploreCursor(token, filtersHash, secret);
    expect(parsed.offset).toBe(10);
    expect(parsed.sessionId).toBe('sess-abc-123');
    expect(parsed.filtersHash).toBe(filtersHash);
    expect(parsed.expiresAt).toBeGreaterThan(Date.now());
  });

  it('deve lançar InvalidExploreCursorError se o token for adulterado', () => {
    const filtersHash = 'abc123hash';
    const token = createExploreCursor(
      {
        offset: 5,
        sessionId: 'sess-1',
        filtersHash,
      },
      secret
    );

    const [payload, sig] = token.split('.');
    const tamperedSig = sig.slice(0, -2) + 'aa';
    const tamperedToken = `${payload}.${tamperedSig}`;

    expect(() => {
      verifyAndParseExploreCursor(tamperedToken, filtersHash, secret);
    }).toThrow(InvalidExploreCursorError);
  });

  it('deve lançar ExpiredExploreCursorError se o token estiver expirado', () => {
    const filtersHash = 'abc123hash';
    const token = createExploreCursor(
      {
        offset: 5,
        sessionId: 'sess-1',
        filtersHash,
      },
      secret
    );

    // Simula validação 20 minutos no futuro (TTL é 15 minutos)
    const futureTime = Date.now() + 20 * 60 * 1000;

    expect(() => {
      verifyAndParseExploreCursor(token, filtersHash, secret, futureTime);
    }).toThrow(ExpiredExploreCursorError);
  });

  it('deve lançar InvalidExploreCursorError se o cursor pertencer a outro conjunto de filtros', () => {
    const hashA = computeFiltersHash({ mode: 'ALL', q: 'corte' });
    const hashB = computeFiltersHash({ mode: 'NEARBY', radiusKm: 25 });

    const token = createExploreCursor(
      {
        offset: 10,
        sessionId: 'sess-1',
        filtersHash: hashA,
      },
      secret
    );

    expect(() => {
      verifyAndParseExploreCursor(token, hashB, secret);
    }).toThrow(InvalidExploreCursorError);
  });

  it('computeFiltersHash deve ser determinístico e sensível a parâmetros', () => {
    const h1 = computeFiltersHash({ mode: 'ALL', q: ' Mooca ' });
    const h2 = computeFiltersHash({ mode: 'ALL', q: 'mooca' });
    expect(h1).toBe(h2);

    const h3 = computeFiltersHash({ mode: 'NEARBY', radiusKm: 10 });
    expect(h1).not.toBe(h3);
  });
});

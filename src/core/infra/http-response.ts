export type HttpResponse = {
  statusCode: number;
  body: unknown;
  /** Cabeçalhos extras repassados ao cliente (ex.: Set-Cookie de sessão). */
  headers?: Record<string, string | string[]>;
};

export function ok<T>(dto?: T, headers?: Record<string, string | string[]>) {
  return {
    statusCode: 200,
    body: dto,
    headers,
  };
}

export function created<T>(
  dto?: T,
  headers?: Record<string, string | string[]>,
) {
  return {
    statusCode: 201,
    body: dto,
    headers,
  };
}

export function accepted<T>(dto?: T) {
  return {
    statusCode: 202,
    body: dto,
  };
}

export function noContent() {
  return {
    statusCode: 204,
    body: null,
  };
}

export function clientError<T>(dto?: T) {
  return {
    statusCode: 400,
    body: dto,
  };
}

export function unauthorized<T>(dto?: T) {
  return {
    statusCode: 401,
    body: dto,
  };
}

export function notFound<T>(dto?: T) {
  return {
    statusCode: 404,
    body: dto,
  };
}

export function conflict<T>(dto?: T) {
  return {
    statusCode: 409,
    body: dto,
  };
}

export function tooManyRequests<T>(dto?: T) {
  return {
    statusCode: 429,
    body: dto,
  };
}

export function forbidden<T>(dto?: T) {
  return {
    statusCode: 403,
    body: dto,
  };
}

export function fail(error: Error) {
  console.log(error);

  return {
    statusCode: 500,
    body: {
      error: error.message,
    },
  };
}

/** Share concurrent checks and retry transient failures instead of caching them forever. */
export function createSchemaReadinessCheck(
  check: () => Promise<boolean>,
  retryAfterMs = 2_000,
  now: () => number = Date.now,
) {
  let ready = false;
  let retryAt = 0;
  let pending: Promise<boolean> | undefined;

  return async (): Promise<boolean> => {
    if (ready) return true;
    if (pending) return pending;
    if (now() < retryAt) return false;
    pending = Promise.resolve()
      .then(check)
      .catch(() => false)
      .then((result) => {
        ready = result;
        if (!result) retryAt = now() + retryAfterMs;
        return result;
      })
      .finally(() => {
        pending = undefined;
      });
    return pending;
  };
}

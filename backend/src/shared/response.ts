// Shared response helpers
// Owner: P1
// Usage: res.json(ok(data)) or res.json(fail('message'))

export function ok<T>(data: T): { data: T; error: null } {
  return { data, error: null };
}

export function fail(message: string): { data: null; error: string } {
  return { data: null, error: message };
}


// Typed application error
// Owner: P1 — import in any module to throw a typed error

export class AppError extends Error {
  public readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    // Maintain proper prototype chain in transpiled code
    Object.setPrototypeOf(this, AppError.prototype);
  }
}


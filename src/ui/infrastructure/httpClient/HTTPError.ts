export class HTTPError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly data?: unknown;

  public constructor(message: string, statusCode: number, code?: string, data?: unknown) {
    super(message);
    this.name = "HTTPError";
    this.statusCode = statusCode;
    this.code = code ?? "HTTP/Error";
    this.data = data;
  }
}

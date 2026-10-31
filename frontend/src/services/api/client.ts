export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readError(payload: unknown, status: number): ApiError {
  if (isRecord(payload)) {
    if (typeof payload.error === 'string') {
      return new ApiError(payload.error, status, payload.error);
    }
    if (isRecord(payload.error)) {
      const code = typeof payload.error.code === 'string' ? payload.error.code : null;
      const message = typeof payload.error.message === 'string' ? payload.error.message : `HTTP ${status}`;
      return new ApiError(message, status, code);
    }
  }
  return new ApiError(`Yêu cầu HTTP thất bại với mã trạng thái ${status}.`, status);
}

export async function requestJson(path: string, init: RequestInit = {}): Promise<unknown> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(path, { ...init, headers });
  const text = await response.text();
  let payload: unknown = null;

  if (text.length > 0) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      throw new ApiError('Backend trả về dữ liệu JSON không hợp lệ.', response.status);
    }
  }

  if (!response.ok) {
    throw readError(payload, response.status);
  }
  return payload;
}

export function errorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return '';
  }
  return error instanceof Error ? error.message : 'Đã xảy ra lỗi không xác định.';
}

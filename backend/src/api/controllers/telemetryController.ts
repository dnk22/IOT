import type { RequestHandler } from "express";

import type { TelemetryRepository } from "../../repositories/telemetryRepository.js";
import {
  sendInternalError,
  sendInvalidQuery,
  sendInvalidTimeRange,
  sendNotFound,
} from "./responses.js";

const DEFAULT_HISTORY_LIMIT = 20_000;
const MAX_HISTORY_LIMIT = 20_000;
export const DEFAULT_RECENT_LIMIT = 1_800;
export const MAX_RECENT_LIMIT = 5_000;

interface ParsedHistoryQuery {
  fromMs: number;
  toMs: number;
  limit: number;
}

interface QueryResult {
  query?: ParsedHistoryQuery;
  error?: string;
  errorCode?: "INVALID_TIME_RANGE" | "INVALID_QUERY";
}

class HistoryQueryError extends Error {
  constructor(
    message: string,
    readonly code: "INVALID_TIME_RANGE" | "INVALID_QUERY",
  ) {
    super(message);
  }
}

function parseRequiredEpoch(value: unknown, name: string): number {
  if (value === undefined) {
    throw new HistoryQueryError(`Bắt buộc có tham số ${name}`, "INVALID_TIME_RANGE");
  }
  if (typeof value !== "string" || value.trim() === "") {
    throw new HistoryQueryError(
      `${name} phải là số nguyên epoch theo mili giây`,
      "INVALID_TIME_RANGE",
    );
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new HistoryQueryError(
      `${name} phải là số nguyên epoch theo mili giây và không âm`,
      "INVALID_TIME_RANGE",
    );
  }
  return parsed;
}

export function parseHistoryQuery(query: Record<string, unknown>): QueryResult {
  try {
    const fromMs = parseRequiredEpoch(query.from, "from");
    const toMs = parseRequiredEpoch(query.to, "to");
    let limit = DEFAULT_HISTORY_LIMIT;

    if (query.limit !== undefined) {
      if (typeof query.limit !== "string" || query.limit.trim() === "") {
        throw new HistoryQueryError("limit phải là số nguyên dương", "INVALID_QUERY");
      }
      limit = Number(query.limit);
      if (
        !Number.isSafeInteger(limit) ||
        limit <= 0 ||
        limit > MAX_HISTORY_LIMIT
      ) {
        throw new HistoryQueryError(
          `limit phải nằm trong khoảng từ 1 đến ${MAX_HISTORY_LIMIT}`,
          "INVALID_QUERY",
        );
      }
    }

    if (fromMs >= toMs) {
      throw new HistoryQueryError("from phải nhỏ hơn to", "INVALID_TIME_RANGE");
    }

    return { query: { fromMs, toMs, limit } };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Truy vấn lịch sử không hợp lệ",
      errorCode:
        error instanceof HistoryQueryError ? error.code : "INVALID_QUERY",
    };
  }
}

export function parseRecentLimit(value: unknown): number | null {
  if (value === undefined) {
    return DEFAULT_RECENT_LIMIT;
  }
  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }
  const limit = Number(value);
  return Number.isSafeInteger(limit) && limit > 0 && limit <= MAX_RECENT_LIMIT
    ? limit
    : null;
}

export function createLatestTelemetryController(
  repository: TelemetryRepository,
  deviceId: string,
): RequestHandler {
  return (_request, response) => {
    try {
      const telemetry = repository.findLatest(deviceId);
      if (!telemetry) {
        sendNotFound(response, "Chưa có dữ liệu cảm biến.");
        return;
      }
      response.json(telemetry);
    } catch (error) {
      sendInternalError(response, error);
    }
  };
}

export function createTelemetryHistoryController(
  repository: TelemetryRepository,
  deviceId: string,
): RequestHandler {
  return (request, response) => {
    const parsed = parseHistoryQuery(request.query);
    if (!parsed.query) {
      const message = parsed.error ?? "Truy vấn lịch sử không hợp lệ";
      if (parsed.errorCode === "INVALID_TIME_RANGE") {
        sendInvalidTimeRange(response, message);
      } else {
        sendInvalidQuery(response, message);
      }
      return;
    }

    try {
      response.json({
        items: repository.findHistory(deviceId, parsed.query),
      });
    } catch (error) {
      sendInternalError(response, error);
    }
  };
}

export function createRecentTelemetryController(
  repository: TelemetryRepository,
  deviceId: string,
): RequestHandler {
  return (request, response) => {
    const limit = parseRecentLimit(request.query.limit);
    if (limit === null) {
      sendInvalidQuery(
        response,
        `limit phải nằm trong khoảng từ 1 đến ${MAX_RECENT_LIMIT}`,
      );
      return;
    }

    try {
      response.json({ items: repository.findRecent(deviceId, limit) });
    } catch (error) {
      sendInternalError(response, error);
    }
  };
}

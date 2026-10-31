import type { Response } from "express";

import { logger } from "../../utils/logger.js";

export function sendNotFound(response: Response, message: string): void {
  response.status(404).json({
    error: { code: "NOT_FOUND", message },
  });
}

export function sendInvalidQuery(response: Response, message: string): void {
  response.status(400).json({
    error: { code: "INVALID_QUERY", message },
  });
}

export function sendInvalidTimeRange(response: Response, message: string): void {
  response.status(400).json({
    error: { code: "INVALID_TIME_RANGE", message },
  });
}

export function sendInternalError(response: Response, error: unknown): void {
  logger.error("[HTTP] Request failed", error);
  response.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "Máy chủ không thể hoàn tất yêu cầu.",
    },
  });
}

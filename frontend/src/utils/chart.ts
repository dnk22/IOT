export interface ChartStats {
  current: number | null;
  min: number | null;
  max: number | null;
  average: number | null;
}

export function getChartStats(values: Array<number | null | undefined>): ChartStats {
  const validValues = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (validValues.length === 0) {
    return { current: null, min: null, max: null, average: null };
  }

  const total = validValues.reduce((sum, value) => sum + value, 0);
  return {
    current: validValues[validValues.length - 1],
    min: Math.min(...validValues),
    max: Math.max(...validValues),
    average: total / validValues.length,
  };
}

export function formatStat(value: number | null, fractionDigits = 1): string {
  return value === null ? '--' : value.toFixed(fractionDigits);
}

export function parseDimensions(
  value: string,
  label: string
): { height: number; width: number } {
  const match = value.match(/^(\d+)(?:[x, ](\d+))?$/);
  if (!match) {
    throw new Error(`Invalid ${label}: ${value}. Use WIDTHxHEIGHT.`);
  }
  const width = Number(match[1]);
  const height = Number(match[2] ?? match[1]);
  if (width <= 0 || height <= 0) {
    throw new Error(`${label} dimensions must be positive`);
  }
  return { width, height };
}

export function parseNonNegativeInteger(value: string, label: string): number {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) {
    throw new Error(
      `${label} must be a non-negative integer; received ${value}`
    );
  }
  return number;
}

export function parsePositiveNumber(value: string, label: string): number {
  const number = parseFiniteNumber(value, label);
  if (number <= 0) {
    throw new Error(`${label} must be positive; received ${value}`);
  }
  return number;
}

export function parseFiniteNumber(value: string, label: string): number {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`${label} must be a number; received ${value}`);
  }
  return number;
}

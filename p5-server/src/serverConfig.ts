import fs from 'node:fs';
import path from 'node:path';
import type { LibraryCompatibilityPolicy, LibraryPolicy } from 'p5-analysis';

export const defaultConfigFileName = 'p5-server.config.json';

export type P5ServerConfigFile = {
  p5Version?: string;
  libraries?: LibraryPolicy;
};

/** Read an explicit config file, or p5-server.config.json beside the served
 * root when it exists. */
export function loadServerConfig(
  root: string,
  configFile?: string
): P5ServerConfigFile {
  const rootDirectory =
    fs.existsSync(root) && !fs.statSync(root).isDirectory()
      ? path.dirname(root)
      : root;
  const filename =
    configFile ?? path.join(rootDirectory, defaultConfigFileName);
  if (!fs.existsSync(filename)) {
    if (configFile) throw new Error(`Config file does not exist: ${filename}`);
    return {};
  }
  const value = JSON.parse(fs.readFileSync(filename, 'utf8')) as unknown;
  if (!isRecord(value)) throw new Error(`${filename} must contain an object`);
  rejectUnknownKeys(value, ['p5Version', 'libraries'], filename);
  if (value.p5Version !== undefined && typeof value.p5Version !== 'string') {
    throw new Error(`${filename}: p5Version must be a string`);
  }
  const libraries = validateLibraryPolicy(value.libraries, filename);
  return {
    p5Version: value.p5Version,
    libraries,
  };
}

function validateLibraryPolicy(
  value: unknown,
  filename: string
): LibraryPolicy | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    throw new Error(`${filename}: libraries must be an object`);
  }
  rejectUnknownKeys(
    value,
    ['compatibility', 'includeLegacy', 'collections', 'allow', 'deny'],
    `${filename}: libraries`
  );
  const compatibilityValues: LibraryCompatibilityPolicy[] = [
    'verified',
    'allow-unknown',
    'any',
  ];
  if (
    value.compatibility !== undefined &&
    !compatibilityValues.includes(
      value.compatibility as LibraryCompatibilityPolicy
    )
  ) {
    throw new Error(
      `${filename}: libraries.compatibility must be verified, allow-unknown, or any`
    );
  }
  if (
    value.includeLegacy !== undefined &&
    typeof value.includeLegacy !== 'boolean'
  ) {
    throw new Error(`${filename}: libraries.includeLegacy must be boolean`);
  }
  for (const key of ['collections', 'allow', 'deny'] as const) {
    if (
      value[key] !== undefined &&
      (!Array.isArray(value[key]) ||
        !value[key].every((item) => typeof item === 'string'))
    ) {
      throw new Error(`${filename}: libraries.${key} must be a string array`);
    }
  }
  return value as LibraryPolicy;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rejectUnknownKeys(
  value: Record<string, unknown>,
  allowed: string[],
  location: string
): void {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length) {
    throw new Error(`${location}: unknown option ${unknown.join(', ')}`);
  }
}

// The explicit empty data format of Commentarii. The service keeps no persistent data (guide
// bundles live in each game repository), so export writes and import verifies exactly this
// document. An unimplemented no-op is not accepted as success (service-bootstrap contract).

import { isAbsolute } from 'node:path';

export const SERVICE_ID = 'commentarii';
export const FORMAT = 'commentarii-data';
export const FORMAT_VERSION = 1;
/** The empty bundle is well under this; anything larger is not ours. */
export const MAX_BUNDLE_BYTES = 4096;

export const emptyBundle = Object.freeze({
  service: SERVICE_ID,
  format: FORMAT,
  version: FORMAT_VERSION,
  persistentData: false,
  data: Object.freeze({}),
});

/** Parses `--name value` pairs; exactly the given names, each once, absolute paths only. */
export function parseArguments(argv, names) {
  if (argv.length !== names.length * 2) throw new Error(`expected arguments: ${names.join(' ')}`);
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!names.includes(name) || result[name] !== undefined || !value) throw new Error(`expected arguments: ${names.join(' ')}`);
    result[name] = value;
  }
  for (const key of ['--input', '--output']) {
    if (result[key] !== undefined && !isAbsolute(result[key])) throw new Error(`${key} must be an absolute path`);
  }
  return result;
}

export function assertEmptyBundle(value) {
  const isObject = (candidate) => typeof candidate === 'object' && candidate !== null && !Array.isArray(candidate);
  if (!isObject(value)) throw new Error('data bundle is not a JSON object');
  if (value.service !== SERVICE_ID) throw new Error(`data bundle belongs to '${String(value.service)}', not ${SERVICE_ID}`);
  if (value.format !== FORMAT || value.version !== FORMAT_VERSION) throw new Error('unsupported data bundle format or version');
  if (value.persistentData !== false || !isObject(value.data) || Object.keys(value.data).length !== 0) {
    throw new Error('data bundle is not the empty format');
  }
  if (Object.keys(value).sort().join(',') !== 'data,format,persistentData,service,version') throw new Error('data bundle has unexpected fields');
}

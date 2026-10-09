// The secret salt of the player hashes: --player-salt, else COMMENTARII_PLAYER_SALT. There is no
// default: without a secret salt a hash of a guessable identifier could be reversed by trying
// candidates, so the import refuses to run (coding conventions 6, no silent fallback).

import { ImportError } from '../import-error.ts';

export const PLAYER_SALT_ENV = 'COMMENTARII_PLAYER_SALT';

export function resolvePlayerSalt(fromArgument: string | undefined, fromEnvironment: string | undefined): string {
  const salt = fromArgument ?? fromEnvironment;
  if (salt === undefined || salt === '') {
    throw new ImportError(`no player salt: set ${PLAYER_SALT_ENV} (or pass --player-salt); player identifiers are only written as salted hashes`);
  }
  return salt;
}

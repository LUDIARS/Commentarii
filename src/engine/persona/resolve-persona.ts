// Picks the persona for --persona <slug>. Commentarii ships game-independent personas
// (personas/ at the package root) and a bundle may keep game-specific ones (<bundle>/personas/);
// a bundle persona wins over a shipped one with the same slug (design 14.E).

import type { Persona } from './persona.ts';

export interface PersonaDocument {
  /** Where it was read from, for error messages. */
  readonly origin: string;
  readonly data: unknown;
}

export interface PersonaSource {
  /** The bundle's persona with this slug, if the bundle has one. */
  readBundlePersona(bundleDir: string, slug: string): Promise<PersonaDocument | undefined>;
  /** The shipped persona with this slug, if Commentarii ships one. */
  readShippedPersona(slug: string): Promise<PersonaDocument | undefined>;
  /** Slugs of the shipped personas, for the error message when nothing is found. */
  listShippedPersonas(): Promise<readonly string[]>;
}

/** Schema problems of a persona document (empty when it is valid). */
export type PersonaValidator = (data: unknown) => readonly string[];

export class PersonaError extends Error {
  override readonly name = 'PersonaError';
}

const SLUG = /^[a-z0-9][a-z0-9_-]*$/;

/** Bundle first, then shipped. A document that fails the schema is an error, never skipped. */
export async function resolvePersona(source: PersonaSource, validate: PersonaValidator, bundleDir: string, slug: string): Promise<Persona> {
  if (!SLUG.test(slug)) throw new PersonaError(`persona '${slug}' is not a slug`);
  const found = (await source.readBundlePersona(bundleDir, slug)) ?? (await source.readShippedPersona(slug));
  if (found === undefined) {
    const shipped = await source.listShippedPersonas();
    throw new PersonaError(`persona '${slug}' is neither in the bundle's personas/ nor shipped (shipped: ${shipped.join(', ')})`);
  }
  const problems = validate(found.data);
  if (problems.length > 0) throw new PersonaError(`persona ${found.origin} is invalid: ${problems.join('; ')}`);
  const persona = found.data as Persona;
  if (persona.slug !== slug) throw new PersonaError(`persona ${found.origin} declares slug '${persona.slug}', expected '${slug}'`);
  return persona;
}

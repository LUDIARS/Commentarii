// Locates an executable on PATH the way a shell would: each PATH directory in order, and on
// Windows each PATHEXT extension (npm installs `ingenium.cmd` there). undefined when absent.

import { existsSync, statSync } from 'node:fs';
import { delimiter, join } from 'node:path';

export interface PathEnvironment {
  readonly PATH?: string | undefined;
  readonly Path?: string | undefined;
  readonly PATHEXT?: string | undefined;
}

function isFile(path: string): boolean {
  return existsSync(path) && statSync(path).isFile();
}

export function findOnPath(name: string, env: PathEnvironment, platform: NodeJS.Platform = process.platform): string | undefined {
  const directories = (env.PATH ?? env.Path ?? '').split(platform === 'win32' ? ';' : delimiter).filter((entry) => entry !== '');
  // A bare name on Windows is not runnable (npm writes a shell script there for Git Bash): extensions only.
  const extensions = platform === 'win32' ? (env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';').filter((entry) => entry !== '').map((entry) => entry.toLowerCase()) : [''];
  for (const directory of directories) {
    for (const extension of extensions) {
      const candidate = join(directory, `${name}${extension}`);
      if (isFile(candidate)) return candidate;
    }
  }
  return undefined;
}

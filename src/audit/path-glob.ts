// Glob over POSIX paths for `audit.allow[].pattern`: `**` crosses directories, `*` and `?`
// stay inside one segment. A pattern without `/` matches the file name at any depth.

function escape(char: string): string {
  return /[.+^${}()|[\]\\]/.test(char) ? `\\${char}` : char;
}

export function globToRegExp(pattern: string): RegExp {
  const anchored = pattern.includes('/') ? pattern : `**/${pattern}`;
  let source = '';
  for (let index = 0; index < anchored.length; index += 1) {
    const char = anchored[index] ?? '';
    if (char === '*' && anchored[index + 1] === '*') {
      if (anchored[index + 2] === '/') {
        source += '(?:.*/)?';
        index += 2;
      } else {
        source += '.*';
        index += 1;
      }
    } else if (char === '*') {
      source += '[^/]*';
    } else if (char === '?') {
      source += '[^/]';
    } else {
      source += escape(char);
    }
  }
  return new RegExp(`^${source}$`);
}

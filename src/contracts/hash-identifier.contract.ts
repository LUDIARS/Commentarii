// C-43 hashIdentifier(salt, identifier): needs a non-empty salt and returns 16 lowercase hex
// digits that differ from the identifier itself (the raw identifier is never the output).

export default {
  pre: (salt: string) => (typeof salt === 'string' && salt !== '' ? true : 'the salt must be a non-empty secret'),
  post: (hash: string, _salt: string, identifier: string) => {
    if (!/^[0-9a-f]{16}$/.test(hash)) return 'the hash is not 16 hex digits';
    return hash === identifier ? 'the hash equals the raw identifier' : true;
  },
};

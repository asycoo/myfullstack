const WEAK_PASSWORDS = new Set([
  "12345678",
  "password",
  "qwerty",
  "11111111",
  "00000000",
  "abcdefgh",
]);

export function normalizePassword(pw: string) {
  return pw.trim().toLowerCase();
}

export function isWeakPassword(pw: string) {
  return WEAK_PASSWORDS.has(normalizePassword(pw));
}


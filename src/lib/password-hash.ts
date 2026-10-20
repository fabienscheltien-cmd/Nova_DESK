/**
 * Hachage des mots de passe des comptes accueil.
 * Format actuel : `pbkdf2:<iterations>:<selHex>:<hachéHex>` (PBKDF2-SHA256, Web Crypto).
 * Format historique accepté en lecture : empreinte SHA-256 hexadécimale (64 caractères),
 * pour que les comptes existants migrés depuis le stockage en clair continuent de se connecter.
 */

const ITERATIONS = 100_000;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** Comparaison à temps constant de deux chaînes hexadécimales. */
function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function pbkdf2Hex(pw: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    key,
    256,
  );
  return toHex(new Uint8Array(bits));
}

/** Hache un mot de passe pour stockage (sel aléatoire à chaque appel). */
export async function hashPassword(pw: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2:${ITERATIONS}:${toHex(salt)}:${await pbkdf2Hex(pw, salt, ITERATIONS)}`;
}

/** Vérifie un mot de passe contre un haché stocké (PBKDF2 ou empreinte SHA-256 historique). */
export async function verifyPassword(pw: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  if (stored.startsWith("pbkdf2:")) {
    const parts = stored.split(":");
    if (parts.length !== 4) return false;
    const [, it, saltHex, hashHex] = parts;
    if (!it || !saltHex || !hashHex) return false;
    const iterations = Number(it);
    if (!Number.isInteger(iterations) || iterations < 1 || iterations > 1_000_000) return false;
    const candidate = await pbkdf2Hex(pw, fromHex(saltHex), iterations);
    return safeEqualHex(candidate, hashHex.toLowerCase());
  }
  // Empreinte SHA-256 historique (migration depuis le stockage en clair).
  if (!/^[0-9a-f]{64}$/i.test(stored)) return false;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pw));
  return safeEqualHex(toHex(new Uint8Array(digest)), stored.toLowerCase());
}

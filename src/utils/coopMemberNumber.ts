const COOP_MEMBER_NUMBER_LENGTH = 8;
const COOP_MEMBER_NUMBER_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export function generateCoopMemberNumber(): string {
  let value = '';
  for (let i = 0; i < COOP_MEMBER_NUMBER_LENGTH; i += 1) {
    const index = Math.floor(Math.random() * COOP_MEMBER_NUMBER_CHARSET.length);
    value += COOP_MEMBER_NUMBER_CHARSET[index];
  }
  return value;
}

export function normalizeCoopMemberNumber(value: string | number | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const normalized = String(value).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return normalized.length > 0 ? normalized : null;
}

export function formatCoopMemberNumber(value: string | number | null | undefined): string {
  const normalized = normalizeCoopMemberNumber(value);
  if (!normalized) {
    return '';
  }
  if (normalized.length <= 4) {
    return normalized;
  }
  return `${normalized.slice(0, 4)}-${normalized.slice(4)}`;
}

export async function findUniqueCoopMemberNumber(
  isAvailable: (candidate: string) => Promise<boolean>,
  maxAttempts = 25,
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = generateCoopMemberNumber();
    const available = await isAvailable(candidate);
    if (available) {
      return candidate;
    }
  }
  throw new Error('Unable to generate a unique coop member number.');
}

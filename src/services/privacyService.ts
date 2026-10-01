/**
 * Privacy and Data Protection Utilities.
 * Enforces requirement:
 * - Never show full email address or phone number to other users.
 * - Mask emails (e.g., 24***@gmail.com) and phones (e.g., 96*****75).
 * - A finder must never see owner contact info. Contact between owner and finder
 *   happens only through the admin/security desk.
 */

export function maskEmail(email?: string): string {
  if (!email || !email.includes('@')) return 'Protected User';
  const [local, domain] = email.trim().split('@');
  if (local.length <= 2) {
    return `${local[0] || '*'}***@${domain}`;
  }
  const prefix = local.slice(0, 2);
  return `${prefix}***@${domain}`;
}

export function maskPhone(phone?: string): string {
  if (!phone) return 'Protected';
  const clean = phone.replace(/\D/g, '');
  if (clean.length < 5) return '***-***';
  const start = clean.slice(0, 2);
  const end = clean.slice(-2);
  return `${start}*****${end}`;
}

export function maskName(name?: string): string {
  if (!name) return 'Student';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const lastInitial = parts[parts.length - 1][0]?.toUpperCase() || '';
  return `${first} ${lastInitial}.`;
}

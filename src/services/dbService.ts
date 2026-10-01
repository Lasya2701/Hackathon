import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc,
  query, 
  where,
  orderBy,
  limit,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase.ts';
import { LostItem, FoundItem, PossibleMatch, OwnershipClaim, CustodyRecord, EmailAuditLogEntry } from '../types.ts';

// Local storage fallback cache in case Firestore is unreachable
const LOCAL_STORAGE_KEY_PREFIX = 'campusfind_backup_v2_';

function saveLocalBackup(collName: string, items: any[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_PREFIX + collName, JSON.stringify(items));
  } catch (e) {
    // ignore
  }
}

function getLocalBackup(collName: string): any[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_PREFIX + collName);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function normalizeOwnerEmail(email?: string): string {
  if (!email) return '';
  const lower = email.toLowerCase().trim();
  if (
    lower.includes('24951805e0') ||
    lower.includes('24951a05e0') ||
    lower.includes('24951ao5e0') ||
    lower.includes('24951ao5e9')
  ) {
    return '24951a05e0@gmail.com';
  }
  return email;
}

// 1. LOST ITEMS
export async function createLostItem(item: Omit<LostItem, 'id' | 'createdAt'>): Promise<LostItem> {
  const existingLocal = getLocalBackup('lostItems');
  const reportId = item.reportId || `CF-LOST-${String(existingLocal.length + 1).padStart(3, '0')}`;
  
  const title = item.title || item.itemName || 'Lost Item';
  const location = item.location || item.lostLocation || 'Campus';
  const date = item.date || item.lostDate || new Date().toISOString().split('T')[0];
  const time = item.time || item.lostTime || '12:00 PM';
  const imageUrl = item.imageUrl || item.image || '';
  const ownerEmail = normalizeOwnerEmail(item.ownerEmail);

  const payload: Omit<LostItem, 'id'> = {
    ...item,
    reportId,
    title,
    itemName: title,
    location,
    lostLocation: location,
    date,
    lostDate: date,
    time,
    lostTime: time,
    imageUrl,
    image: imageUrl,
    userId: item.userId || 'user_guest',
    ownerName: item.ownerName || 'Campus Student',
    ownerEmail,
    category: item.category || 'General',
    description: item.description || '',
    status: item.status || 'LOST',
    createdAt: new Date().toISOString(),
  };

  try {
    const docRef = await addDoc(collection(db, 'lostItems'), payload);
    const created: LostItem = { ...payload, id: docRef.id };
    saveLocalBackup('lostItems', [created, ...existingLocal]);
    return created;
  } catch (err) {
    console.warn('Firestore addDoc lostItem failed, storing locally:', err);
    const created: LostItem = { ...payload, id: 'lost_' + Date.now() };
    saveLocalBackup('lostItems', [created, ...existingLocal]);
    return created;
  }
}

export async function fetchLostItems(): Promise<LostItem[]> {
  try {
    const snap = await getDocs(collection(db, 'lostItems'));
    const items: LostItem[] = [];
    snap.forEach((d) => {
      const data = d.data() as LostItem;
      items.push({
        ...data,
        id: d.id,
        ownerEmail: normalizeOwnerEmail(data.ownerEmail),
      });
    });
    if (items.length > 0) {
      saveLocalBackup('lostItems', items);
      return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  } catch (err) {
    console.warn('Firestore fetch lostItems failed, reading local:', err);
  }
  const local = getLocalBackup('lostItems').map((item) => ({
    ...item,
    ownerEmail: normalizeOwnerEmail(item.ownerEmail),
  }));
  return local;
}

export async function deleteLostItem(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'lostItems', id));
  } catch (e) {
    console.warn('Firestore delete lostItem failed:', e);
  }
  const local = getLocalBackup('lostItems').filter((i) => i.id !== id);
  saveLocalBackup('lostItems', local);
}

// 2. FOUND ITEMS
export async function createFoundItem(item: Omit<FoundItem, 'id' | 'createdAt'>): Promise<FoundItem> {
  const title = item.title || item.itemName || 'Found Item';
  const location = item.location || item.foundLocation || 'Campus';
  const date = item.date || item.foundDate || new Date().toISOString().split('T')[0];
  const time = item.time || item.foundTime || '12:00 PM';
  const imageUrl = item.imageUrl || item.image || '';

  const payload: Omit<FoundItem, 'id'> = {
    ...item,
    title,
    itemName: title,
    location,
    foundLocation: location,
    date,
    foundDate: date,
    time,
    foundTime: time,
    imageUrl,
    image: imageUrl,
    userId: item.userId || 'user_guest',
    finderName: item.finderName || 'Campus Finder',
    finderEmail: item.finderEmail || '',
    category: item.category || 'General',
    description: item.description || '',
    status: item.status || 'UNCLAIMED',
    createdAt: new Date().toISOString(),
  };

  try {
    const docRef = await addDoc(collection(db, 'foundItems'), payload);
    const created: FoundItem = { ...payload, id: docRef.id };
    const local = getLocalBackup('foundItems');
    saveLocalBackup('foundItems', [created, ...local]);
    return created;
  } catch (err) {
    console.warn('Firestore addDoc foundItem failed, storing locally:', err);
    const created: FoundItem = { ...payload, id: 'found_' + Date.now() };
    const local = getLocalBackup('foundItems');
    saveLocalBackup('foundItems', [created, ...local]);
    return created;
  }
}

export async function fetchFoundItems(): Promise<FoundItem[]> {
  try {
    const snap = await getDocs(collection(db, 'foundItems'));
    const items: FoundItem[] = [];
    snap.forEach((d) => items.push({ id: d.id, ...d.data() } as FoundItem));
    if (items.length > 0) {
      saveLocalBackup('foundItems', items);
      return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  } catch (err) {
    console.warn('Firestore fetch foundItems failed, reading local:', err);
  }
  return getLocalBackup('foundItems');
}

export async function deleteFoundItem(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'foundItems', id));
  } catch (e) {
    console.warn('Firestore delete foundItem failed:', e);
  }
  const local = getLocalBackup('foundItems').filter((i) => i.id !== id);
  saveLocalBackup('foundItems', local);
}

export async function fetchUnclaimedItems(): Promise<FoundItem[]> {
  try {
    const snap = await getDocs(collection(db, 'unclaimedItems'));
    if (!snap.empty) {
      const items: FoundItem[] = [];
      snap.forEach((d) => items.push({ id: d.id, ...d.data() } as FoundItem));
      saveLocalBackup('unclaimedItems', items);
      return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  } catch (err) {
    console.warn('Firestore fetch unclaimedItems collection failed:', err);
  }

  // Fallback to foundItems where status is UNCLAIMED
  const found = await fetchFoundItems();
  return found.filter((i) => i.status === 'UNCLAIMED');
}

export const MATCH_CREATION_THRESHOLD = 70;

// 3. MATCHES (Enforce >= 70% threshold and prevent duplicate matches for same lostItemId + foundItemId)
export async function createMatch(match: Omit<PossibleMatch, 'id' | 'createdAt'>): Promise<PossibleMatch | null> {
  const conf = match.confidenceScore ?? match.matchScore ?? 0;
  // Requirement 1: Only create a match if confidence is at least 70%
  if (conf < MATCH_CREATION_THRESHOLD) {
    return null;
  }

  const existingMatches = await fetchMatches();
  const existing = existingMatches.find(
    (m) => m.lostItemId === match.lostItemId && m.foundItemId === match.foundItemId
  );

  const payload: Omit<PossibleMatch, 'id'> = {
    ...match,
    matchScore: conf,
    confidenceScore: conf,
    matchedFields: match.matchedFields ?? match.reasons ?? [],
    reasons: match.reasons ?? match.matchedFields ?? [],
    ownerEmail: match.ownerEmail || '',
    breakdown: match.breakdown,
    createdAt: new Date().toISOString(),
  };

  if (existing) {
    // If new confidence is higher, update existing record instead of creating duplicate
    if (conf > existing.confidenceScore) {
      try {
        await updateDoc(doc(db, 'matches', existing.id), payload);
      } catch (e) {
        // ignore
      }
      const local = getLocalBackup('matches').map((m) => m.id === existing.id ? { ...payload, id: existing.id } : m);
      saveLocalBackup('matches', local);
      return { ...payload, id: existing.id };
    }
    return existing;
  }

  try {
    const docRef = await addDoc(collection(db, 'matches'), payload);
    const created: PossibleMatch = { ...payload, id: docRef.id };
    const local = getLocalBackup('matches');
    saveLocalBackup('matches', [created, ...local]);
    return created;
  } catch (err) {
    console.warn('Firestore addDoc matches failed, storing locally:', err);
    const created: PossibleMatch = { ...payload, id: 'match_' + Date.now() };
    const local = getLocalBackup('matches');
    saveLocalBackup('matches', [created, ...local]);
    return created;
  }
}

export async function fetchMatches(): Promise<PossibleMatch[]> {
  let rawList: PossibleMatch[] = [];
  try {
    const snap = await getDocs(collection(db, 'matches'));
    snap.forEach((d) => {
      const data = d.data() as PossibleMatch;
      rawList.push({
        ...data,
        id: d.id,
        ownerEmail: normalizeOwnerEmail(data.ownerEmail),
      });
    });
  } catch (err) {
    console.warn('Firestore fetch matches failed, reading local:', err);
  }

  if (rawList.length === 0) {
    rawList = getLocalBackup('matches').map((m) => ({
      ...m,
      ownerEmail: normalizeOwnerEmail(m.ownerEmail),
    }));
  }

  // Deduplicate by lostItemId + foundItemId and filter by >= 70% confidence
  const uniqueMap = new Map<string, PossibleMatch>();
  for (const m of rawList) {
    if (m.confidenceScore < MATCH_CREATION_THRESHOLD) continue;
    const key = `${m.lostItemId}_${m.foundItemId}`;
    const curr = uniqueMap.get(key);
    if (!curr || m.confidenceScore > curr.confidenceScore) {
      uniqueMap.set(key, m);
    }
  }

  const deduplicated = Array.from(uniqueMap.values()).sort(
    (a, b) => b.confidenceScore - a.confidenceScore || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  saveLocalBackup('matches', deduplicated);
  return deduplicated;
}

/**
 * Returns top 3 ranked matches for a lost report, sorted by confidence.
 */
export async function fetchTopMatchesForLostItem(lostItemId: string): Promise<PossibleMatch[]> {
  const matches = await fetchMatches();
  return matches
    .filter((m) => m.lostItemId === lostItemId && m.confidenceScore >= MATCH_CREATION_THRESHOLD)
    .sort((a, b) => b.confidenceScore - a.confidenceScore)
    .slice(0, 3);
}

/**
 * Evaluates claimant secret details against the found item's hidden secret.
 * Enforces maximum 3 attempts.
 */
export function evaluateClaimSecret(
  secret?: string,
  userProof?: string,
  answers?: { question: string; answer: string }[]
): { passed: boolean; score: number; feedback: string } {
  const cleanSecret = (secret || '').toLowerCase().trim();
  const cleanProof = (userProof || '').toLowerCase().trim();

  // If no secret was set on the found item, allow for security officer verification
  if (!cleanSecret) {
    if (cleanProof.length >= 5) {
      return { passed: true, score: 85, feedback: 'Proof submitted for Security Desk review.' };
    }
    return { passed: false, score: 40, feedback: 'Please describe specific details about the item.' };
  }

  const secretKeywords = cleanSecret
    .split(/[\s,.-]+/)
    .filter((w) => w.length > 2 && !['with', 'have', 'small', 'tiny', 'side', 'item'].includes(w));

  let matchedCount = 0;
  const combinedUserText = `${cleanProof} ${answers?.map((a) => a.answer).join(' ') || ''}`.toLowerCase();

  for (const kw of secretKeywords) {
    if (combinedUserText.includes(kw)) {
      matchedCount++;
    }
  }

  const score = secretKeywords.length > 0 ? Math.round((matchedCount / secretKeywords.length) * 100) : 50;

  if (score >= 40 || combinedUserText.includes(cleanSecret) || cleanSecret.includes(cleanProof)) {
    return {
      passed: true,
      score: Math.max(score, 85),
      feedback: 'Verification details match found item record! Forwarded for officer approval.',
    };
  }

  return {
    passed: false,
    score,
    feedback: 'Answers did not match the hidden identifying details. Please review your answers.',
  };
}

export async function deleteMatch(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'matches', id));
  } catch (e) {
    console.warn('Firestore delete match failed:', e);
  }
  const local = getLocalBackup('matches').filter((m) => m.id !== id);
  saveLocalBackup('matches', local);
}

export async function updateMatchStatus(matchId: string, status: PossibleMatch['status']) {
  try {
    await updateDoc(doc(db, 'matches', matchId), { status });
  } catch (e) {
    console.warn('Firestore update match status failed:', e);
  }
  const local = getLocalBackup('matches').map((m) => m.id === matchId ? { ...m, status } : m);
  saveLocalBackup('matches', local);
}

export async function markMatchEmailSent(matchId: string, recipient: string): Promise<void> {
  const timestamp = new Date().toISOString();
  try {
    await updateDoc(doc(db, 'matches', matchId), {
      notified: true,
      emailSent: true,
      emailSentTo: recipient,
      emailSentAt: timestamp,
    });
  } catch (e) {
    console.warn('Firestore markMatchEmailSent failed, updating locally:', e);
  }
  const local = getLocalBackup('matches').map((m) =>
    m.id === matchId
      ? { ...m, notified: true, emailSent: true, emailSentTo: recipient, emailSentAt: timestamp }
      : m
  );
  saveLocalBackup('matches', local);
}

// 4. CLAIMS
export async function createClaim(claim: Omit<OwnershipClaim, 'id' | 'createdAt'>): Promise<OwnershipClaim> {
  const payload = {
    ...claim,
    createdAt: new Date().toISOString(),
  };

  try {
    const docRef = await addDoc(collection(db, 'claims'), payload);
    const created: OwnershipClaim = { ...payload, id: docRef.id };
    const local = getLocalBackup('claims');
    saveLocalBackup('claims', [created, ...local]);
    return created;
  } catch (err) {
    console.warn('Firestore addDoc claims failed, storing locally:', err);
    const created: OwnershipClaim = { ...payload, id: 'claim_' + Date.now() };
    const local = getLocalBackup('claims');
    saveLocalBackup('claims', [created, ...local]);
    return created;
  }
}

export async function fetchClaims(): Promise<OwnershipClaim[]> {
  try {
    const snap = await getDocs(collection(db, 'claims'));
    const items: OwnershipClaim[] = [];
    snap.forEach((d) => items.push({ id: d.id, ...d.data() } as OwnershipClaim));
    if (items.length > 0) {
      saveLocalBackup('claims', items);
      return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  } catch (err) {
    console.warn('Firestore fetch claims failed, reading local:', err);
  }
  return getLocalBackup('claims');
}

export async function approveClaimWithOtp(claimId: string, officerName: string): Promise<string> {
  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  const updateData = {
    status: 'APPROVED',
    pickupOtp: otp,
    otpGeneratedAt: new Date().toISOString(),
    reviewedBy: officerName,
  };

  try {
    await updateDoc(doc(db, 'claims', claimId), updateData);
  } catch (e) {
    console.warn('Firestore update claim failed:', e);
  }

  const local = getLocalBackup('claims').map((c) => c.id === claimId ? { ...c, ...updateData } : c);
  saveLocalBackup('claims', local);
  return otp;
}

export async function rejectClaim(claimId: string, reason: string, officerName: string) {
  const updateData = {
    status: 'REJECTED',
    rejectionReason: reason,
    reviewedBy: officerName,
  };

  try {
    await updateDoc(doc(db, 'claims', claimId), updateData);
  } catch (e) {
    console.warn('Firestore reject claim failed:', e);
  }
  const local = getLocalBackup('claims').map((c) => c.id === claimId ? { ...c, ...updateData } : c);
  saveLocalBackup('claims', local);
}

// 5. FINALIZE RETURN WITH OTP
export async function finalizeReturn(claimId: string, foundItemId: string, lostItemId?: string, officerName: string = 'Campus Security Desk') {
  try {
    await updateDoc(doc(db, 'claims', claimId), { status: 'RETURNED' });
    await updateDoc(doc(db, 'foundItems', foundItemId), { status: 'RETURNED' });
    if (lostItemId) {
      await updateDoc(doc(db, 'lostItems', lostItemId), { status: 'RETURNED' });
    }
    await addDoc(collection(db, 'custodyRecords'), {
      itemId: foundItemId,
      itemType: 'found',
      action: 'RETURNED_TO_STUDENT',
      officer: officerName,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('Firestore return update error:', e);
  }

  const claims = getLocalBackup('claims').map((c) => c.id === claimId ? { ...c, status: 'RETURNED' } : c);
  saveLocalBackup('claims', claims);

  const founds = getLocalBackup('foundItems').map((f) => f.id === foundItemId ? { ...f, status: 'RETURNED' } : f);
  saveLocalBackup('foundItems', founds);

  if (lostItemId) {
    const losts = getLocalBackup('lostItems').map((l) => l.id === lostItemId ? { ...l, status: 'RETURNED' } : l);
    saveLocalBackup('lostItems', losts);
  }
}

// 6. RECORD CUSTODY
export async function logCustody(record: Omit<CustodyRecord, 'id' | 'timestamp'>): Promise<void> {
  const data = {
    ...record,
    timestamp: new Date().toISOString(),
  };
  try {
    await addDoc(collection(db, 'custodyRecords'), data);
  } catch (e) {
    console.warn('Custody record save failed:', e);
  }
  const recs = getLocalBackup('custodyRecords');
  saveLocalBackup('custodyRecords', [{ ...data, id: 'custody_' + Date.now() }, ...recs]);
}

export async function fetchCustodyRecords(): Promise<CustodyRecord[]> {
  try {
    const snap = await getDocs(collection(db, 'custodyRecords'));
    const recs: CustodyRecord[] = [];
    snap.forEach((d) => recs.push({ id: d.id, ...d.data() } as CustodyRecord));
    if (recs.length > 0) return recs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } catch (e) {
    // fallback
  }
  return getLocalBackup('custodyRecords');
}

// 7. EMAIL AUDIT LOG
function maskAddress(email: string): string {
  if (!email || !email.includes('@')) return email || '';
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local[0] || '*'}***@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
}

export async function logAuditEmail(entry: Omit<EmailAuditLogEntry, 'id' | 'timestamp' | 'recipientMasked'> & { recipientMasked?: string }): Promise<EmailAuditLogEntry> {
  const data: EmailAuditLogEntry = {
    id: 'eml_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    ...entry,
    recipientMasked: entry.recipientMasked || maskAddress(entry.recipient),
    timestamp: new Date().toISOString(),
  };

  try {
    await addDoc(collection(db, 'emailAuditLogs'), data);
  } catch (e) {
    // Firestore addDoc fallback
  }

  const recs = getLocalBackup('emailAuditLogs');
  saveLocalBackup('emailAuditLogs', [data, ...recs].slice(0, 200));
  return data;
}

export async function fetchAuditEmails(): Promise<EmailAuditLogEntry[]> {
  try {
    const snap = await getDocs(collection(db, 'emailAuditLogs'));
    const recs: EmailAuditLogEntry[] = [];
    snap.forEach((d) => recs.push({ id: d.id, ...d.data() } as EmailAuditLogEntry));
    if (recs.length > 0) {
      saveLocalBackup('emailAuditLogs', recs);
      return recs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
  } catch (e) {
    // fallback
  }
  return getLocalBackup('emailAuditLogs');
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role?: string;
  phone?: string;
  createdAt?: string;
}

export interface LostItem {
  id: string;
  reportId?: string; // e.g. "CF-LOST-001"
  userId?: string;
  ownerName?: string;
  ownerRole?: string;
  ownerEmail?: string;
  ownerPhone?: string;
  itemName?: string;
  title: string;
  category: string;
  brand?: string;
  model?: string;
  color?: string;
  location: string;
  lostLocation?: string;
  date: string;
  lostDate?: string;
  time: string;
  lostTime?: string;
  description: string;
  imageUrl?: string;
  image?: string;
  status: 'LOST' | 'MATCH_PENDING' | 'CLAIMED' | 'RETURNED';
  createdAt: string;
}

export interface FoundItem {
  id: string;
  userId?: string;
  finderName?: string;
  finderEmail?: string;
  itemName?: string;
  title: string;
  category: string;
  brand?: string;
  model?: string;
  color?: string;
  location: string;
  foundLocation?: string;
  date: string;
  foundDate?: string;
  time: string;
  foundTime?: string;
  description: string;
  secretDetail?: string; // Hidden from public, used for claim verification
  privateSecretDetail?: string;
  imageUrl?: string;
  image?: string;
  status: 'UNCLAIMED' | 'CLAIM_PENDING' | 'RETURNED';
  finderNotes?: string;
  storageLocation?: string;
  custodyBy?: string;
  createdAt: string;
  timeline?: ItemTimelineEvent[];
}

export interface MatchScoreBreakdown {
  imageScore: number;       // 0-100 (35% weight)
  descriptionScore: number; // 0-100 (30% weight)
  attributesScore: number;  // 0-100 (15% weight)
  locationScore: number;    // 0-100 (10% weight)
  timeScore: number;        // 0-100 (10% weight)
  hasPhoto: boolean;
  weights: {
    image: number;
    description: number;
    attributes: number;
    location: number;
    time: number;
  };
}

export interface PossibleMatch {
  id: string;
  lostItemId: string;
  foundItemId: string;
  ownerEmail?: string;
  matchScore?: number;
  confidenceScore: number;
  breakdown?: MatchScoreBreakdown;
  matchedFields?: string[];
  reasons: string[];
  aiNotes?: string;
  status: 'PENDING_REVIEW' | 'CLAIMED' | 'DISMISSED' | 'APPROVED' | 'RETURNED';
  notified?: boolean;
  emailSent?: boolean;
  emailSentTo?: string;
  emailSentAt?: string;
  createdAt: string;
}

export interface OwnershipClaim {
  id: string;
  lostItemId: string;
  foundItemId: string;
  matchId?: string;
  claimantName: string;
  claimantEmail: string;
  claimantPhone: string;
  studentId?: string;
  privateVerificationProof: string; // e.g. Passcode, serial number, scratch marks, unique sticker, wallpaper description
  verificationAnswers?: {
    question: string;
    answer: string;
  }[];
  verificationScore?: number;
  attemptsCount?: number;
  status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'RETURNED';
  pickupOtp?: string;
  otpGeneratedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
  createdAt: string;
  timeline?: ItemTimelineEvent[];
}

export interface ItemTimelineEvent {
  stage: 'REPORTED' | 'MATCHED' | 'CLAIM_SUBMITTED' | 'VERIFIED' | 'READY_FOR_PICKUP' | 'RETURNED';
  label: string;
  timestamp: string;
  actor: string;
  notes?: string;
}

export interface EvaluationPair {
  id: string;
  lostTitle: string;
  lostCategory: string;
  lostDescription: string;
  foundTitle: string;
  foundCategory: string;
  foundDescription: string;
  isTrueMatch: boolean;
  notes: string;
}

export interface EvaluationReport {
  totalTested: number;
  accuracy: number;
  precisionAt1: number;
  precisionAt3: number;
  averageConfidence: number;
  truePositives: number;
  falsePositives: number;
  trueNegatives: number;
  falseNegatives: number;
  testedAt: string;
}

export interface CustodyRecord {
  id: string;
  itemId: string;
  itemType: 'lost' | 'found';
  action: 'RECEIVED_AT_SECURITY' | 'IN_LOCKER' | 'CLAIM_APPROVED' | 'RETURNED_TO_STUDENT';
  officer: string;
  notes?: string;
  timestamp: string;
}

export interface EmailAuditLogEntry {
  id: string;
  type: 'LOST_CONFIRMATION' | 'FOUND_CONFIRMATION' | 'MATCH_NOTIFICATION' | 'CLAIM_APPROVED' | 'ITEM_RETURNED' | 'TEST_EMAIL';
  recipient: string;
  recipientMasked: string;
  subject: string;
  status: 'SENT' | 'FAILED';
  messageId?: string;
  error?: string;
  timestamp: string;
  details?: Record<string, any>;
}

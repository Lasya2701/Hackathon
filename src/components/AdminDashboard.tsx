import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  ShieldCheck, 
  Search, 
  Check, 
  X, 
  Key, 
  Package, 
  CheckCircle2, 
  Clock, 
  UserCheck, 
  AlertCircle,
  FileText,
  Lock,
  PlusCircle,
  Trash2,
  Mail,
  MapPin,
  Send,
  RefreshCw,
  MailCheck
} from 'lucide-react';
import { 
  fetchLostItems, 
  fetchFoundItems, 
  fetchMatches, 
  fetchClaims, 
  approveClaimWithOtp, 
  rejectClaim, 
  finalizeReturn,
  logCustody,
  fetchCustodyRecords,
  createFoundItem,
  deleteLostItem,
  deleteFoundItem,
  deleteMatch,
  fetchAuditEmails
} from '../services/dbService.ts';
import { 
  sendClaimApprovedEmail, 
  sendItemReturnedEmail, 
  sendTestEmail, 
  fetchServerEmailLogs, 
  fetchSmtpStatus 
} from '../services/emailService.ts';
import { LostItem, FoundItem, PossibleMatch, OwnershipClaim, CustodyRecord, EmailAuditLogEntry } from '../types.ts';
import { maskEmail } from '../services/privacyService.ts';
import confetti from 'canvas-confetti';

interface AdminDashboardProps {
  onBack: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<'claims' | 'matches' | 'lost' | 'found' | 'custody' | 'emails' | 'walkin'>('claims');
  const [claims, setClaims] = useState<OwnershipClaim[]>([]);
  const [lostItems, setLostItems] = useState<LostItem[]>([]);
  const [foundItems, setFoundItems] = useState<FoundItem[]>([]);
  const [matches, setMatches] = useState<PossibleMatch[]>([]);
  const [custodyRecords, setCustodyRecords] = useState<CustodyRecord[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailAuditLogEntry[]>([]);
  const [smtpStatus, setSmtpStatus] = useState<{
    configured: boolean;
    host: string;
    user: string;
    port: number;
    from: string;
    missingVariables?: string[];
  } | null>(null);
  const [testEmailRecipient, setTestEmailRecipient] = useState('24951a05e0@gmail.com');
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{ success: boolean; message: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // Return verification OTP dialog state
  const [verifyingClaim, setVerifyingClaim] = useState<OwnershipClaim | null>(null);
  const [enteredOtp, setEnteredOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [officerName, setOfficerName] = useState('Officer J. Martinez (Desk 1)');

  // Walk-in found item state
  const [walkinTitle, setWalkinTitle] = useState('');
  const [walkinCategory, setWalkinCategory] = useState('Charger');
  const [walkinBrand, setWalkinBrand] = useState('');
  const [walkinModel, setWalkinModel] = useState('');
  const [walkinColor, setWalkinColor] = useState('');
  const [walkinLocation, setWalkinLocation] = useState('Security Main Desk');
  const [walkinStorage, setWalkinStorage] = useState('Vault Shelf B-02');
  const [walkinDesc, setWalkinDesc] = useState('');

  const loadAll = async () => {
    setLoading(true);
    try {
      const [c, l, f, m, cust, serverLogs, localLogs, smtp] = await Promise.all([
        fetchClaims(),
        fetchLostItems(),
        fetchFoundItems(),
        fetchMatches(),
        fetchCustodyRecords(),
        fetchServerEmailLogs(),
        fetchAuditEmails(),
        fetchSmtpStatus(),
      ]);
      setClaims(c);
      setLostItems(l);
      setFoundItems(f);
      setMatches(m);
      setCustodyRecords(cust);
      setSmtpStatus(smtp);
      if (smtp?.user && !testEmailRecipient) {
        setTestEmailRecipient(smtp.user);
      }

      // Merge and deduplicate server logs and db logs by id/timestamp
      const combined = [...serverLogs, ...localLogs];
      const seen = new Set<string>();
      const deduped: EmailAuditLogEntry[] = [];
      for (const log of combined) {
        const key = log.id || `${log.timestamp}_${log.recipient}`;
        if (!seen.has(key)) {
          seen.add(key);
          deduped.push(log);
        }
      }
      deduped.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setEmailLogs(deduped);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const handleApproveClaim = async (claim: OwnershipClaim) => {
    try {
      const generatedOtp = await approveClaimWithOtp(claim.id, officerName);
      await logCustody({
        itemId: claim.foundItemId,
        itemType: 'found',
        action: 'CLAIM_APPROVED',
        officer: officerName,
        notes: `Claim approved for ${claim.claimantName}. Pickup OTP: ${generatedOtp}`,
      });

      // Dispatch claim approved email with pickup OTP to the claimant's real email
      const found = foundItems.find((f) => f.id === claim.foundItemId);
      if (claim.claimantEmail) {
        try {
          await sendClaimApprovedEmail({
            to: claim.claimantEmail,
            claimantName: claim.claimantName,
            itemTitle: found?.title || 'Claimed Item',
            pickupOtp: generatedOtp,
            officerName: officerName,
            location: found?.storageLocation || 'Campus Security Custody Vault Desk',
          });
        } catch (e) {
          console.error('Error sending claim approval email:', e);
        }
      }

      await loadAll();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmailRecipient.trim() || !testEmailRecipient.includes('@')) {
      alert('Please enter a valid email address for test sending.');
      return;
    }

    setIsSendingTestEmail(true);
    setTestEmailResult(null);

    try {
      const res = await sendTestEmail(testEmailRecipient.trim());
      if (res.sent) {
        setTestEmailResult({
          success: true,
          message: `Test email successfully delivered to ${testEmailRecipient}! Message-ID: ${res.messageId || 'recorded'}`,
        });
      } else {
        setTestEmailResult({
          success: false,
          message: res.error || 'Failed to send test email. Check server credentials.',
        });
      }
      await loadAll();
    } catch (err: any) {
      setTestEmailResult({
        success: false,
        message: err?.message || 'Error executing test email request.',
      });
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  const handleRejectClaim = async (claim: OwnershipClaim) => {
    const reason = window.prompt('Enter reason for claim rejection (e.g. proof does not match physical item):');
    if (!reason) return;
    try {
      await rejectClaim(claim.id, reason, officerName);
      await loadAll();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteLost = async (id: string, title: string) => {
    if (window.confirm(`Are you sure you want to remove inappropriate lost report "${title}"?`)) {
      await deleteLostItem(id);
      await loadAll();
    }
  };

  const handleDeleteFound = async (id: string, title: string) => {
    if (window.confirm(`Are you sure you want to remove found item report "${title}"?`)) {
      await deleteFoundItem(id);
      await loadAll();
    }
  };

  const handleDeleteMatch = async (id: string) => {
    if (window.confirm('Dismiss this match record?')) {
      await deleteMatch(id);
      await loadAll();
    }
  };

  const handleVerifyOtpAndReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyingClaim) return;

    if (verifyingClaim.pickupOtp !== enteredOtp.trim()) {
      setOtpError('Invalid OTP code. Please ask the student to show their approved pickup notification.');
      return;
    }

    try {
      await finalizeReturn(verifyingClaim.id, verifyingClaim.foundItemId, verifyingClaim.lostItemId, officerName);
      confetti({ particleCount: 90, spread: 80, origin: { y: 0.5 } });

      // Dispatch item returned confirmation email to claimant's real email
      const found = foundItems.find((f) => f.id === verifyingClaim.foundItemId);
      if (verifyingClaim.claimantEmail) {
        try {
          await sendItemReturnedEmail({
            to: verifyingClaim.claimantEmail,
            claimantName: verifyingClaim.claimantName,
            itemTitle: found?.title || 'Returned Item',
            officerName: officerName,
            location: 'Campus Security Custody Vault Desk',
          });
        } catch (e) {
          console.error('Error sending return confirmation email:', e);
        }
      }

      setVerifyingClaim(null);
      setEnteredOtp('');
      setOtpError('');
      await loadAll();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRegisterWalkIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walkinTitle.trim()) return;

    try {
      const created = await createFoundItem({
        title: walkinTitle,
        category: walkinCategory,
        brand: walkinBrand,
        model: walkinModel,
        color: walkinColor,
        location: walkinLocation,
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().slice(0, 5),
        description: walkinDesc,
        status: 'UNCLAIMED',
        storageLocation: walkinStorage,
        custodyBy: officerName,
      });

      await logCustody({
        itemId: created.id,
        itemType: 'found',
        action: 'RECEIVED_AT_SECURITY',
        officer: officerName,
        notes: `Walk-in deposit placed into ${walkinStorage}`,
      });

      setWalkinTitle('');
      setWalkinBrand('');
      setWalkinModel('');
      setWalkinColor('');
      setWalkinDesc('');
      alert('Walk-in item logged into Security Vault successfully!');
      await loadAll();
      setActiveTab('found');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">Security & Admin Portal</h1>
              <span className="bg-purple-100 text-purple-800 text-xs px-2.5 py-0.5 rounded-full font-semibold">
                Admin Area
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Manage lost & found reports, investigate matches, approve pickup OTPs, and maintain vault custody
            </p>
          </div>
        </div>

        {/* Security Officer Badge */}
        <div className="flex items-center gap-2 bg-slate-100 px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-700">
          <ShieldCheck className="w-4 h-4 text-purple-600" />
          <span>Active Officer:</span>
          <input
            type="text"
            value={officerName}
            onChange={(e) => setOfficerName(e.target.value)}
            className="bg-white px-2 py-0.5 rounded border border-slate-300 font-semibold text-slate-900 outline-none w-44"
          />
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex overflow-x-auto gap-2 border-b border-slate-200 mb-6 pb-2 text-sm font-semibold">
        <button
          onClick={() => setActiveTab('claims')}
          className={`px-4 py-2 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'claims'
              ? 'bg-purple-700 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Ownership Claims ({claims.filter((c) => c.status === 'PENDING_REVIEW').length} pending)
        </button>
        <button
          onClick={() => setActiveTab('matches')}
          className={`px-4 py-2 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'matches'
              ? 'bg-purple-700 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Possible Matches ({matches.length})
        </button>
        <button
          onClick={() => setActiveTab('lost')}
          className={`px-4 py-2 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'lost'
              ? 'bg-purple-700 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Lost Reports ({lostItems.length})
        </button>
        <button
          onClick={() => setActiveTab('found')}
          className={`px-4 py-2 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'found'
              ? 'bg-purple-700 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Found / Vault Items ({foundItems.length})
        </button>
        <button
          onClick={() => setActiveTab('custody')}
          className={`px-4 py-2 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'custody'
              ? 'bg-purple-700 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Vault Custody Log ({custodyRecords.length})
        </button>
        <button
          onClick={() => setActiveTab('emails')}
          className={`px-4 py-2 rounded-lg transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'emails'
              ? 'bg-purple-700 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Mail className="w-4 h-4" />
          <span>Audit & Email Logs ({emailLogs.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('walkin')}
          className={`px-4 py-2 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'walkin'
              ? 'bg-purple-700 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          + Register Walk-In Deposit
        </button>
      </div>

      {/* TAB 1: CLAIMS & OTP HANDOVER */}
      {activeTab === 'claims' && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span>Pending Student Ownership Claims</span>
          </h2>

          {claims.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 text-slate-500 text-sm">
              No ownership claims currently filed.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {claims.map((claim) => {
                const found = foundItems.find((f) => f.id === claim.foundItemId);
                const lost = lostItems.find((l) => l.id === claim.lostItemId);

                return (
                  <div
                    key={claim.id}
                    className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-base text-slate-900">{claim.claimantName}</span>
                          <span className="text-xs text-slate-500 font-mono">({maskEmail(claim.claimantEmail)})</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Claiming: <span className="font-bold text-slate-800">{found?.title || 'Vault Item'}</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                            claim.status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : claim.status === 'REJECTED'
                              ? 'bg-rose-100 text-rose-800'
                              : claim.status === 'RETURNED'
                              ? 'bg-teal-100 text-teal-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {claim.status}
                        </span>
                      </div>
                    </div>

                    {/* Private Verification Details Provided by Student */}
                    <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-3.5 text-xs text-purple-950">
                      <p className="font-bold text-purple-900 uppercase tracking-wider text-[10px] mb-1">
                        Private Verification Proof Provided by Student:
                      </p>
                      <p className="font-medium whitespace-pre-wrap">{claim.privateVerificationProof}</p>
                    </div>

                    {/* Officer Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                      <div className="text-xs text-slate-500">
                        {claim.pickupOtp ? (
                          <div className="flex items-center gap-2">
                            <span>Approved OTP:</span>
                            <span className="font-mono font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300 tracking-widest text-sm">
                              {claim.pickupOtp}
                            </span>
                          </div>
                        ) : (
                          <span>Awaiting officer review against vault inventory</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {claim.status === 'PENDING_REVIEW' && (
                          <>
                            <button
                              onClick={() => handleRejectClaim(claim)}
                              className="px-3.5 py-1.5 rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50 text-xs font-semibold transition-colors cursor-pointer"
                            >
                              Reject Claim
                            </button>
                            <button
                              onClick={() => handleApproveClaim(claim)}
                              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer"
                            >
                              Approve & Issue OTP
                            </button>
                          </>
                        )}

                        {claim.status === 'APPROVED' && (
                          <button
                            onClick={() => {
                              setVerifyingClaim(claim);
                              setEnteredOtp('');
                              setOtpError('');
                            }}
                            className="px-4 py-2 rounded-lg bg-indigo-950 hover:bg-indigo-900 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                          >
                            <Key className="w-3.5 h-3.5" />
                            <span>Verify Pickup OTP & Handover</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: POSSIBLE MATCHES */}
      {activeTab === 'matches' && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span>Possible Match Records</span>
          </h2>

          {matches.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 text-slate-500 text-sm">
              No matching records detected yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {matches.map((m) => {
                const lost = lostItems.find((l) => l.id === m.lostItemId);
                const found = foundItems.find((f) => f.id === m.foundItemId);
                const score = m.matchScore ?? m.confidenceScore ?? 80;

                return (
                  <div
                    key={m.id}
                    className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">
                          {lost?.title || 'Lost Item'} ↔ {found?.title || 'Found Item'}
                        </span>
                        <span className="bg-purple-100 text-purple-700 text-xs px-2.5 py-0.5 rounded-full font-bold">
                          {score}% Match
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mt-1">
                        <span>Lost by: {lost?.ownerName || 'Unknown'}</span>
                        {m.ownerEmail && (
                          <span className="font-mono text-purple-700 flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {maskEmail(m.ownerEmail)}
                          </span>
                        )}
                        <span>Found at: {found?.location || 'Campus'}</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {(m.matchedFields || m.reasons || []).map((r, i) => (
                          <span key={i} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                            {r}
                          </span>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteMatch(m.id)}
                      className="text-xs text-rose-600 hover:text-rose-800 p-2 rounded-lg hover:bg-rose-50 flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Dismiss Match</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: LOST REPORTS (Manage & Remove Inappropriate Reports) */}
      {activeTab === 'lost' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Registered Lost Reports</h2>
            <span className="text-xs text-slate-500 font-medium">
              Admin Moderation: Remove inappropriate or fake reports
            </span>
          </div>

          {lostItems.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 text-slate-500 text-sm">
              No lost items reported.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {lostItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{item.title}</span>
                      <span className="text-xs text-slate-500 font-mono">({item.reportId || item.id})</span>
                      <span className="bg-purple-100 text-purple-800 text-[10px] px-2 py-0.5 rounded font-bold">
                        {item.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">
                      Owner: <strong>{item.ownerName}</strong> • Email: <span className="font-mono text-purple-700">{maskEmail(item.ownerEmail || '')}</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      Lost at: {item.location} • Date: {item.date} {item.time ? `(${item.time})` : ''}
                    </p>
                    {item.description && (
                      <p className="text-xs text-slate-500 italic max-w-xl">
                        "{item.description}"
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => handleDeleteLost(item.id, item.title)}
                    className="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                    title="Remove fake or inappropriate report"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Inappropriate Report</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: FOUND / VAULT ITEMS (Manage & Moderate) */}
      {activeTab === 'found' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Found & Vault Custody Items</h2>
            <span className="text-xs text-slate-500 font-medium">
              Manage vault storage locations and remove inappropriate turn-ins
            </span>
          </div>

          {foundItems.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center border border-slate-200 text-slate-500 text-sm">
              No found items reported yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {foundItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{item.title}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                        item.status === 'RETURNED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {item.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">
                      Finder: <strong>{item.finderName || 'Guest'}</strong> {item.finderEmail ? `(${maskEmail(item.finderEmail)})` : ''}
                    </p>
                    <p className="text-xs text-slate-500">
                      Location Found: {item.location} • Storage: <span className="font-semibold text-slate-700">{item.storageLocation || 'Vault Desk'}</span>
                    </p>
                    {item.description && (
                      <p className="text-xs text-slate-500 italic max-w-xl">
                        "{item.description}"
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => handleDeleteFound(item.id, item.title)}
                    className="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Inappropriate Report</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: VAULT CUSTODY LOG */}
      {activeTab === 'custody' && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900">Custody Audit Trail</h2>
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="divide-y divide-slate-100 text-xs">
              {custodyRecords.map((r) => (
                <div key={r.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-slate-900">{r.action}</span>
                    <p className="text-slate-500 text-[11px] mt-0.5">{r.notes || 'Recorded in campus system'}</p>
                  </div>
                  <div className="text-right text-slate-400 text-[11px]">
                    <p className="font-semibold text-slate-700">{r.officer}</p>
                    <p>{new Date(r.timestamp).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB: AUDIT & EMAIL LOGS */}
      {activeTab === 'emails' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Mail className="w-5 h-5 text-purple-700" />
                <span>Email Notification Engine & Delivery Audit Log</span>
              </h2>
              <p className="text-xs text-slate-500">
                Inspect live SMTP connection parameters, verify outgoing email deliveries, and test Gmail authentication
              </p>
            </div>
            <button
              onClick={loadAll}
              className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Logs</span>
            </button>
          </div>

          {/* SMTP STATUS CARD */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-900">SMTP Server Configuration</span>
                {smtpStatus?.configured ? (
                  <span className="bg-emerald-100 text-emerald-800 text-[11px] px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Operational & Verified
                  </span>
                ) : (
                  <span className="bg-amber-100 text-amber-800 text-[11px] px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Missing Credentials
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-500 font-mono">smtp.gmail.com:465 (SSL)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-500 block mb-0.5">SMTP Host & Port:</span>
                <span className="font-mono font-semibold text-slate-900">{smtpStatus?.host || 'smtp.gmail.com'}:{smtpStatus?.port || 465}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-500 block mb-0.5">Authenticated Sender:</span>
                <span className="font-mono font-semibold text-slate-900">{smtpStatus?.user || 'Not configured'}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-slate-500 block mb-0.5">Password Security:</span>
                <span className="font-semibold text-emerald-700">Protected in Environment</span>
              </div>
            </div>

            {smtpStatus && !smtpStatus.configured && smtpStatus.missingVariables && smtpStatus.missingVariables.length > 0 && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
                <p className="font-bold">Missing Required Server Environment Variables:</p>
                <p className="font-mono text-[11px] text-amber-800">
                  {smtpStatus.missingVariables.join(', ')}
                </p>
                <p className="text-[11px] text-slate-600">
                  Please set <code>SMTP_USER</code> and <code>SMTP_APP_PASSWORD</code> in your environment variables.
                </p>
              </div>
            )}
          </div>

          {/* SEND TEST EMAIL COMPONENT */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-4">
            <div>
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Send className="w-4 h-4 text-purple-700" />
                <span>Test Live Email Delivery</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Send a real test email through Gmail SMTP to verify end-to-end inbox delivery without triggering report matches
              </p>
            </div>

            <form onSubmit={handleSendTestEmail} className="flex flex-col sm:flex-row gap-2.5">
              <input
                type="email"
                required
                value={testEmailRecipient}
                onChange={(e) => setTestEmailRecipient(e.target.value)}
                placeholder="Enter recipient email (e.g. 24951a05e0@gmail.com)"
                className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:border-purple-600 outline-none"
              />
              <button
                type="submit"
                disabled={isSendingTestEmail}
                className="px-5 py-2 bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              >
                {isSendingTestEmail ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Dispatching...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Test Email</span>
                  </>
                )}
              </button>
            </form>

            {testEmailResult && (
              <div
                className={`p-3 rounded-xl border text-xs font-medium flex items-center gap-2 ${
                  testEmailResult.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                {testEmailResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{testEmailResult.message}</span>
              </div>
            )}
          </div>

          {/* AUDIT LOG TABLE */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">
                Delivery Audit Trail ({emailLogs.length} events logged)
              </h3>
              <span className="text-[11px] text-slate-500">
                Stores SMTP Message-IDs and exact delivery statuses for security compliance
              </span>
            </div>

            {emailLogs.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No email dispatch records logged yet. Submit a lost report, found report, or send a test email to populate the audit log.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/70 border-b border-slate-200 text-[11px] font-bold text-slate-600">
                    <tr>
                      <th className="py-2.5 px-4">Timestamp</th>
                      <th className="py-2.5 px-4">Event Type</th>
                      <th className="py-2.5 px-4">Recipient</th>
                      <th className="py-2.5 px-4">Subject</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4">Message-ID / Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {emailLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-4 whitespace-nowrap text-slate-500 text-[11px] font-mono">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                              log.type === 'LOST_CONFIRMATION'
                                ? 'bg-purple-100 text-purple-800'
                                : log.type === 'FOUND_CONFIRMATION'
                                ? 'bg-emerald-100 text-emerald-800'
                                : log.type === 'MATCH_NOTIFICATION'
                                ? 'bg-indigo-100 text-indigo-800'
                                : log.type === 'CLAIM_APPROVED'
                                ? 'bg-teal-100 text-teal-800'
                                : log.type === 'ITEM_RETURNED'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {log.type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-mono text-[11px] text-slate-800">
                          {log.recipient}
                        </td>
                        <td className="py-2.5 px-4 text-slate-700 max-w-xs truncate" title={log.subject}>
                          {log.subject}
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          {log.status === 'SENT' ? (
                            <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 w-fit">
                              <Check className="w-3 h-3" />
                              SENT
                            </span>
                          ) : (
                            <span className="bg-rose-100 text-rose-800 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 w-fit">
                              <X className="w-3 h-3" />
                              FAILED
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-[10px] text-slate-500 max-w-xs truncate">
                          {log.messageId ? (
                            <span className="text-slate-700 font-mono">{log.messageId}</span>
                          ) : log.error ? (
                            <span className="text-rose-600 font-sans">{log.error}</span>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 6: WALK-IN FOUND ITEM FORM */}
      {activeTab === 'walkin' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs max-w-xl">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Log Walk-In Deposit Into Vault</h2>
          <form onSubmit={handleRegisterWalkIn} className="space-y-4 text-xs">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Item Title</label>
              <input
                type="text"
                required
                value={walkinTitle}
                onChange={(e) => setWalkinTitle(e.target.value)}
                placeholder="e.g. Graphing Calculator / Keys / Backpack"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-purple-600 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                <select
                  value={walkinCategory}
                  onChange={(e) => setWalkinCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-purple-600 outline-none bg-white"
                >
                  <option value="Electronics">Electronics</option>
                  <option value="Charger">Charger</option>
                  <option value="Water Bottle">Water Bottle</option>
                  <option value="Bag / Backpack">Bag / Backpack</option>
                  <option value="ID / Card">ID / Card</option>
                  <option value="Keys">Keys</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Color</label>
                <input
                  type="text"
                  value={walkinColor}
                  onChange={(e) => setWalkinColor(e.target.value)}
                  placeholder="e.g. Black"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-purple-600 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Turned-in Location</label>
                <input
                  type="text"
                  value={walkinLocation}
                  onChange={(e) => setWalkinLocation(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-purple-600 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Vault Storage Locker</label>
                <input
                  type="text"
                  value={walkinStorage}
                  onChange={(e) => setWalkinStorage(e.target.value)}
                  placeholder="e.g. Locker B-04"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-purple-600 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Description / Distinguishing Notes</label>
              <textarea
                rows={2}
                value={walkinDesc}
                onChange={(e) => setWalkinDesc(e.target.value)}
                placeholder="Scratch on corner, blue keychain ring..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:border-purple-600 outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-purple-700 hover:bg-purple-800 text-white rounded-xl font-semibold text-sm transition-colors cursor-pointer"
            >
              Log Walk-In Deposit Into Vault
            </button>
          </form>
        </div>
      )}

      {/* OTP HANDOVER MODAL */}
      {verifyingClaim && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-fade-in">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <Key className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 text-center mb-1">
              Verify Pickup OTP
            </h3>
            <p className="text-xs text-slate-600 text-center mb-4">
              Enter the 4-digit OTP shown on <span className="font-semibold text-slate-900">{verifyingClaim.claimantName}</span>'s device to authorize release.
            </p>

            <form onSubmit={handleVerifyOtpAndReturn} className="space-y-4">
              <div>
                <input
                  type="text"
                  maxLength={4}
                  required
                  autoFocus
                  value={enteredOtp}
                  onChange={(e) => setEnteredOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="XXXX"
                  className="w-full text-center tracking-[0.5em] text-3xl font-mono py-3 font-black rounded-xl border-2 border-purple-500 focus:outline-none focus:ring-4 focus:ring-purple-100"
                />
              </div>

              {otpError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{otpError}</span>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setVerifyingClaim(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Confirm & Mark Returned
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

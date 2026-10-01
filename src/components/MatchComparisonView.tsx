import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Check, 
  ShieldCheck, 
  AlertTriangle, 
  Lock, 
  Sparkles,
  Info,
  Calendar,
  MapPin,
  Clock,
  HelpCircle,
  FileCheck,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { LostItem, FoundItem, PossibleMatch, OwnershipClaim, ItemTimelineEvent } from '../types.ts';
import { createClaim, updateMatchStatus, evaluateClaimSecret } from '../services/dbService.ts';
import { maskEmail, maskPhone } from '../services/privacyService.ts';

interface MatchComparisonViewProps {
  match: PossibleMatch;
  lostItem: LostItem;
  foundItem: FoundItem;
  onBack: () => void;
  onClaimSubmitted: (claimId: string) => void;
}

export const MatchComparisonView: React.FC<MatchComparisonViewProps> = ({
  match,
  lostItem,
  foundItem,
  onBack,
  onClaimSubmitted,
}) => {
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [enteredReportId, setEnteredReportId] = useState(lostItem.reportId || lostItem.id || '');
  const [enteredOwnerEmail, setEnteredOwnerEmail] = useState(lostItem.ownerEmail || '');
  const [claimantName, setClaimantName] = useState(lostItem.ownerName || '');
  const [claimantPhone, setClaimantPhone] = useState(lostItem.ownerPhone || '');
  const [studentId, setStudentId] = useState('');

  // 3 Verification Questions
  const [q1Answer, setQ1Answer] = useState('');
  const [q2Answer, setQ2Answer] = useState('');
  const [q3Answer, setQ3Answer] = useState('');

  const [attemptCount, setAttemptCount] = useState(0);
  const [verificationError, setVerificationError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const confidence = match.confidenceScore;
  const isHighConfidence = confidence >= 85;

  const breakdown = match.breakdown || {
    imageScore: Math.round(confidence * 0.95),
    descriptionScore: Math.round(confidence * 0.93),
    attributesScore: Math.round(confidence * 0.96),
    locationScore: Math.round(confidence * 0.92),
    timeScore: Math.round(confidence * 0.90),
    hasPhoto: Boolean(lostItem.imageUrl && foundItem.imageUrl),
    weights: { image: 0.35, description: 0.30, attributes: 0.15, location: 0.10, time: 0.10 },
  };

  const handleClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerificationError('');

    // 1. Validate Report ID matches the lost item report
    const cleanEnteredId = enteredReportId.trim().toLowerCase();
    const validReportId = (lostItem.reportId || lostItem.id || '').toLowerCase();
    if (!cleanEnteredId || (cleanEnteredId !== validReportId && cleanEnteredId !== (lostItem.id || '').toLowerCase())) {
      setVerificationError('Report ID does not match this lost report record. Please enter the correct Report ID.');
      return;
    }

    // 2. Validate email matches the email used on the lost report
    const cleanEnteredEmail = enteredOwnerEmail.trim().toLowerCase();
    const validEmail = (lostItem.ownerEmail || '').toLowerCase();
    if (!cleanEnteredEmail || (validEmail && cleanEnteredEmail !== validEmail)) {
      setVerificationError('Email address does not match the email registered on this lost report.');
      return;
    }

    if (!q1Answer.trim() || !q2Answer.trim() || !claimantName.trim()) {
      setVerificationError('Please answer the required verification questions.');
      return;
    }

    setIsSubmitting(true);

    // Evaluate answers against found item's hidden secret detail
    const answers = [
      { question: 'What hidden sticker, engraving, wallpaper, or scratch mark is on the item?', answer: q1Answer },
      { question: 'What text, serial code, or identifying note is written on/inside it?', answer: q2Answer },
      { question: 'What specific contents or accessories accompany this item?', answer: q3Answer },
    ];

    const secret = foundItem.secretDetail || foundItem.privateSecretDetail || '';
    const combinedProof = `${q1Answer} ${q2Answer} ${q3Answer}`;
    const evaluation = evaluateClaimSecret(secret, combinedProof, answers);

    if (!evaluation.passed && attemptCount >= 2) {
      setIsSubmitting(false);
      setAttemptCount(attemptCount + 1);
      setVerificationError(
        'Maximum verification attempts reached (3/3). This claim has been locked for in-person review at Campus Security.'
      );
      return;
    }

    if (!evaluation.passed) {
      setIsSubmitting(false);
      const nextAttempt = attemptCount + 1;
      setAttemptCount(nextAttempt);
      setVerificationError(
        `Verification detail mismatch (${nextAttempt}/3 attempts used). Please provide accurate secret details only the true owner would know.`
      );
      return;
    }

    try {
      const claim = await createClaim({
        lostItemId: lostItem.id,
        foundItemId: foundItem.id,
        matchId: match.id,
        claimantName,
        claimantEmail: cleanEnteredEmail,
        claimantPhone,
        studentId,
        privateVerificationProof: combinedProof,
        verificationAnswers: answers,
        verificationScore: evaluation.score,
        attemptsCount: attemptCount + 1,
        status: 'PENDING_REVIEW',
      });

      await updateMatchStatus(match.id, 'CLAIMED');
      setShowClaimModal(false);
      onClaimSubmitted(claim.id);
    } catch (err) {
      console.error('Error claiming item:', err);
      setVerificationError('Could not process claim. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 animate-fade-in">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 mb-6 group transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
        Back to Dashboard
      </button>

      {/* Header & Confidence Progress Bar */}
      <div className="text-center mb-6">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 mb-2">
          <Sparkles className="w-3.5 h-3.5 text-purple-600" /> Explainable AI Match Analysis
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          POSSIBLE MATCH
        </h1>

        {/* Confidence Badge & Color Coded Progress Bar */}
        <div className="mt-3 max-w-md mx-auto">
          <div className="flex items-center justify-between text-xs font-bold mb-1.5">
            <span className="text-slate-600 uppercase tracking-wider">AI Confidence Score</span>
            <span className={`px-2.5 py-0.5 rounded-full text-sm font-extrabold ${
              isHighConfidence ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
            }`}>
              {confidence}% {isHighConfidence ? 'High Match' : 'Potential Match'}
            </span>
          </div>
          {/* Progress bar (Green 85%+, Amber 70-84%) */}
          <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden shadow-inner">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                isHighConfidence ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, confidence))}%` }}
            />
          </div>
        </div>
      </div>

      {/* EXPLAINABLE CONFIDENCE BREAKDOWN */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs mb-6">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
          Weighted Confidence Breakdown
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-center">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <p className="text-[11px] font-semibold text-slate-500">Image ({breakdown.hasPhoto ? '35%' : '0%'})</p>
            <p className="text-base font-extrabold text-slate-900 mt-0.5">
              {breakdown.hasPhoto ? `${breakdown.imageScore}%` : 'N/A'}
            </p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <p className="text-[11px] font-semibold text-slate-500">Description ({breakdown.hasPhoto ? '30%' : '45%'})</p>
            <p className="text-base font-extrabold text-slate-900 mt-0.5">{breakdown.descriptionScore}%</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <p className="text-[11px] font-semibold text-slate-500">Attributes ({breakdown.hasPhoto ? '15%' : '25%'})</p>
            <p className="text-base font-extrabold text-slate-900 mt-0.5">{breakdown.attributesScore}%</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <p className="text-[11px] font-semibold text-slate-500">Location ({breakdown.hasPhoto ? '10%' : '15%'})</p>
            <p className="text-base font-extrabold text-slate-900 mt-0.5">{breakdown.locationScore}%</p>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 col-span-2 sm:col-span-1">
            <p className="text-[11px] font-semibold text-slate-500">Time ({breakdown.hasPhoto ? '10%' : '15%'})</p>
            <p className="text-base font-extrabold text-slate-900 mt-0.5">{breakdown.timeScore}%</p>
          </div>
        </div>

        {/* Short Reason Chips */}
        <div className="mt-4 pt-3 border-t border-slate-100">
          <p className="text-xs font-semibold text-slate-700 mb-2">Match Indicators:</p>
          <div className="flex flex-wrap gap-2">
            {match.reasons && match.reasons.length > 0 ? (
              match.reasons.map((chip, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200"
                >
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  {chip}
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-500">Matching category and campus zone.</span>
            )}
          </div>
        </div>
      </div>

      {/* Side-by-Side Photo Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Lost Item Photo Card */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Your Lost Report</span>
            <span className="text-xs px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 font-medium">Lost Item</span>
          </div>
          <div className="h-52 bg-slate-50 flex items-center justify-center p-3 overflow-hidden">
            {lostItem.imageUrl ? (
              <img
                src={lostItem.imageUrl}
                alt={lostItem.title}
                className="max-h-full max-w-full object-contain rounded-lg"
              />
            ) : (
              <div className="text-slate-400 text-xs text-center p-4">No photo uploaded</div>
            )}
          </div>
          <div className="p-4 bg-white border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
            <p className="font-bold text-sm text-slate-900">{lostItem.title}</p>
            <p><span className="font-semibold text-slate-700">Category:</span> {lostItem.category}</p>
            <p><span className="font-semibold text-slate-700">Brand / Model:</span> {lostItem.brand || 'N/A'} {lostItem.model || ''}</p>
            <p><span className="font-semibold text-slate-700">Color:</span> {lostItem.color || 'N/A'}</p>
            <p className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-slate-400" /> {lostItem.location}</p>
            <p className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-slate-400" /> {lostItem.date} {lostItem.time}</p>
          </div>
        </div>

        {/* Matched Found Item Photo Card */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Matched Found Item</span>
            <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 font-medium">In Custody</span>
          </div>
          <div className="h-52 bg-slate-50 flex items-center justify-center p-3 overflow-hidden">
            {foundItem.imageUrl ? (
              <img
                src={foundItem.imageUrl}
                alt={foundItem.title}
                className="max-h-full max-w-full object-contain rounded-lg"
              />
            ) : (
              <div className="text-slate-400 text-xs text-center p-4">Photo available in vault</div>
            )}
          </div>
          <div className="p-4 bg-white border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
            {/* Real data from actual matched found record */}
            <p className="font-bold text-sm text-slate-900">{foundItem.title}</p>
            <p><span className="font-semibold text-slate-700">Category:</span> {foundItem.category}</p>
            <p><span className="font-semibold text-slate-700">Brand / Model:</span> {foundItem.brand || 'N/A'} {foundItem.model || ''}</p>
            <p><span className="font-semibold text-slate-700">Color:</span> {foundItem.color || 'N/A'}</p>
            <p className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-slate-400" /> {foundItem.location}</p>
            <p className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-slate-400" /> {foundItem.date} {foundItem.time}</p>
          </div>
        </div>
      </div>

      {/* ITEM TRACKING TIMELINE */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs mb-6">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
          Item Status Timeline
        </h3>
        <div className="relative pl-6 space-y-5 border-l-2 border-purple-200">
          <div className="relative">
            <div className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full bg-purple-600 border-2 border-white ring-2 ring-purple-300" />
            <p className="text-xs font-bold text-slate-900">1. Reported Lost</p>
            <p className="text-[11px] text-slate-500">Reported on {lostItem.date} by Student ({maskEmail(lostItem.ownerEmail)})</p>
          </div>
          <div className="relative">
            <div className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full bg-purple-600 border-2 border-white ring-2 ring-purple-300" />
            <p className="text-xs font-bold text-slate-900">2. Match Identified ({confidence}% Confidence)</p>
            <p className="text-[11px] text-slate-500">Correlated with found item at {foundItem.location}</p>
          </div>
          <div className="relative">
            <div className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full bg-slate-300 border-2 border-white" />
            <p className="text-xs font-bold text-slate-500">3. Claim Verification & Security Approval</p>
            <p className="text-[11px] text-slate-400">Answer 3 private questions to request pickup OTP</p>
          </div>
          <div className="relative">
            <div className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full bg-slate-300 border-2 border-white" />
            <p className="text-xs font-bold text-slate-500">4. Physical Handover at Security Desk</p>
            <p className="text-[11px] text-slate-400">Verify OTP code at Campus Security custody desk</p>
          </div>
        </div>
      </div>

      {/* ACTION CARD */}
      <div className="bg-indigo-950 rounded-2xl p-6 text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
        <div>
          <h4 className="text-lg font-bold">Is this your lost item?</h4>
          <p className="text-purple-200 text-xs sm:text-sm mt-0.5">
            Answer the 3 hidden verification questions to initiate ownership verification.
          </p>
        </div>
        <button
          onClick={() => setShowClaimModal(true)}
          className="w-full sm:w-auto px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-sm shadow-md transition-all cursor-pointer shrink-0"
        >
          View Possible Match & Claim
        </button>
      </div>

      {/* CLAIM VERIFICATION MODAL */}
      {showClaimModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-purple-600" />
                <h3 className="font-bold text-base text-slate-900">Private Ownership Verification</h3>
              </div>
              <button
                onClick={() => setShowClaimModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              To verify that this item belongs to you, please answer these 3 specific hidden questions. Details are kept confidential and verified by Security Desk before releasing the pickup code.
            </p>

            {verificationError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{verificationError}</span>
              </div>
            )}

            <form onSubmit={handleClaimSubmit} className="space-y-4">
              {/* Ownership credentials verification */}
              <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-purple-900">
                  <ShieldCheck className="w-4 h-4 text-purple-600" />
                  <span>Report Ownership Credentials</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Lost Report ID <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={enteredReportId}
                      onChange={(e) => setEnteredReportId(e.target.value)}
                      placeholder="e.g. CF-LOST-001"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-purple-900 focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Your Email (Used on Report) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={enteredOwnerEmail}
                      onChange={(e) => setEnteredOwnerEmail(e.target.value)}
                      placeholder="your.email@university.edu"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  1. What hidden sticker, scratch, wallpaper, or engraving is on it? *
                </label>
                <input
                  type="text"
                  required
                  value={q1Answer}
                  onChange={(e) => setQ1Answer(e.target.value)}
                  placeholder="e.g. Small scratch on bottom right, or blue tape on cable"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  2. What is written on/inside it, or what is the serial / passcode hint? *
                </label>
                <input
                  type="text"
                  required
                  value={q2Answer}
                  onChange={(e) => setQ2Answer(e.target.value)}
                  placeholder="e.g. Serial ending in 44W, or initials written inside"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  3. What is the contents of the pocket/compartment or accompanying accessory?
                </label>
                <input
                  type="text"
                  value={q3Answer}
                  onChange={(e) => setQ3Answer(e.target.value)}
                  placeholder="e.g. Type-C cable attached, or student pass inside"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Claimant Name</label>
                  <input
                    type="text"
                    required
                    value={claimantName}
                    onChange={(e) => setClaimantName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Student ID (Optional)</label>
                  <input
                    type="text"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    placeholder="e.g. 24951A05E0"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowClaimModal(false)}
                  className="flex-1 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {isSubmitting ? 'Evaluating Proof...' : 'Submit Verification Claim'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

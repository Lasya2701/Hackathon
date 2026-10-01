import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Search, 
  Clock, 
  Sparkles, 
  ShieldCheck, 
  AlertCircle,
  Mail,
  UserCheck
} from 'lucide-react';
import { 
  fetchLostItems, 
  fetchFoundItems, 
  fetchMatches, 
  fetchClaims 
} from '../services/dbService.ts';
import { LostItem, FoundItem, PossibleMatch, OwnershipClaim } from '../types.ts';

interface DashboardStatsProps {
  onBack: () => void;
  onOpenMatch: (match: PossibleMatch, lost: LostItem, found: FoundItem) => void;
}

export const DashboardStats: React.FC<DashboardStatsProps> = ({
  onBack,
  onOpenMatch,
}) => {
  const [lostItems, setLostItems] = useState<LostItem[]>([]);
  const [foundItems, setFoundItems] = useState<FoundItem[]>([]);
  const [matches, setMatches] = useState<PossibleMatch[]>([]);
  const [claims, setClaims] = useState<OwnershipClaim[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchLostItems(),
      fetchFoundItems(),
      fetchMatches(),
      fetchClaims(),
    ]).then(([l, f, m, c]) => {
      setLostItems(l);
      setFoundItems(f);
      setMatches(m);
      setClaims(c);
      setLoading(false);
    });
  }, []);

  const totalLost = lostItems.length;
  const totalFound = foundItems.length;
  const totalMatches = matches.length;
  const pendingClaims = claims.filter((c) => c.status === 'PENDING_REVIEW').length;
  const returnedCount = foundItems.filter((f) => f.status === 'RETURNED').length + claims.filter((c) => c.status === 'RETURNED').length;

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Campus Activity Dashboard</h1>
          <p className="text-xs sm:text-sm text-slate-500">Live campus lost & found activity and match records</p>
        </div>
      </div>

      {/* 4 Clean Primary Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Lost Reports</p>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">{totalLost}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Active owner reports</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Found Reports</p>
          <p className="text-2xl sm:text-3xl font-black text-emerald-600 mt-1">{totalFound}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Reported by finders</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Detected Matches</p>
          <p className="text-2xl sm:text-3xl font-black text-purple-600 mt-1">{totalMatches}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Automated matches</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Returned</p>
          <p className="text-2xl sm:text-3xl font-black text-teal-600 mt-1">{returnedCount}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Verified handoffs</p>
        </div>
      </div>

      {/* Recent Matches Section */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs mb-6">
        <h2 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-600" />
          <span>Recent Match Records</span>
        </h2>

        {matches.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500">
            <p>No matches detected yet. When a Found Item matches an existing Lost Item, it will appear here.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {matches.map((m) => {
              const lost = lostItems.find((l) => l.id === m.lostItemId);
              const found = foundItems.find((f) => f.id === m.foundItemId);
              const score = m.matchScore ?? m.confidenceScore ?? 80;

              return (
                <div key={m.id} className="py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">
                        {lost?.title || 'Lost Item'} ↔ {found?.title || 'Found Item'}
                      </span>
                      <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full font-bold">
                        {score}% Match
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-1">
                      <span>Location: {lost?.location || 'Campus'}</span>
                      {m.ownerEmail && (
                        <span className="flex items-center gap-1 font-mono text-purple-700 font-medium">
                          <Mail className="w-3 h-3 text-purple-600" />
                          {m.ownerEmail}
                        </span>
                      )}
                    </div>
                  </div>

                  {lost && found && (
                    <button
                      onClick={() => onOpenMatch(m, lost, found)}
                      className="px-3.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0"
                    >
                      Inspect Match & Claim
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Clean Recent Reports: Showing at most recent items without clutter */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Recent Lost Reports */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs">
          <h3 className="text-sm font-bold text-slate-900 mb-3">Recent Lost Reports</h3>
          {lostItems.length === 0 ? (
            <p className="text-xs text-slate-500 py-3">No lost reports submitted yet.</p>
          ) : (
            <div className="space-y-2">
              {lostItems.slice(0, 3).map((l) => (
                <div key={l.id} className="p-3 bg-slate-50 rounded-xl text-xs flex justify-between items-center">
                  <div>
                    <p className="font-bold text-slate-800">{l.title}</p>
                    <p className="text-slate-500 text-[11px]">
                      {l.location} • {l.date}
                    </p>
                    {l.ownerEmail && (
                      <p className="text-[10px] text-purple-700 font-mono mt-0.5">
                        {l.ownerEmail}
                      </p>
                    )}
                  </div>
                  <span className={`px-2 py-0.5 rounded-md font-semibold text-[10px] shrink-0 ${
                    l.status === 'RETURNED' ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-800'
                  }`}>
                    {l.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Found Reports */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs">
          <h3 className="text-sm font-bold text-slate-900 mb-3">Recent Found Reports</h3>
          {foundItems.length === 0 ? (
            <p className="text-xs text-slate-500 py-3">No found reports submitted yet.</p>
          ) : (
            <div className="space-y-2">
              {foundItems.slice(0, 3).map((f) => (
                <div key={f.id} className="p-3 bg-slate-50 rounded-xl text-xs flex justify-between items-center">
                  <div>
                    <p className="font-bold text-slate-800">{f.title}</p>
                    <p className="text-slate-500 text-[11px]">{f.location} • {f.date}</p>
                    {f.finderName && (
                      <p className="text-[10px] text-emerald-700 mt-0.5">
                        Finder: {f.finderName}
                      </p>
                    )}
                  </div>
                  <span className={`px-2 py-0.5 rounded-md font-semibold text-[10px] shrink-0 ${
                    f.status === 'RETURNED' ? 'bg-teal-100 text-teal-800' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {f.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

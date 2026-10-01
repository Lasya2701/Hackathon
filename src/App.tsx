import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  ShieldCheck, 
  Search, 
  Menu,
  X,
  Compass,
  PackageCheck,
  Shield,
  ArrowRight,
  HelpCircle,
  BarChart3
} from 'lucide-react';
import { LostItemForm } from './components/LostItemForm.tsx';
import { FoundItemForm } from './components/FoundItemForm.tsx';
import { MatchComparisonView } from './components/MatchComparisonView.tsx';
import { AdminDashboard } from './components/AdminDashboard.tsx';
import { UnclaimedItemsView } from './components/UnclaimedItemsView.tsx';
import { DashboardStats } from './components/DashboardStats.tsx';
import { DemoGuideView } from './components/DemoGuideView.tsx';
import { SecurityGuideView } from './components/SecurityGuideView.tsx';
import { seedDemoDataIfNeeded } from './services/seedService.ts';
import { fetchLostItems, fetchFoundItems, fetchMatches } from './services/dbService.ts';
import { LostItem, FoundItem, PossibleMatch } from './types.ts';

type ActiveView = 
  | 'home' 
  | 'lost' 
  | 'found' 
  | 'match_view' 
  | 'admin' 
  | 'unclaimed' 
  | 'dashboard' 
  | 'demo'
  | 'security';

export default function App() {
  const isReportFoundPath = () => {
    if (typeof window === 'undefined') return false;
    const clean = window.location.pathname.replace(/\/+$/, '');
    return clean === '/report-found';
  };

  const [currentView, setCurrentView] = useState<ActiveView>(() => {
    return isReportFoundPath() ? 'found' : 'home';
  });
  const [selectedMatch, setSelectedMatch] = useState<{
    match: PossibleMatch;
    lost: LostItem;
    found: FoundItem;
  } | null>(null);
  const [isFromQrScan, setIsFromQrScan] = useState(() => isReportFoundPath());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Check URL query parameters for direct claim link from match emails
  const checkUrlParameters = async () => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    const reportIdParam = urlParams.get('reportId') || urlParams.get('claimReportId');

    if (reportIdParam) {
      try {
        const [lostList, foundList, matchList] = await Promise.all([
          fetchLostItems(),
          fetchFoundItems(),
          fetchMatches(),
        ]);

        const targetLost = lostList.find(
          (l) => (l.reportId && l.reportId.toLowerCase() === reportIdParam.toLowerCase()) || l.id === reportIdParam
        );

        if (targetLost) {
          const targetMatch = matchList.find(
            (m) => m.lostItemId === targetLost.id && m.confidenceScore >= 70
          );
          if (targetMatch) {
            const targetFound = foundList.find((f) => f.id === targetMatch.foundItemId);
            if (targetFound) {
              setSelectedMatch({ match: targetMatch, lost: targetLost, found: targetFound });
              setCurrentView('match_view');
              return;
            }
          }
        }
      } catch (err) {
        console.warn('Error resolving direct claim link from URL:', err);
      }
    }
  };

  // Initialize sample data if collection is empty
  useEffect(() => {
    seedDemoDataIfNeeded();
    checkUrlParameters();

    const handlePopState = () => {
      if (isReportFoundPath()) {
        setCurrentView('found');
        setIsFromQrScan(true);
      } else {
        setCurrentView('home');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleOpenMatch = (match: PossibleMatch, lost: LostItem, found: FoundItem) => {
    setSelectedMatch({ match, lost, found });
    setCurrentView('match_view');
  };

  const navigateTo = (view: ActiveView) => {
    setCurrentView(view);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (typeof window !== 'undefined') {
      if (view === 'found') {
        window.history.pushState(null, '', '/report-found');
      } else if (view === 'home') {
        window.history.pushState(null, '', '/');
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-purple-100 selection:text-purple-900">
      {/* GLOBAL NAVBAR */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          {/* Brand Logo */}
          <button
            onClick={() => navigateTo('home')}
            className="flex items-center gap-2 group text-left cursor-pointer shrink-0"
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-950 flex items-center justify-center text-white font-black text-sm shadow-xs group-hover:scale-105 transition-transform">
              CF
            </div>
            <div>
              <span className="font-extrabold text-base tracking-tight text-slate-900 block leading-tight">
                CampusFind <span className="text-purple-600">AI</span>
              </span>
              <span className="text-[10px] text-slate-600 font-medium tracking-wide">
                Campus Lost & Found
              </span>
            </div>
          </button>

          {/* Navigation Links Desktop */}
          <nav className="hidden lg:flex items-center gap-1 text-xs font-medium text-slate-600">
            <button
              onClick={() => navigateTo('lost')}
              className={`px-2.5 py-1.5 rounded-lg transition-colors hover:bg-slate-100 hover:text-slate-900 cursor-pointer ${
                currentView === 'lost' ? 'bg-slate-100 text-slate-900 font-semibold' : ''
              }`}
            >
              Report Lost
            </button>
            <button
              onClick={() => navigateTo('found')}
              className={`px-2.5 py-1.5 rounded-lg transition-colors hover:bg-slate-100 hover:text-slate-900 cursor-pointer ${
                currentView === 'found' ? 'bg-slate-100 text-slate-900 font-semibold' : ''
              }`}
            >
              Report Found
            </button>
            <button
              onClick={() => navigateTo('unclaimed')}
              className={`px-2.5 py-1.5 rounded-lg transition-colors hover:bg-slate-100 hover:text-slate-900 cursor-pointer ${
                currentView === 'unclaimed' ? 'bg-slate-100 text-slate-900 font-semibold' : ''
              }`}
            >
              Unclaimed Items
            </button>
            <button
              onClick={() => navigateTo('dashboard')}
              className={`px-2.5 py-1.5 rounded-lg transition-colors hover:bg-slate-100 hover:text-slate-900 cursor-pointer ${
                currentView === 'dashboard' ? 'bg-slate-100 text-slate-900 font-semibold' : ''
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => navigateTo('demo')}
              className={`px-2.5 py-1.5 rounded-lg transition-colors hover:bg-slate-100 hover:text-slate-900 cursor-pointer ${
                currentView === 'demo' ? 'bg-purple-100 text-purple-900 font-semibold' : ''
              }`}
            >
              Demo Guide
            </button>
            <button
              onClick={() => navigateTo('security')}
              className={`px-2.5 py-1.5 rounded-lg transition-colors hover:bg-slate-100 hover:text-slate-900 cursor-pointer ${
                currentView === 'security' ? 'bg-purple-100 text-purple-900 font-semibold' : ''
              }`}
            >
              Security Guide
            </button>
          </nav>

          {/* Admin Portal Quick Access */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateTo('admin')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                currentView === 'admin'
                  ? 'bg-purple-700 text-white border-purple-700 shadow-sm'
                  : 'border-slate-200 hover:border-purple-300 hover:bg-purple-50 text-slate-700 hover:text-purple-900'
              }`}
              title="Access Campus Security and Admin Portal"
            >
              <ShieldCheck className="w-4 h-4 text-purple-600 group-hover:text-purple-700" />
              <span>Admin Portal</span>
            </button>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-b border-slate-200 px-4 py-3 space-y-1 text-sm font-medium animate-fade-in shadow-lg">
            <button
              onClick={() => navigateTo('home')}
              className="w-full text-left py-2 px-3 rounded-lg hover:bg-slate-50 text-slate-700"
            >
              Home
            </button>
            <button
              onClick={() => navigateTo('lost')}
              className="w-full text-left py-2 px-3 rounded-lg hover:bg-slate-50 text-slate-700 font-medium"
            >
              Report Lost Item
            </button>
            <button
              onClick={() => navigateTo('found')}
              className="w-full text-left py-2 px-3 rounded-lg hover:bg-slate-50 text-slate-700 font-medium"
            >
              Report Found Item
            </button>
            <button
              onClick={() => navigateTo('unclaimed')}
              className="w-full text-left py-2 px-3 rounded-lg hover:bg-slate-50 text-slate-700"
            >
              Unclaimed Items
            </button>
            <button
              onClick={() => navigateTo('dashboard')}
              className="w-full text-left py-2 px-3 rounded-lg hover:bg-slate-50 text-slate-700"
            >
              Dashboard
            </button>
            <button
              onClick={() => navigateTo('demo')}
              className="w-full text-left py-2 px-3 rounded-lg hover:bg-slate-50 text-slate-700"
            >
              Demo Guide
            </button>
            <button
              onClick={() => navigateTo('security')}
              className="w-full text-left py-2 px-3 rounded-lg hover:bg-slate-50 text-slate-700"
            >
              Security Guide
            </button>
            <button
              onClick={() => navigateTo('admin')}
              className="w-full text-left py-2 px-3 rounded-lg hover:bg-purple-50 text-purple-900 font-bold"
            >
              Admin Portal
            </button>
          </div>
        )}
      </header>

      {/* MAIN VIEW CONTAINER */}
      <main className="flex-1 flex flex-col justify-center">
        {/* 1. HOMEPAGE */}
        {currentView === 'home' && (
          <div className="w-full max-w-lg mx-auto px-4 py-8 sm:py-12 flex flex-col items-center justify-center text-center animate-fade-in">
            {/* BRANDING */}
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              CampusFind AI
            </h1>

            {/* TAGLINE */}
            <p className="text-base sm:text-lg font-semibold text-purple-700 mt-1">
              Find It. Match It. Return It.
            </p>

            {/* QUESTION */}
            <p className="text-lg sm:text-xl font-bold text-slate-800 mt-8 mb-5">
              Lost or found something on campus?
            </p>

            {/* TWO LARGE PRIMARY ACTIONS */}
            <div className="w-full space-y-3.5 mb-10">
              {/* ACTION 1: I LOST SOMETHING */}
              <button
                onClick={() => navigateTo('lost')}
                className="w-full py-4 px-6 rounded-2xl bg-indigo-950 hover:bg-indigo-900 active:bg-slate-950 text-white font-bold text-lg transition-all shadow-md hover:shadow-lg active:scale-[0.99] cursor-pointer"
              >
                I LOST SOMETHING
              </button>

              {/* ACTION 2: I FOUND SOMETHING */}
              <button
                onClick={() => {
                  setIsFromQrScan(false);
                  navigateTo('found');
                }}
                className="w-full py-4 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-lg transition-all shadow-md hover:shadow-lg active:scale-[0.99] flex flex-col items-center justify-center cursor-pointer"
              >
                <span>I FOUND SOMETHING</span>
                <span className="text-xs font-normal text-emerald-100 opacity-90 mt-0.5">
                  Upload photo & report discovery
                </span>
              </button>
            </div>

            {/* THREE-STEP EXPLANATION AT BOTTOM */}
            <div className="pt-4 border-t border-slate-200/80 w-full text-center space-y-1 text-sm font-semibold text-slate-600">
              <p className="text-slate-800">AI finds the match.</p>
              <p className="text-slate-800">Owner receives automatic email notification.</p>
              <p className="text-emerald-700 font-bold">Items safely verified and returned.</p>
            </div>
          </div>
        )}

        {/* 2. LOST ITEM FLOW */}
        {currentView === 'lost' && (
          <LostItemForm
            onBack={() => navigateTo('home')}
            onViewMatch={(m, l, f) => handleOpenMatch(m, l, f)}
            onReportSuccess={() => {}}
          />
        )}

        {/* 3. FOUND ITEM FLOW */}
        {currentView === 'found' && (
          <FoundItemForm
            onBack={() => navigateTo('home')}
            onSuccessReturnHome={() => navigateTo('home')}
            onViewMatch={(m, l, f) => handleOpenMatch(m, l, f)}
            isFromQrScan={isFromQrScan}
          />
        )}

        {/* 4. MATCH COMPARISON VIEW & CLAIM */}
        {currentView === 'match_view' && selectedMatch && (
          <MatchComparisonView
            match={selectedMatch.match}
            lostItem={selectedMatch.lost}
            foundItem={selectedMatch.found}
            onBack={() => navigateTo('home')}
            onClaimSubmitted={() => {
              alert('Claim submitted! Campus Security will verify your private details before issuing a pickup OTP.');
              navigateTo('home');
            }}
          />
        )}

        {/* 5. SECURITY / ADMIN PORTAL */}
        {currentView === 'admin' && (
          <AdminDashboard onBack={() => navigateTo('home')} />
        )}

        {/* 6. UNCLAIMED ITEMS */}
        {currentView === 'unclaimed' && (
          <UnclaimedItemsView
            onBack={() => navigateTo('home')}
            onSelectReportLost={() => navigateTo('lost')}
          />
        )}

        {/* 7. DASHBOARD */}
        {currentView === 'dashboard' && (
          <DashboardStats
            onBack={() => navigateTo('home')}
            onOpenMatch={(m, l, f) => handleOpenMatch(m, l, f)}
          />
        )}

        {/* 8. DEMO GUIDE */}
        {currentView === 'demo' && (
          <DemoGuideView
            onBack={() => navigateTo('home')}
            onOpenReportLost={() => navigateTo('lost')}
            onOpenReportFound={() => navigateTo('found')}
            onOpenAdmin={() => navigateTo('admin')}
          />
        )}

        {/* 9. SECURITY GUIDE */}
        {currentView === 'security' && (
          <SecurityGuideView onBack={() => navigateTo('home')} />
        )}
      </main>

      {/* FOOTER */}
      <footer className="bg-white border-t border-slate-200 py-4 px-4 text-center text-xs text-slate-600">
        <p>
          CampusFind AI • College Campus Lost & Found System
        </p>
      </footer>
    </div>
  );
}

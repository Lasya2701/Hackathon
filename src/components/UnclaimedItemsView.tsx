import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Search, 
  MapPin, 
  Calendar, 
  Sparkles, 
  Tag, 
  ShieldAlert,
  Archive,
  ArrowRight
} from 'lucide-react';
import { fetchUnclaimedItems, fetchLostItems, createMatch } from '../services/dbService.ts';
import { calculateAIMatch } from '../services/aiService.ts';
import { FoundItem } from '../types.ts';

interface UnclaimedItemsViewProps {
  onBack: () => void;
  onSelectReportLost: () => void;
}

export const UnclaimedItemsView: React.FC<UnclaimedItemsViewProps> = ({
  onBack,
  onSelectReportLost,
}) => {
  const [items, setItems] = useState<FoundItem[]>([]);
  const [filter, setFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUnclaimedItems().then((res) => {
      // Items are already filtered to UNCLAIMED and deduplicated
      setItems(res);
      setLoading(false);
    });
  }, []);

  const filtered = items.filter((item) => {
    const matchesQuery =
      item.title.toLowerCase().includes(filter.toLowerCase()) ||
      item.location.toLowerCase().includes(filter.toLowerCase()) ||
      (item.brand && item.brand.toLowerCase().includes(filter.toLowerCase())) ||
      (item.color && item.color.toLowerCase().includes(filter.toLowerCase()));

    const matchesCat = categoryFilter === 'ALL' || item.category === categoryFilter;
    return matchesQuery && matchesCat;
  });

  return (
    <div className="max-w-5xl mx-auto py-6 px-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">Unclaimed Vault Items</h1>
              <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-semibold">
                {items.length} Active
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500">
              Found campus items securely stored waiting for student owners to file a lost report
            </p>
          </div>
        </div>

        <button
          onClick={onSelectReportLost}
          className="px-4 py-2.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-xs"
        >
          <span>I lost one of these</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search items, locations, brands, colors..."
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm outline-none focus:border-purple-600 shadow-xs"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm outline-none focus:border-purple-600 shadow-xs"
        >
          <option value="ALL">All Categories</option>
          <option value="Charger">Charger</option>
          <option value="Electronics">Electronics</option>
          <option value="Water Bottle">Water Bottle</option>
          <option value="Bag / Backpack">Bag / Backpack</option>
          <option value="ID / Card">ID / Card</option>
          <option value="Keys">Keys</option>
          <option value="Other">Other</option>
        </select>
      </div>

      {/* Items Grid */}
      {loading ? (
        <div className="py-12 text-center text-slate-400 text-sm">Loading campus vault...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center border border-slate-200 shadow-xs">
          <Archive className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-600 font-medium text-sm">No unclaimed items found matching filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col"
            >
              <div className="h-44 bg-slate-50 relative flex items-center justify-center p-3 border-b border-slate-100">
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="max-h-full max-w-full object-contain rounded-md"
                  />
                ) : (
                  <div className="text-slate-400 text-xs flex flex-col items-center">
                    <Archive className="w-8 h-8 text-slate-300 mb-1" />
                    <span>Photo in Custody</span>
                  </div>
                )}
                <span className="absolute top-2 right-2 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                  UNCLAIMED
                </span>
              </div>

              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm line-clamp-1">{item.title}</h3>
                  <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-slate-500">
                    <span className="bg-slate-100 px-2 py-0.5 rounded">{item.category}</span>
                    {item.brand && <span className="bg-slate-100 px-2 py-0.5 rounded">{item.brand}</span>}
                    {item.color && <span className="bg-slate-100 px-2 py-0.5 rounded">{item.color}</span>}
                  </div>
                </div>

                <div className="space-y-1 text-xs text-slate-600 pt-2 border-t border-slate-100">
                  <p className="flex items-center gap-1.5 truncate">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{item.location}</span>
                  </p>
                  <p className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Found {item.date}</span>
                  </p>
                  {item.storageLocation && (
                    <p className="text-[11px] text-purple-700 font-medium">
                      Vault Custody: {item.storageLocation}
                    </p>
                  )}
                </div>

                <button
                  onClick={onSelectReportLost}
                  className="w-full py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  File Lost Report to Match
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

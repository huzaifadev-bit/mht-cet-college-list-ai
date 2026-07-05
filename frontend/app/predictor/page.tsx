"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { API_BASE_URL } from '../config';
import {
  Compass, Search, ChevronDown, ChevronUp, Plus, BookmarkCheck,
  MapPin, Award, TrendingUp, Shield, Star, Target, Zap,
  Filter, X, BarChart2, Globe, ExternalLink, RefreshCw
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────
interface CollegeResult {
  college: {
    code: number;
    name: string;
    district: { name: string };
    university: { name: string };
    status: string;
    autonomous: boolean;
    minority_status: string | null;
    fees: number | null;
    hostel_availability: boolean;
    average_package: number | null;
    highest_package: number | null;
    official_website: string | null;
  };
  branch: { code: string; name: string };
  cap_round: number;
  seat_type: string;
  admission_probability: number;
  category_closing_percentiles: Record<string, Array<{ round: number; percentile: number; rank: number }>>;
  current_vacant_seats: number;
  explanation: string;
}

const CATEGORIES = ['OPEN', 'OBC', 'SC', 'ST', 'EWS', 'VJNT', 'NT1', 'NT2', 'NT3', 'SBC', 'TFWS', 'DEF'];

const ALL_BRANCHES = [
  'Computer Engineering',
  'Information Technology',
  'Computer Science and Engineering',
  'Artificial Intelligence and Data Science',
  'Computer Science and Engineering(Artificial Intelligence and Machine Learning)',
  'Electronics and Telecommunication Engg',
  'Mechanical Engineering',
  'Electrical Engineering',
  'Civil Engineering',
  'Chemical Engineering',
];

const DISTRICTS = [
  'Pune', 'Mumbai', 'Thane', 'Nagpur', 'Nashik', 'Amravati',
  'Aurangabad', 'Kolhapur', 'Sangli', 'Solapur', 'Nanded',
  'Jalgaon', 'Akola', 'Latur', 'Chandrapur', 'Yavatmal'
];

const BUCKETS = ['Safe', 'High Chance', 'Moderate Chance', 'Dream'] as const;

const BUCKET_META: Record<string, { color: string; bg: string; label: string; icon: React.ReactNode; desc: string }> = {
  'Safe':            { color: '#10b981', bg: 'rgba(16,185,129,0.12)', label: '90–100%', icon: <Shield size={16}/>, desc: 'Very likely admission based on past cutoffs' },
  'High Chance':     { color: '#6366f1', bg: 'rgba(99,102,241,0.12)',  label: '70–90%',  icon: <TrendingUp size={16}/>, desc: 'Strong match — cutoff is within close range' },
  'Moderate Chance': { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', label: '40–70%',  icon: <Target size={16}/>, desc: 'Competitive — depends on round & vacancies' },
  'Dream':           { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   label: '<40%',   icon: <Star size={16}/>, desc: 'Aspirational — add to top of your preference list' },
};

// ─── Main Component ──────────────────────────────────────────────────────────
export default function PredictorPage() {
  // Form state
  const [percentile, setPercentile] = useState('');
  const [category, setCategory]     = useState('OPEN');
  const [gender, setGender]         = useState('M');
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([]);
  const [govPref, setGovPref]       = useState('ANY');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Results state
  const [results, setResults]       = useState<Record<string, CollegeResult[]> | null>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  // Filter / sort on results
  const [searchQ, setSearchQ]       = useState('');
  const [filterDistrict, setFilterDistrict] = useState('ALL');
  const [filterBranch, setFilterBranch]     = useState('ALL');
  const [sortBy, setSortBy]         = useState('PROB_DESC');

  // Accordions and Saved items
  const [expanded, setExpanded]     = useState<Set<string>>(new Set());
  const [saved, setSaved]           = useState<Set<string>>(new Set());
  const [activeBucket, setActiveBucket] = useState<string>('Safe');

  // Load saved preferences on mount to ensure button state syncs
  useEffect(() => {
    try {
      const localPrefs = JSON.parse(localStorage.getItem('cap_preferences') || '[]');
      const savedKeys = new Set<string>(
        localPrefs.map((item: any) => `${item.college.code}_${item.branch.code}`)
      );
      setSaved(savedKeys);
    } catch (e) {
      console.error("Error loading local preferences", e);
    }
  }, []);

  // ─── Fetch Predictions ──────────────────────────────────────────────────
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!percentile) { setError('Please enter your percentile.'); return; }
    const pct = parseFloat(percentile);
    if (isNaN(pct) || pct < 0 || pct > 100) { setError('Percentile must be between 0 and 100.'); return; }

    setLoading(true);
    setError('');
    setResults(null);
    setHasSearched(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          percentile: pct,
          rank: null,
          category,
          gender,
          home_university: '',
          candidature_type: 'Type A',
          tfws_status: category === 'TFWS',
          defence_status: category === 'DEF',
          ph_status: false,
          minority_status: 'None',
          preferred_branches: selectedBranches,
          preferred_districts: selectedDistricts,
          max_fees: null,
          gov_private_pref: govPref,
          autonomous_pref: 'ANY',
          hostel_required: false,
          placement_priority: false,
        }),
      });
      
      let data;
      try {
        data = await res.json();
      } catch (jsonErr) {
        throw new Error(`Failed to parse backend response: ${res.statusText}`);
      }

      if (res.ok) {
        setResults(data);
        // Auto-switch to first non-empty bucket
        const firstFull = BUCKETS.find(b => (data[b] || []).length > 0);
        if (firstFull) setActiveBucket(firstFull);
      } else {
        const errorMsg = data && data.detail 
          ? (typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail)) 
          : 'Failed to load predictions';
        throw new Error(errorMsg);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error fetching predictions. Make sure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  // ─── Helpers ────────────────────────────────────────────────────────────
  const toggleBranch  = (b: string) => setSelectedBranches(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b]);
  const toggleDistrict = (d: string) => setSelectedDistricts(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  const toggleExpand  = (id: string) => setExpanded(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const addToPreferences = (item: CollegeResult) => {
    const key = `${item.college.code}_${item.branch.code}`;
    if (saved.has(key)) return;
    
    try {
      const localPrefs: any[] = JSON.parse(localStorage.getItem('cap_preferences') || '[]');
      localPrefs.push({
        id: `local_${Date.now()}_${key}`,
        college: item.college,
        branch: item.branch,
        preference_order: localPrefs.length + 1,
        locked: false,
        admission_probability: item.admission_probability,
      });
      localStorage.setItem('cap_preferences', JSON.stringify(localPrefs));
      setSaved(prev => new Set([...prev, key]));
    } catch (e) {
      console.error("Failed to add preference", e);
    }
  };

  const processResults = (list: CollegeResult[]) => {
    let out = [...list];
    if (searchQ) {
      const q = searchQ.toLowerCase();
      out = out.filter(i => i.college.name.toLowerCase().includes(q) || i.branch.name.toLowerCase().includes(q) || i.college.code.toString().includes(q));
    }
    if (filterDistrict !== 'ALL') {
      out = out.filter(i => i.college.district.name.toLowerCase() === filterDistrict.toLowerCase());
    }
    if (filterBranch !== 'ALL') {
      out = out.filter(i => i.branch.name === filterBranch);
    }
    if (sortBy === 'PROB_DESC')   out.sort((a, b) => b.admission_probability - a.admission_probability);
    if (sortBy === 'PROB_ASC')    out.sort((a, b) => a.admission_probability - b.admission_probability);
    if (sortBy === 'FEES_ASC')    out.sort((a, b) => (a.college.fees ?? 999999) - (b.college.fees ?? 999999));
    return out;
  };

  // Extract unique districts and branches matching the results dynamically
  const allResultDistricts = results ? [...new Set(Object.values(results).flat().map(i => i.college.district.name))].filter(Boolean).sort() : [];
  const allResultBranches  = results ? [...new Set(Object.values(results).flat().map(i => i.branch.name))].filter(Boolean).sort() : [];
  const totalResults       = results ? Object.values(results).flat().length : 0;

  // ─── Card ────────────────────────────────────────────────────────────────
  const renderCard = (item: CollegeResult, bucket: string) => {
    const id   = `${item.college.code}_${item.branch.code}`;
    const meta = BUCKET_META[bucket];
    const isSaved   = saved.has(id);
    const isExpanded = expanded.has(id);

    return (
      <div key={id} className="result-card">
        {/* Top Row */}
        <div className="card-top">
          <div className="card-left">
            <div className="card-badges-row">
              <span className="code-badge">CODE: {item.college.code}</span>
              <span className="status-badge">{item.college.status}</span>
              {item.college.autonomous && <span className="auto-badge">Autonomous</span>}
            </div>
            <h3 className="college-name">{item.college.name}</h3>
            <p className="branch-name">{item.branch.name}</p>
            <div className="meta-row">
              <span className="meta-item"><MapPin size={14}/> District: {item.college.district.name}</span>
              {item.college.fees && <span className="meta-item">Annual Fee: ₹{item.college.fees.toLocaleString()}</span>}
              {item.college.average_package && <span className="meta-item"><BarChart2 size={14}/> Avg pkg: {item.college.average_package} LPA</span>}
              {item.college.hostel_availability && <span className="meta-item hostel">🏠 Hostel Available</span>}
            </div>
          </div>

          <div className="card-right">
            <div className="prob-circle" style={{ background: meta.bg, borderColor: meta.color }}>
              <span className="prob-num" style={{ color: meta.color }}>{item.admission_probability}%</span>
              <span className="prob-tag" style={{ color: meta.color }}>{bucket}</span>
            </div>
            <button
              className={`save-btn ${isSaved ? 'saved' : ''}`}
              onClick={() => addToPreferences(item)}
              disabled={isSaved}
            >
              {isSaved ? (
                <><BookmarkCheck size={16}/> Added to List</>
              ) : (
                <><Plus size={16}/> Add Preference</>
              )}
            </button>
          </div>
        </div>

        {/* Probability Bar */}
        <div className="prob-bar-track">
          <div className="prob-bar-fill" style={{ width: `${item.admission_probability}%`, background: meta.color }}/>
        </div>

        {/* Explanation */}
        <p className="explanation-text">
          <strong>AI Trend Analysis:</strong> {item.explanation}
        </p>

        {/* Accordion: Historical Cutoffs */}
        <button className="cutoff-toggle" onClick={() => toggleExpand(id)}>
          {isExpanded ? <><ChevronUp size={14}/> Hide Closing Cutoffs</> : <><ChevronDown size={14}/> View 3-Year CAP Cutoff Details</>}
        </button>

        {isExpanded && (
          <div className="cutoff-table-wrap">
            <table className="cutoff-table">
              <thead>
                <tr>
                  <th>Academic Year</th>
                  <th>CAP Round</th>
                  <th>Seat Type</th>
                  <th>Closing Percentile</th>
                  <th>Closing Rank</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(item.category_closing_percentiles).map(([yr, entries]) =>
                  entries.map((e, idx) => (
                    <tr key={`${yr}_${idx}`}>
                      <td>{yr}</td>
                      <td>Round {e.round}</td>
                      <td>{item.seat_type}</td>
                      <td className="cutoff-pct">{e.percentile}%</td>
                      <td>#{e.rank}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {item.college.official_website && (
              <a href={item.college.official_website} target="_blank" rel="noreferrer" className="website-link">
                <Globe size={14}/> Visit College Website <ExternalLink size={12}/>
              </a>
            )}
          </div>
        )}
      </div>
    );
  };

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="pred-page animate-fade-in">

      {/* ── Hero Form ── */}
      <div className="hero-section">
        <div className="hero-text">
          <h1><Compass size={32} className="hero-icon"/> MHT CET College Predictor</h1>
          <p>Instantly estimate your admission possibilities and build your target preference list using official 3-year CAP round cutoffs.</p>
        </div>

        <form onSubmit={handleSearch} className="search-form glass-panel">
          {/* Row 1: Percentile + Category + Gender + Type */}
          <div className="form-row-main">
            <div className="form-field">
              <label>MHT CET Percentile <span className="req">*</span></label>
              <input
                type="number"
                min="0" max="100" step="0.0001"
                placeholder="e.g. 94.65"
                value={percentile}
                onChange={e => setPercentile(e.target.value)}
                className="text-input"
                required
              />
            </div>
            <div className="form-field">
              <label>Caste Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)} className="sel-input">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>Gender</label>
              <select value={gender} onChange={e => setGender(e.target.value)} className="sel-input">
                <option value="M">Male</option>
                <option value="F">Female</option>
              </select>
            </div>
            <div className="form-field">
              <label>College Type</label>
              <select value={govPref} onChange={e => setGovPref(e.target.value)} className="sel-input">
                <option value="ANY">Any Type</option>
                <option value="GOVT">Government / Aided Only</option>
                <option value="PVT">Private Colleges Only</option>
              </select>
            </div>
          </div>

          {/* Branches */}
          <div className="chips-field">
            <label>Preferred Branches <span className="hint-text">(select multiple — leave blank for all)</span></label>
            <div className="chips-row">
              {ALL_BRANCHES.map(b => (
                <button key={b} type="button"
                  className={`chip ${selectedBranches.includes(b) ? 'chip-active' : ''}`}
                  onClick={() => toggleBranch(b)}
                >{b}</button>
              ))}
            </div>
          </div>

          {/* Advanced Toggle */}
          <button type="button" className="adv-toggle" onClick={() => setShowAdvanced(!showAdvanced)}>
            <Filter size={16}/> {showAdvanced ? 'Hide' : 'Show'} District Preferences
          </button>

          {showAdvanced && (
            <div className="advanced-section">
              <div className="chips-field">
                <label>Preferred Districts <span className="hint-text">(select multiple — leave blank for all Maharashtra)</span></label>
                <div className="chips-row">
                  {DISTRICTS.map(d => (
                    <button key={d} type="button"
                      className={`chip ${selectedDistricts.includes(d) ? 'chip-active' : ''}`}
                      onClick={() => toggleDistrict(d)}
                    >{d}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {error && <p className="form-error">{error}</p>}

          <button type="submit" className="predict-btn" disabled={loading}>
            {loading ? (
              <><RefreshCw size={18} className="spinner-ring" style={{ width: 16, height: 16, margin: 0 }}/> Analyzing Historic Records...</>
            ) : (
              <><Zap size={18}/> Predict My College List</>
            )}
          </button>
        </form>
      </div>

      {/* ── Results Section ── */}
      {loading && (
        <div className="loading-state">
          <div className="spinner-ring"/>
          <p>Scanning 35,000+ historical records across 379 engineering colleges... please wait.</p>
        </div>
      )}

      {results && !loading && (
        <div className="results-section">
          {/* Summary Bar */}
          <div className="summary-bar glass-panel">
            <div className="summary-left">
              <Compass size={20} className="summary-icon"/>
              <span>Found <strong>{totalResults}</strong> matching choices for <strong>{percentile}%ile</strong> ({category} Category)</span>
            </div>
            <div className="bucket-tabs">
              {BUCKETS.map(b => {
                const count = processResults(results[b] || []).length;
                const meta  = BUCKET_META[b];
                return (
                  <button
                    key={b}
                    className={`bucket-tab ${activeBucket === b ? 'tab-active' : ''}`}
                    style={activeBucket === b ? { borderColor: meta.color, color: meta.color } : {}}
                    onClick={() => setActiveBucket(b)}
                  >
                    <span className="tab-icon">{meta.icon}</span>
                    <span>{b}</span>
                    <span className="tab-count" style={{ background: meta.bg, color: meta.color }}>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Filter Row */}
          <div className="filter-bar glass-panel">
            <div className="filter-search-wrap">
              <Search size={16} className="fsearch-icon"/>
              <input
                type="text"
                placeholder="Search college name, branch, code..."
                className="filter-search"
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
              />
              {searchQ && <button className="clear-btn" onClick={() => setSearchQ('')}><X size={16}/></button>}
            </div>
            <select className="filter-sel" value={filterDistrict} onChange={e => setFilterDistrict(e.target.value)}>
              <option value="ALL">All Districts</option>
              {allResultDistricts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select className="filter-sel" value={filterBranch} onChange={e => setFilterBranch(e.target.value)}>
              <option value="ALL">All Branches</option>
              {allResultBranches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <select className="filter-sel" value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="PROB_DESC">Highest Probability</option>
              <option value="PROB_ASC">Lowest Probability</option>
              <option value="FEES_ASC">Lowest Annual Fees</option>
            </select>
          </div>

          {/* Active Bucket Content */}
          {(() => {
            const meta  = BUCKET_META[activeBucket];
            const list  = processResults(results[activeBucket] || []);
            return (
              <div className="bucket-section">
                <div className="bucket-heading" style={{ borderColor: meta.color }}>
                  <span className="bh-icon" style={{ color: meta.color }}>{meta.icon}</span>
                  <div>
                    <h2 style={{ color: meta.color }}>{activeBucket} Target Colleges <span className="bh-range">({meta.label} Chance)</span></h2>
                    <p className="bh-desc">{meta.desc}</p>
                  </div>
                  <span className="bh-count" style={{ background: meta.bg, color: meta.color }}>{list.length} Options</span>
                </div>

                {list.length === 0 ? (
                  <div className="empty-state">
                    <p>No colleges found matching your search query or filters in this category.</p>
                    {(searchQ || filterDistrict !== 'ALL' || filterBranch !== 'ALL') && (
                      <button className="clear-all-btn" onClick={() => { setSearchQ(''); setFilterDistrict('ALL'); setFilterBranch('ALL'); }}>
                        Reset Filters
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="cards-list">
                    {list.map(item => renderCard(item, activeBucket))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Bottom CTA */}
          <div className="bottom-cta glass-panel">
            <div>
              <h3>Arrange your Target Preferences</h3>
              <p>Arranged your target choices? Head over to the Preference Builder to prioritize and export your option form list.</p>
            </div>
            <Link href="/preference-builder" className="btn btn-primary">
              Arrange Preference Order →
            </Link>
          </div>
        </div>
      )}

      {/* Hint Cards on First Visit */}
      {!hasSearched && !loading && (
        <div className="first-visit-hint">
          <div className="hint-cards-row">
            {[
              { icon: '📊', title: 'Cutoff Analytics', desc: 'Weighted trend predictions based on official 3-year CAP cutoff database' },
              { icon: '🏛️', title: '379 Colleges', desc: 'Complete list of all registered government & private engineering colleges' },
              { icon: '🎯', title: 'Reservation Aware', desc: 'Supports OPEN, OBC, SC, ST, EWS, TFWS & Defence categories' },
              { icon: '💼', title: 'Placement Insights', desc: 'Access average packages, annual fee structures and hostel details' },
            ].map(h => (
              <div key={h.title} className="hint-card glass-panel">
                <span className="hint-emoji">{h.icon}</span>
                <h4>{h.title}</h4>
                <p>{h.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

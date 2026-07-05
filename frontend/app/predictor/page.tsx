"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { API_BASE_URL } from '../config';
import {
  Compass, Search, ChevronDown, ChevronUp, Plus, BookmarkCheck,
  MapPin, Award, TrendingUp, Shield, Star, Target, Zap,
  Filter, X, BarChart2, Globe, ExternalLink
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
  'Instrumentation Engineering',
  'Production Engineering',
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

  // Accordion
  const [expanded, setExpanded]     = useState<Set<string>>(new Set());
  // Saved preferences
  const [saved, setSaved]           = useState<Set<string>>(new Set());
  // Active bucket tab
  const [activeBucket, setActiveBucket] = useState<string>('Safe');

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
  };

  const processResults = (list: CollegeResult[]) => {
    let out = [...list];
    if (searchQ) {
      const q = searchQ.toLowerCase();
      out = out.filter(i => i.college.name.toLowerCase().includes(q) || i.branch.name.toLowerCase().includes(q) || i.college.code.toString().includes(q));
    }
    if (filterDistrict !== 'ALL') out = out.filter(i => i.college.district.name === filterDistrict);
    if (filterBranch !== 'ALL')   out = out.filter(i => i.branch.name === filterBranch);
    if (sortBy === 'PROB_DESC')   out.sort((a, b) => b.admission_probability - a.admission_probability);
    if (sortBy === 'PROB_ASC')    out.sort((a, b) => a.admission_probability - b.admission_probability);
    if (sortBy === 'FEES_ASC')    out.sort((a, b) => (a.college.fees ?? 999999) - (b.college.fees ?? 999999));
    if (sortBy === 'CUTOFF_ASC')  out.sort((a, b) => a.admission_probability - b.admission_probability);
    return out;
  };

  const allResultDistricts = results ? [...new Set(Object.values(results).flat().map(i => i.college.district.name))].sort() : [];
  const allResultBranches  = results ? [...new Set(Object.values(results).flat().map(i => i.branch.name))].sort() : [];
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
              <span className="code-badge">#{item.college.code}</span>
              <span className="status-badge">{item.college.status}</span>
              {item.college.autonomous && <span className="auto-badge">Autonomous</span>}
            </div>
            <h3 className="college-name">{item.college.name}</h3>
            <p className="branch-name">{item.branch.name}</p>
            <div className="meta-row">
              <span className="meta-item"><MapPin size={11}/>{item.college.district.name}</span>
              {item.college.fees && <span className="meta-item">₹{(item.college.fees/1000).toFixed(0)}K/yr</span>}
              {item.college.average_package && <span className="meta-item"><BarChart2 size={11}/>{item.college.average_package} LPA avg</span>}
              {item.college.hostel_availability && <span className="meta-item hostel">🏠 Hostel</span>}
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
              {isSaved ? <><BookmarkCheck size={14}/> Saved</> : <><Plus size={14}/> Add Pref</>}
            </button>
          </div>
        </div>

        {/* Probability Bar */}
        <div className="prob-bar-track">
          <div className="prob-bar-fill" style={{ width: `${item.admission_probability}%`, background: meta.color }}/>
        </div>

        {/* Explanation */}
        <p className="explanation-text">{item.explanation.slice(0, 160)}{item.explanation.length > 160 ? '...' : ''}</p>

        {/* Accordion: Historical Cutoffs */}
        <button className="cutoff-toggle" onClick={() => toggleExpand(id)}>
          {isExpanded ? <><ChevronUp size={14}/> Hide cutoff history</> : <><ChevronDown size={14}/> Show 3-year closing cutoffs</>}
        </button>

        {isExpanded && (
          <div className="cutoff-table-wrap">
            <table className="cutoff-table">
              <thead>
                <tr><th>Year</th><th>Round</th><th>Category</th><th>Closing %ile</th><th>Rank</th></tr>
              </thead>
              <tbody>
                {Object.entries(item.category_closing_percentiles).map(([yr, entries]) =>
                  entries.map((e, idx) => (
                    <tr key={`${yr}_${idx}`}>
                      <td>{yr}</td>
                      <td>R{e.round}</td>
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
                <Globe size={12}/> Official Website <ExternalLink size={10}/>
              </a>
            )}
          </div>
        )}
      </div>
    );
  };

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="pred-page">

      {/* ── Hero Form ── */}
      <div className="hero-section">
        <div className="hero-text">
          <h1><Compass size={28} className="hero-icon"/> MHT CET College Predictor</h1>
          <p>Enter your percentile to instantly see which colleges you can get — based on official 3-year CAP cutoff data.</p>
        </div>

        <form onSubmit={handleSearch} className="search-form glass-panel">
          {/* Row 1: Percentile + Category + Gender */}
          <div className="form-row-main">
            <div className="form-field">
              <label>MHT CET Percentile <span className="req">*</span></label>
              <input
                type="number"
                min="0" max="100" step="0.0001"
                placeholder="e.g. 92.45"
                value={percentile}
                onChange={e => setPercentile(e.target.value)}
                className="text-input"
                required
              />
            </div>
            <div className="form-field">
              <label>Category</label>
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
                <option value="ANY">Any</option>
                <option value="GOVT">Government Only</option>
                <option value="PVT">Private Only</option>
              </select>
            </div>
          </div>

          {/* Branches */}
          <div className="chips-field">
            <label>Preferred Branches <span className="hint-text">(select any — leave blank for all)</span></label>
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
            <Filter size={14}/> {showAdvanced ? 'Hide' : 'Show'} District & Advanced Filters
          </button>

          {showAdvanced && (
            <div className="advanced-section">
              <div className="chips-field">
                <label>Preferred Districts <span className="hint-text">(leave blank for all Maharashtra)</span></label>
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
              <><span className="btn-spinner"/>&nbsp;&nbsp;Analyzing {totalResults > 0 ? totalResults : ''} records...</>
            ) : (
              <><Zap size={18}/>&nbsp;Predict My Colleges</>
            )}
          </button>
        </form>
      </div>

      {/* ── Results Section ── */}
      {loading && (
        <div className="loading-state">
          <div className="spinner-ring"/>
          <p>Scanning 35,000+ historical cutoff records across 379 colleges...</p>
        </div>
      )}

      {results && !loading && (
        <div className="results-section">
          {/* Summary Bar */}
          <div className="summary-bar glass-panel">
            <div className="summary-left">
              <Compass size={18} className="summary-icon"/>
              <span><strong>{totalResults}</strong> colleges matched for <strong>{percentile}%ile</strong> — <strong>{category}</strong> category</span>
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
              <Search size={15} className="fsearch-icon"/>
              <input
                type="text"
                placeholder="Search college or branch..."
                className="filter-search"
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
              />
              {searchQ && <button className="clear-btn" onClick={() => setSearchQ('')}><X size={14}/></button>}
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
              <option value="FEES_ASC">Lowest Fees First</option>
            </select>
          </div>

          {/* Active Bucket Header */}
          {(() => {
            const meta  = BUCKET_META[activeBucket];
            const list  = processResults(results[activeBucket] || []);
            return (
              <div className="bucket-section">
                <div className="bucket-heading" style={{ borderColor: meta.color }}>
                  <span className="bh-icon" style={{ color: meta.color }}>{meta.icon}</span>
                  <div>
                    <h2 style={{ color: meta.color }}>{activeBucket} <span className="bh-range">({meta.label})</span></h2>
                    <p className="bh-desc">{meta.desc}</p>
                  </div>
                  <span className="bh-count" style={{ background: meta.bg, color: meta.color }}>{list.length} colleges</span>
                </div>

                {list.length === 0 ? (
                  <div className="empty-state">
                    <p>No colleges in this bucket match your current filters.</p>
                    {(searchQ || filterDistrict !== 'ALL' || filterBranch !== 'ALL') && (
                      <button className="clear-all-btn" onClick={() => { setSearchQ(''); setFilterDistrict('ALL'); setFilterBranch('ALL'); }}>
                        Clear filters
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
              <h3>Built your target list?</h3>
              <p>Go to the Preference Builder to arrange colleges in your official CAP order.</p>
            </div>
            <Link href="/preference-builder" className="btn btn-primary">
              Open Preference Builder →
            </Link>
          </div>
        </div>
      )}

      {/* ── Empty State (first visit) ── */}
      {!hasSearched && !loading && (
        <div className="first-visit-hint">
          <div className="hint-cards-row">
            {[
              { icon: '📊', title: '35,000+ Records', desc: 'Official CAP cutoffs from 2022–23, 2023–24 loaded' },
              { icon: '🏛️', title: '379 Colleges', desc: 'All Maharashtra govt & private engineering colleges' },
              { icon: '🎯', title: 'Category-Aware', desc: 'OPEN, OBC, SC, ST, EWS, TFWS & more supported' },
              { icon: '📋', title: '3-Year Trend', desc: 'Weighted probability based on 3 years of closing cutoffs' },
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

<style jsx>{`
  .pred-page { max-width: 100%; }

  /* ── Hero ── */
  .hero-section { margin-bottom: 32px; }
  .hero-text { margin-bottom: 20px; }
  .hero-text h1 {
    font-size: clamp(1.4rem, 3vw, 2rem);
    font-weight: 800;
    display: flex; align-items: center; gap: 12px;
    margin-bottom: 8px;
  }
  .hero-icon { color: var(--accent-primary); }
  .hero-text p { color: var(--text-secondary); font-size: 0.95rem; }

  /* ── Search Form ── */
  .search-form { padding: 28px; display: flex; flex-direction: column; gap: 20px; }

  .form-row-main {
    display: grid;
    grid-template-columns: 2fr 1.2fr 1fr 1.2fr;
    gap: 16px;
    align-items: end;
  }
  .form-field { display: flex; flex-direction: column; gap: 6px; }
  .form-field label { font-size: 0.75rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.04em; }
  .req { color: var(--accent-primary); }
  .hint-text { font-size: 0.7rem; color: var(--text-secondary); text-transform: none; font-weight: 400; }

  .text-input, .sel-input {
    padding: 11px 14px;
    background: rgba(0,0,0,0.25);
    border: 1.5px solid var(--panel-border);
    border-radius: 10px;
    color: var(--text-primary);
    font-size: 0.95rem;
    outline: none;
    transition: border-color 0.2s;
    width: 100%;
  }
  .text-input:focus, .sel-input:focus { border-color: var(--accent-primary); }

  /* ── Chips ── */
  .chips-field { display: flex; flex-direction: column; gap: 10px; }
  .chips-field label { font-size: 0.75rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.04em; }
  .chips-row { display: flex; flex-wrap: wrap; gap: 8px; }
  .chip {
    padding: 6px 14px;
    border-radius: 20px;
    background: rgba(255,255,255,0.04);
    border: 1.5px solid var(--panel-border);
    color: var(--text-secondary);
    font-size: 0.78rem;
    cursor: pointer;
    transition: all 0.18s;
    white-space: nowrap;
  }
  .chip:hover { background: rgba(255,255,255,0.08); color: var(--text-primary); }
  .chip-active {
    background: rgba(99,102,241,0.15);
    border-color: var(--accent-primary);
    color: var(--accent-primary);
    font-weight: 600;
  }

  .adv-toggle {
    display: inline-flex; align-items: center; gap: 6px;
    background: transparent; border: none;
    color: var(--accent-secondary); font-size: 0.82rem;
    cursor: pointer; text-decoration: underline; padding: 0;
    width: fit-content;
  }
  .advanced-section { padding: 16px 0 0 0; border-top: 1px solid var(--panel-border); }

  .form-error {
    background: rgba(239,68,68,0.1);
    border: 1px solid rgba(239,68,68,0.3);
    color: #f87171;
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 0.85rem;
  }

  .predict-btn {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    padding: 14px 28px;
    background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
    color: #fff;
    border: none; border-radius: 12px;
    font-size: 1rem; font-weight: 700; cursor: pointer;
    transition: opacity 0.2s, transform 0.1s;
  }
  .predict-btn:hover { opacity: 0.9; transform: translateY(-1px); }
  .predict-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
  .btn-spinner {
    width: 16px; height: 16px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    display: inline-block;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Loading ── */
  .loading-state { text-align: center; padding: 60px 20px; }
  .spinner-ring {
    width: 56px; height: 56px;
    border: 4px solid rgba(255,255,255,0.06);
    border-top-color: var(--accent-primary);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 20px;
  }
  .loading-state p { color: var(--text-secondary); font-size: 0.9rem; }

  /* ── Summary Bar ── */
  .summary-bar {
    display: flex; align-items: center; justify-content: space-between;
    flex-wrap: wrap; gap: 16px;
    padding: 14px 20px; margin-bottom: 16px;
  }
  .summary-left { display: flex; align-items: center; gap: 10px; color: var(--text-secondary); font-size: 0.88rem; }
  .summary-icon { color: var(--accent-primary); }

  /* ── Bucket Tabs ── */
  .bucket-tabs { display: flex; gap: 8px; flex-wrap: wrap; }
  .bucket-tab {
    display: flex; align-items: center; gap: 6px;
    padding: 7px 14px;
    background: rgba(255,255,255,0.03);
    border: 1.5px solid var(--panel-border);
    border-radius: 8px;
    color: var(--text-secondary);
    font-size: 0.8rem; cursor: pointer;
    transition: all 0.18s;
    white-space: nowrap;
  }
  .bucket-tab:hover { background: rgba(255,255,255,0.07); }
  .tab-active { font-weight: 700; }
  .tab-icon { display: flex; align-items: center; }
  .tab-count {
    padding: 2px 7px;
    border-radius: 10px;
    font-size: 0.72rem; font-weight: 700;
  }

  /* ── Filter Bar ── */
  .filter-bar {
    display: flex; align-items: center; flex-wrap: wrap; gap: 12px;
    padding: 12px 16px; margin-bottom: 20px;
  }
  .filter-search-wrap {
    display: flex; align-items: center; gap: 0;
    position: relative; flex: 1; min-width: 180px;
  }
  .fsearch-icon { position: absolute; left: 11px; color: var(--text-secondary); pointer-events: none; }
  .filter-search {
    width: 100%; padding: 9px 36px 9px 32px;
    background: rgba(0,0,0,0.2);
    border: 1.5px solid var(--panel-border);
    border-radius: 8px; color: var(--text-primary);
    font-size: 0.85rem; outline: none;
  }
  .filter-search:focus { border-color: var(--accent-primary); }
  .clear-btn {
    position: absolute; right: 8px;
    background: transparent; border: none;
    color: var(--text-secondary); cursor: pointer;
    display: flex; align-items: center;
  }
  .filter-sel {
    padding: 9px 12px;
    background: rgba(0,0,0,0.2);
    border: 1.5px solid var(--panel-border);
    border-radius: 8px; color: var(--text-primary);
    font-size: 0.82rem; outline: none;
    min-width: 140px;
  }

  /* ── Bucket Section ── */
  .bucket-section { margin-bottom: 32px; }
  .bucket-heading {
    display: flex; align-items: center; gap: 14px;
    border-left: 4px solid;
    padding: 12px 16px;
    background: rgba(255,255,255,0.02);
    border-radius: 0 10px 10px 0;
    margin-bottom: 16px; flex-wrap: wrap;
  }
  .bh-icon { display: flex; }
  .bucket-heading h2 { font-size: 1.1rem; font-weight: 700; margin: 0; }
  .bh-range { font-size: 0.8rem; font-weight: 400; opacity: 0.75; }
  .bh-desc { font-size: 0.8rem; color: var(--text-secondary); margin: 2px 0 0; }
  .bh-count {
    margin-left: auto;
    padding: 4px 12px; border-radius: 20px;
    font-size: 0.82rem; font-weight: 700;
  }

  .cards-list { display: flex; flex-direction: column; gap: 14px; }

  /* ── Result Card ── */
  .result-card {
    background: rgba(255,255,255,0.03);
    border: 1px solid var(--panel-border);
    border-radius: 14px;
    padding: 18px 20px;
    display: flex; flex-direction: column; gap: 12px;
    transition: border-color 0.2s, transform 0.15s;
  }
  .result-card:hover { border-color: rgba(255,255,255,0.12); transform: translateY(-1px); }

  .card-top { display: flex; justify-content: space-between; gap: 16px; }
  .card-left { flex: 1; }

  .card-badges-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
  .code-badge {
    font-size: 0.65rem; font-weight: 700; color: var(--accent-primary);
    background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.2);
    padding: 2px 7px; border-radius: 4px; letter-spacing: 0.04em;
  }
  .status-badge {
    font-size: 0.65rem; color: var(--text-secondary);
    background: rgba(255,255,255,0.04); border: 1px solid var(--panel-border);
    padding: 2px 7px; border-radius: 4px;
  }
  .auto-badge {
    font-size: 0.65rem; color: #a78bfa;
    background: rgba(167,139,250,0.1); border: 1px solid rgba(167,139,250,0.2);
    padding: 2px 7px; border-radius: 4px;
  }

  .college-name { font-size: 0.97rem; font-weight: 700; margin: 0 0 4px 0; line-height: 1.3; }
  .branch-name  { font-size: 0.82rem; color: var(--accent-secondary); font-weight: 600; margin: 0 0 8px 0; }

  .meta-row { display: flex; flex-wrap: wrap; gap: 10px; }
  .meta-item {
    display: flex; align-items: center; gap: 4px;
    font-size: 0.72rem; color: var(--text-secondary);
  }
  .hostel { color: #a78bfa; }

  .card-right {
    display: flex; flex-direction: column; align-items: center;
    gap: 10px; min-width: 90px;
  }
  .prob-circle {
    width: 80px; height: 80px;
    border-radius: 50%;
    border: 2.5px solid;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .prob-num { font-size: 1.2rem; font-weight: 800; line-height: 1; }
  .prob-tag { font-size: 0.55rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px; }

  .save-btn {
    display: flex; align-items: center; gap: 4px;
    padding: 6px 10px; border-radius: 8px;
    background: var(--accent-primary); color: #fff;
    border: none; font-size: 0.7rem; font-weight: 600;
    cursor: pointer; transition: all 0.2s; white-space: nowrap;
  }
  .save-btn:hover { opacity: 0.85; }
  .save-btn.saved {
    background: rgba(16,185,129,0.1); color: #10b981;
    border: 1px solid rgba(16,185,129,0.25); cursor: default;
  }

  .prob-bar-track {
    width: 100%; height: 3px;
    background: rgba(255,255,255,0.06); border-radius: 2px; overflow: hidden;
  }
  .prob-bar-fill { height: 100%; border-radius: 2px; transition: width 0.5s ease; }

  .explanation-text {
    font-size: 0.78rem; color: var(--text-secondary); line-height: 1.5;
    border-left: 2px solid var(--accent-primary);
    padding-left: 10px; margin: 0;
  }

  .cutoff-toggle {
    display: flex; align-items: center; gap: 5px;
    background: transparent; border: none;
    color: var(--accent-secondary); font-size: 0.76rem;
    font-weight: 600; cursor: pointer; text-decoration: underline;
    width: fit-content; padding: 0;
  }

  .cutoff-table-wrap {
    background: rgba(0,0,0,0.2); border-radius: 8px; padding: 12px;
    display: flex; flex-direction: column; gap: 10px;
  }
  .cutoff-table { width: 100%; border-collapse: collapse; font-size: 0.75rem; }
  .cutoff-table th, .cutoff-table td { padding: 5px 8px; border-bottom: 1px solid var(--panel-border); text-align: left; }
  .cutoff-table th { color: var(--text-secondary); font-weight: 600; }
  .cutoff-pct { color: var(--accent-primary); font-weight: 700; }
  .website-link {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 0.72rem; color: var(--text-secondary); text-decoration: underline;
  }
  .website-link:hover { color: var(--text-primary); }

  /* ── Empty State ── */
  .empty-state {
    text-align: center; padding: 40px 20px;
    border: 1px dashed var(--panel-border); border-radius: 12px;
    color: var(--text-secondary);
  }
  .clear-all-btn {
    margin-top: 12px; padding: 7px 16px;
    background: transparent; border: 1px solid var(--panel-border);
    color: var(--text-secondary); border-radius: 8px;
    font-size: 0.82rem; cursor: pointer;
  }
  .clear-all-btn:hover { color: var(--text-primary); }

  /* ── Bottom CTA ── */
  .bottom-cta {
    display: flex; align-items: center; justify-content: space-between;
    flex-wrap: wrap; gap: 16px; padding: 20px 24px; margin-top: 24px;
  }
  .bottom-cta h3 { font-size: 1rem; font-weight: 700; margin: 0 0 4px; }
  .bottom-cta p  { font-size: 0.82rem; color: var(--text-secondary); margin: 0; }

  /* ── First Visit Hint ── */
  .first-visit-hint { margin-top: 40px; }
  .hint-cards-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
  .hint-card { padding: 24px; text-align: center; }
  .hint-emoji { font-size: 2rem; display: block; margin-bottom: 10px; }
  .hint-card h4 { font-size: 0.9rem; font-weight: 700; margin: 0 0 6px; }
  .hint-card p  { font-size: 0.78rem; color: var(--text-secondary); margin: 0; line-height: 1.4; }

  /* ── Responsive ── */
  @media (max-width: 900px) {
    .form-row-main { grid-template-columns: 1fr 1fr; }
    .hint-cards-row { grid-template-columns: repeat(2, 1fr); }
    .summary-bar { flex-direction: column; align-items: flex-start; }
  }
  @media (max-width: 600px) {
    .form-row-main { grid-template-columns: 1fr; }
    .card-top { flex-direction: column; }
    .card-right { flex-direction: row; align-items: center; justify-content: space-between; width: 100%; }
    .prob-circle { width: 64px; height: 64px; }
    .prob-num { font-size: 1rem; }
    .bucket-tabs { gap: 6px; }
    .bucket-tab { padding: 6px 10px; font-size: 0.75rem; }
    .filter-bar { flex-direction: column; }
    .filter-sel, .filter-search-wrap { width: 100%; }
    .hint-cards-row { grid-template-columns: 1fr 1fr; }
    .bh-count { margin-left: 0; }
    .summary-bar { padding: 12px; }
    .search-form { padding: 18px; }
  }
`}</style>
    </div>
  );
}

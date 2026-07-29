"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { API_BASE_URL } from '../config';
import {
  Compass, Search, ChevronDown, ChevronUp, Plus, BookmarkCheck,
  MapPin, Award, TrendingUp, Shield, Star, Target, Zap,
  Filter, X, BarChart2, Globe, ExternalLink, RefreshCw
} from 'lucide-react';

// ─── Safe Local Storage Helper ───────────────────────────────────────────────
const safeStorage = {
  get: (key: string): string | null => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch (e) {}
    return null;
  },
  set: (key: string, val: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, val);
      }
    } catch (e) {}
  }
};

// ─── Types ───────────────────────────────────────────────────────────────────
interface CollegeResult {
  college: {
    code: number;
    name: string;
    district?: { name: string };
    university?: { name: string };
    status?: string;
    autonomous?: boolean;
    minority_status?: string | null;
    fees?: number | null;
    hostel_availability?: boolean;
    average_package?: number | null;
    highest_package?: number | null;
    official_website?: string | null;
  };
  branch: { code: string; name: string };
  cap_round: number;
  seat_type: string;
  admission_probability: number;
  category_closing_percentiles?: Record<string, Array<{ round: number; percentile: number; rank: number }>>;
  current_vacant_seats?: number;
  explanation?: string;
}

const CATEGORIES = ['OPEN', 'OBC', 'SC', 'ST', 'EWS', 'VJNT', 'NT1', 'NT2', 'NT3', 'SBC', 'TFWS', 'DEF'];

const POPULAR_BRANCHES = [
  'Computer Engineering',
  'Information Technology',
  'Computer Science and Engineering',
  'Artificial Intelligence and Data Science',
  'Artificial Intelligence and Machine Learning',
  'Cyber Security',
  'Data Science',
  'Computer Science and Business Systems',
  'Computer Science and Design',
  'Electronics and Telecommunication Engg',
  'Electronics Engineering',
  'Electronics and Computer Science',
  'Electrical Engineering',
  'Electrical and Electronics Engineering',
  'Mechanical Engineering',
  'Mechatronics Engineering',
  'Robotics and Automation',
  'Automation and Robotics',
  'Automobile Engineering',
  'Civil Engineering',
  'Chemical Engineering',
  'Bio Technology',
  'Bio Medical Engineering',
  'Instrumentation Engineering',
  'Production Engineering',
  'Aeronautical Engineering',
  'Metallurgy and Material Technology',
  'Food Engineering and Technology',
  'Textile Engineering / Technology',
];

const ALL_109_BRANCHES = [
  "Aeronautical Engineering",
  "Agricultural Engineering",
  "Architectural Assistantship",
  "Artificial Intelligence",
  "Artificial Intelligence (AI) and Data Science",
  "Artificial Intelligence and Data Science",
  "Artificial Intelligence and Machine Learning",
  "Automation and Robotics",
  "Automobile Engineering",
  "Bio Medical Engineering",
  "Bio Technology",
  "Chemical Engineering",
  "Civil Engineering",
  "Civil Engineering (Structural Engineering)",
  "Civil Engineering and Planning",
  "Civil Engineering with Computer Application",
  "Civil and Environmental Engineering",
  "Civil and infrastructure Engineering",
  "Computer Engineering",
  "Computer Engineering (Regional Language)",
  "Computer Engineering (Software Engineering)",
  "Computer Science",
  "Computer Science and Business Systems",
  "Computer Science and Design",
  "Computer Science and Engineering",
  "Computer Science and Engineering (Artificial Intelligence and Data Science)",
  "Computer Science and Engineering (Artificial Intelligence)",
  "Computer Science and Engineering (Cyber Security)",
  "Computer Science and Engineering (IoT)",
  "Computer Science and Engineering(Artificial Intelligence and Machine Learning)",
  "Computer Science and Engineering(Cyber Security)",
  "Computer Science and Engineering(Data Science)",
  "Computer Science and Information Technology",
  "Computer Science and Technology",
  "Computer Technology",
  "Cyber Security",
  "Data Engineering",
  "Data Science",
  "Dyestuff Technology",
  "Electrical Engg[Electronics and Power]",
  "Electrical Engineering",
  "Electrical and Computer Engineering",
  "Electrical and Electronics Engineering",
  "Electrical, Electronics and Power",
  "Electronics & Telecommunication Engineering",
  "Electronics Engineering",
  "Electronics Engineering ( VLSI Design and Technology)",
  "Electronics and Biomedical Engineering",
  "Electronics and Communication Engineering",
  "Electronics and Computer Engineering",
  "Electronics and Computer Science",
  "Electronics and Telecommunication Engg",
  "Fashion Technology",
  "Fibres and Textile Processing Technology",
  "Fire Engineering",
  "Food Engineering",
  "Food Engineering and Technology",
  "Food Technology",
  "Industrial IoT",
  "Information Technology",
  "Instrumentation Engineering",
  "Instrumentation and Control Engineering",
  "Internet of Things (IoT)",
  "Manufacturing Science and Engineering",
  "Mechanical & Automation Engineering",
  "Mechanical Engineering",
  "Mechanical Engineering Automobile",
  "Mechanical Engineering[Sandwich]",
  "Mechanical and Automation Engineering",
  "Mechatronics Engineering",
  "Metallurgy and Material Technology",
  "Mining Engineering",
  "Oil Technology",
  "Oil and Paints Technology",
  "Paints Technology",
  "Petro Chemical Engineering",
  "Pharmaceutical and Fine Chemical Technology",
  "Pharmaceuticals Chemistry and Technology",
  "Plastic Technology",
  "Plastic and Polymer Engineering",
  "Polymer Engineering and Technology",
  "Printing and Packing Technology",
  "Production Engineering",
  "Production Engineering[Sandwich]",
  "Robotics and Artificial Intelligence",
  "Robotics and Automation",
  "Safety and Fire Engineering",
  "Structural Engineering",
  "Surface Coating Technology",
  "Textile Chemistry",
  "Textile Engineering / Technology",
  "Textile Technology",
  "VLSI"
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

// ─── Main Predictor Component ────────────────────────────────────────────────
export default function PredictorPage() {
  const [percentile, setPercentile] = useState('');
  const [rank, setRank]             = useState('');
  const [category, setCategory]     = useState('OPEN');
  const [gender, setGender]         = useState('M');
  const [selectedBranches, setSelectedBranches]   = useState<string[]>([]);
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([]);
  const [govPref, setGovPref]       = useState('ANY');
  const [minority, setMinority]     = useState('None');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [results, setResults]       = useState<Record<string, CollegeResult[]> | null>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const [searchQ, setSearchQ]       = useState('');
  const [filterDistrict, setFilterDistrict] = useState('ALL');
  const [filterBranch, setFilterBranch]     = useState('ALL');
  const [sortBy, setSortBy]         = useState('PROB_DESC');

  const [expanded, setExpanded]     = useState<Set<string>>(new Set());
  const [saved, setSaved]           = useState<Set<string>>(new Set());
  const [activeBucket, setActiveBucket] = useState<string>('Safe');

  useEffect(() => {
    const raw = safeStorage.get('cap_preferences');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const keys = new Set<string>();
          parsed.forEach((item: any) => {
            if (item?.college?.code && item?.branch?.code) {
              keys.add(`${item.college.code}_${item.branch.code}`);
            }
          });
          setSaved(keys);
        }
      } catch (e) {}
    }
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!percentile) { setError('Please enter your MHT CET percentile.'); return; }
    const pct = parseFloat(percentile);
    if (isNaN(pct) || pct < 0 || pct > 100) { setError('Percentile must be between 0 and 100.'); return; }

    setLoading(true);
    setError('');
    setResults(null);
    setHasSearched(true);

    safeStorage.set('cap_student_profile', JSON.stringify({
      percentile: pct,
      rank: rank ? parseInt(rank, 10) : null,
      category,
      gender,
      minority_status: minority,
      home_university: ''
    }));

    try {
      const res = await fetch(`${API_BASE_URL}/api/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          percentile: pct,
          rank: rank ? parseInt(rank, 10) : null,
          category,
          gender,
          home_university: '',
          candidature_type: 'Type A',
          tfws_status: category === 'TFWS',
          defence_status: category === 'DEF',
          ph_status: false,
          minority_status: minority,
          preferred_branches: selectedBranches,
          preferred_districts: selectedDistricts,
          max_fees: null,
          gov_private_pref: govPref,
          autonomous_pref: 'ANY',
          hostel_required: false,
          placement_priority: false,
        }),
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch (jsonErr) {
        throw new Error(`Failed to parse backend response.`);
      }

      if (res.ok && data && typeof data === 'object') {
        setResults(data);
        const firstFull = BUCKETS.find(b => Array.isArray(data[b]) && data[b].length > 0);
        if (firstFull) setActiveBucket(firstFull);

        const localPrefsRaw = safeStorage.get('cap_preferences');
        if (localPrefsRaw) {
          try {
            const localPrefs: any[] = JSON.parse(localPrefsRaw);
            if (Array.isArray(localPrefs)) {
              const probMap = new Map<string, number>();
              Object.values(data).flat().forEach((item: any) => {
                if (item?.college?.code && item?.branch?.code && item?.admission_probability !== undefined) {
                  probMap.set(`${item.college.code}_${item.branch.code}`, item.admission_probability);
                }
              });

              let updatedAny = false;
              localPrefs.forEach((p: any) => {
                const k = `${p?.college?.code}_${p?.branch?.code}`;
                if (probMap.has(k)) {
                  p.admission_probability = probMap.get(k);
                  updatedAny = true;
                }
              });

              if (updatedAny) {
                safeStorage.set('cap_preferences', JSON.stringify(localPrefs));
                if (typeof window !== 'undefined') window.dispatchEvent(new Event('storage'));
              }
            }
          } catch (e) {}
        }
      } else {
        const errorMsg = data && data.detail ? (typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail)) : 'Failed to fetch predictions.';
        throw new Error(errorMsg);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error fetching predictions.');
    } finally {
      setLoading(false);
    }
  };

  const toggleBranch = (b: string) => {
    setSelectedBranches(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b]);
  };

  const toggleDistrict = (d: string) => {
    setSelectedDistricts(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  };

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  };

  const addToPreferences = (item: CollegeResult) => {
    if (!item?.college?.code || !item?.branch?.code) return;
    const colCode = item.college.code;
    const brCode = item.branch.code;
    const key = `${colCode}_${brCode}`;

    try {
      const raw = safeStorage.get('cap_preferences');
      const localPrefs: any[] = raw ? JSON.parse(raw) : [];
      if (Array.isArray(localPrefs)) {
        const exists = localPrefs.some(p => p?.college?.code === colCode && p?.branch?.code === brCode);
        if (!exists) {
          localPrefs.push({
            id: `local_${Date.now()}_${key}`,
            college: item.college,
            branch: item.branch,
            preference_order: localPrefs.length + 1,
            locked: false,
            admission_probability: item.admission_probability ?? 50.0,
          });
          safeStorage.set('cap_preferences', JSON.stringify(localPrefs));
          if (typeof window !== 'undefined') window.dispatchEvent(new Event('storage'));
        }
      }
      setSaved(prev => new Set([...prev, key]));
    } catch (e) {}
  };

  const processResults = (list: CollegeResult[]) => {
    if (!Array.isArray(list)) return [];
    let out = [...list];
    if (searchQ) {
      const q = searchQ.toLowerCase();
      out = out.filter(i =>
        (i.college?.name || '').toLowerCase().includes(q) ||
        (i.branch?.name || '').toLowerCase().includes(q) ||
        String(i.college?.code || '').includes(q)
      );
    }
    if (filterDistrict !== 'ALL') {
      out = out.filter(i => (i.college?.district?.name || '').toLowerCase() === filterDistrict.toLowerCase());
    }
    if (filterBranch !== 'ALL') {
      out = out.filter(i => i.branch?.name === filterBranch);
    }
    if (sortBy === 'PROB_DESC') out.sort((a, b) => (b.admission_probability || 0) - (a.admission_probability || 0));
    if (sortBy === 'PROB_ASC')  out.sort((a, b) => (a.admission_probability || 0) - (b.admission_probability || 0));
    if (sortBy === 'FEES_ASC')  out.sort((a, b) => (a.college?.fees ?? 999999) - (b.college?.fees ?? 999999));
    return out;
  };

  const allResultDistricts = (results && typeof results === 'object') ? [...new Set(Object.values(results).flat().map((i: any) => i?.college?.district?.name))].filter(Boolean).sort() as string[] : [];
  const allResultBranches  = (results && typeof results === 'object') ? [...new Set(Object.values(results).flat().map((i: any) => i?.branch?.name))].filter(Boolean).sort() as string[] : [];
  const totalResults       = (results && typeof results === 'object') ? Object.values(results).flat().length : 0;

  const renderCard = (item: CollegeResult, bucket: string) => {
    const colCode = item.college?.code || 0;
    const brCode = item.branch?.code || '';
    const id   = `${colCode}_${brCode}`;
    const meta = BUCKET_META[bucket] || BUCKET_META['Dream'];
    const isSaved   = saved.has(id);
    const isExpanded = expanded.has(id);
    const districtName = item.college?.district?.name || 'Maharashtra';
    const closingCutoffs = item.category_closing_percentiles || {};

    return (
      <div key={id} className="result-card">
        <div className="card-top">
          <div className="card-left">
            <div className="card-badges-row">
              <span className="code-badge">CODE: {colCode}</span>
              <span className="status-badge">{item.college?.status || 'College'}</span>
              {item.college?.autonomous && <span className="auto-badge">Autonomous</span>}
            </div>
            <h3 className="college-name">{item.college?.name || 'College Name'}</h3>
            <p className="branch-name">{item.branch?.name || 'Engineering Branch'}</p>
            <div className="meta-row">
              <span className="meta-item"><MapPin size={14}/> District: {districtName}</span>
              {item.college?.fees && <span className="meta-item">Annual Fee: ₹{item.college.fees.toLocaleString()}</span>}
              {item.college?.average_package && <span className="meta-item"><BarChart2 size={14}/> Avg pkg: {item.college.average_package} LPA</span>}
              {item.college?.hostel_availability && <span className="meta-item hostel">🏠 Hostel Available</span>}
            </div>
          </div>
          <div className="card-right">
            <div className="prob-circle" style={{ background: meta.bg, borderColor: meta.color }}>
              <span className="prob-num" style={{ color: meta.color }}>{item.admission_probability}%</span>
              <span className="prob-tag" style={{ color: meta.color }}>{bucket}</span>
            </div>
            <button className={`save-btn ${isSaved ? 'saved' : ''}`} onClick={() => addToPreferences(item)} disabled={isSaved}>
              {isSaved ? <><BookmarkCheck size={16}/> Added</> : <><Plus size={16}/> Add Preference</>}
            </button>
          </div>
        </div>
        <div className="prob-bar-track"><div className="prob-bar-fill" style={{ width: `${item.admission_probability}%`, background: meta.color }}/></div>
        {item.explanation && (
          <p className="explanation-text"><strong>AI Trend Analysis:</strong> {item.explanation}</p>
        )}
        <button className="cutoff-toggle" onClick={() => toggleExpand(id)}>
          {isExpanded ? <><ChevronUp size={14}/> Hide Closing Cutoffs</> : <><ChevronDown size={14}/> View 3-Year CAP Cutoff Details</>}
        </button>
        {isExpanded && (
          <div className="cutoff-table-wrap">
            <table className="cutoff-table">
              <thead><tr><th>Year</th><th>Round</th><th>Type</th><th>Percentile</th><th>Rank</th></tr></thead>
              <tbody>
                {Object.entries(closingCutoffs).map(([yr, entries]) => (entries || []).map((e, idx) => (
                  <tr key={`${yr}_${idx}`}><td>{yr}</td><td>R{e.round}</td><td>{item.seat_type}</td><td className="cutoff-pct">{e.percentile}%</td><td>#{e.rank}</td></tr>
                )))}
              </tbody>
            </table>
            {item.college?.official_website && (
              <a href={item.college.official_website} target="_blank" rel="noreferrer" className="website-link"><Globe size={14}/> Website <ExternalLink size={12}/></a>
            )}
          </div>
        )}
      </div>
    );
  };

  const displayBranchList = [...new Set([...POPULAR_BRANCHES, ...selectedBranches])];

  return (
    <div className="predictor-page main-container">
      <div className="page-header text-center">
        <div className="hero-badge"><Zap size={14} /> AI-Powered CAP Admission Predictor</div>
        <h1 className="gradient-text">MHT CET College List Predictor</h1>
        <p className="subtitle">Enter your MHT CET Percentile and Category to predict your college admission chances.</p>
      </div>

      <div className="form-card glass-panel">
        <form onSubmit={handleSearch}>
          <div className="form-grid">
            <div className="form-field">
              <label>MHT CET Percentile <span className="required">*</span></label>
              <input type="number" step="0.0000001" min="0" max="100" placeholder="e.g. 94.52" value={percentile} onChange={e => setPercentile(e.target.value)} className="sel-input" required />
            </div>
            <div className="form-field">
              <label>State General Rank <span className="hint-text">(optional)</span></label>
              <input type="number" placeholder="e.g. 12500" value={rank} onChange={e => setRank(e.target.value)} className="sel-input" />
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
                <option value="ANY">Any Type</option>
                <option value="GOVT">Government / Aided Only</option>
                <option value="PVT">Private Colleges Only</option>
              </select>
            </div>
            <div className="form-field">
              <label>Minority Status</label>
              <select value={minority} onChange={e => setMinority(e.target.value)} className="sel-input">
                <option value="None">None (General - No Minority)</option>
                <option value="Hindi Linguistic Minority">Hindi Linguistic Minority</option>
                <option value="Gujarati / Kutchhi Minority">Gujarati / Kutchhi Linguistic Minority</option>
                <option value="Sindhi Minority">Sindhi Linguistic Minority</option>
                <option value="South Indian Minority">South Indian (Tamil/Telugu/Malayalam) Minority</option>
                <option value="Punjabi Minority">Punjabi Linguistic Minority</option>
                <option value="Muslim Minority">Muslim Religious Minority</option>
                <option value="Christian Minority">Christian / Roman Catholic Religious Minority</option>
                <option value="Jain Minority">Jain Minority (Linguistic / Religious)</option>
                <option value="Sikh Minority">Sikh Religious Minority</option>
                <option value="Buddhist Minority">Buddhist Religious Minority</option>
                <option value="Parsi Minority">Parsi Religious Minority</option>
                <option value="Other Minority">Other Minority</option>
              </select>
            </div>
          </div>

          <div className="chips-field" style={{ marginTop: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
              <label>Preferred Branches <span className="hint-text">(select multiple — leave blank for all)</span></label>
              <select className="sel-input" style={{ width: 'auto', minWidth: '220px', padding: '6px 12px', fontSize: '0.82rem', borderRadius: '8px' }} value="" onChange={(e) => { if (e.target.value && !selectedBranches.includes(e.target.value)) setSelectedBranches(prev => [...prev, e.target.value]); }}>
                <option value="">+ Search/Add from All 109 Branches...</option>
                {ALL_109_BRANCHES.map(b => <option key={`opt_${b}`} value={b}>{b}</option>)}
              </select>
            </div>
            <div className="chips-row">
              {displayBranchList.map(b => {
                const active = selectedBranches.includes(b);
                return <button key={`b_chip_${b}`} type="button" className={`chip ${active ? 'chip-active' : ''}`} onClick={() => toggleBranch(b)}>{active && <span style={{ marginRight: '5px', fontWeight: 'bold' }}>✓</span>}{b}</button>
              })}
            </div>
          </div>

          <button type="button" className="adv-toggle" onClick={() => setShowAdvanced(!showAdvanced)} style={{ marginTop: '16px' }}>
            <Filter size={16}/> {showAdvanced ? 'Hide' : 'Show'} District Preferences
          </button>
          {showAdvanced && (
            <div className="advanced-section">
              <div className="chips-field">
                <label>Preferred Districts <span className="hint-text">(select multiple — leave blank for all Maharashtra)</span></label>
                <div className="chips-row">
                  {DISTRICTS.map(d => {
                    const active = selectedDistricts.includes(d);
                    return <button key={`d_chip_${d}`} type="button" className={`chip ${active ? 'chip-active' : ''}`} onClick={() => toggleDistrict(d)}>{active && <span style={{ marginRight: '5px', fontWeight: 'bold' }}>✓</span>}{d}</button>
                  })}
                </div>
              </div>
            </div>
          )}
          {error && <p className="form-error" style={{ marginTop: '12px' }}>{error}</p>}
          <button type="submit" className="predict-btn" disabled={loading} style={{ marginTop: '20px' }}>
            {loading ? <><RefreshCw size={18} className="spinner-ring" style={{ width: 16, height: 16, margin: 0 }}/> Analyzing Records...</> : <><Zap size={18}/> Predict My College List</>}
          </button>
        </form>
      </div>

      {results && (
        <div className="results-container">
          <div className="results-summary glass-panel">
            <div className="summary-info">
              <h2>Prediction Results</h2>
              <p>Found <strong>{totalResults}</strong> matching options across 4 probability tiers.</p>
            </div>
            <div className="bucket-tabs">
              {BUCKETS.map(b => {
                const count = (results[b] || []).length;
                const meta = BUCKET_META[b];
                const active = activeBucket === b;
                return (
                  <button key={b} className={`bucket-tab ${active ? 'active' : ''}`} onClick={() => setActiveBucket(b)} style={{ borderColor: active ? meta.color : 'transparent', background: active ? meta.bg : 'rgba(255,255,255,0.03)' }}>
                    <span className="tab-icon" style={{ color: meta.color }}>{meta.icon}</span>
                    <span className="tab-name">{b}</span>
                    <span className="tab-count" style={{ background: meta.color }}>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="toolbar-panel glass-panel">
            <div className="search-wrap">
              <Search size={16} className="fsearch-icon"/>
              <input type="text" placeholder="Search college name, choice code or branch..." value={searchQ} onChange={e => setSearchQ(e.target.value)} className="filter-search" />
              {searchQ && <button className="clear-btn" onClick={() => setSearchQ('')}><X size={14}/></button>}
            </div>
            <div className="filters-group">
              {allResultDistricts.length > 0 && (
                <select value={filterDistrict} onChange={e => setFilterDistrict(e.target.value)} className="filter-sel">
                  <option value="ALL">All Districts ({allResultDistricts.length})</option>
                  {allResultDistricts.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              )}
              {allResultBranches.length > 0 && (
                <select value={filterBranch} onChange={e => setFilterBranch(e.target.value)} className="filter-sel">
                  <option value="ALL">All Branches ({allResultBranches.length})</option>
                  {allResultBranches.map(br => <option key={br} value={br}>{br}</option>)}
                </select>
              )}
              <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="filter-sel">
                <option value="PROB_DESC">Probability: High to Low</option>
                <option value="PROB_ASC">Probability: Low to High</option>
                <option value="FEES_ASC">Tuition Fees: Low to High</option>
              </select>
            </div>
          </div>

          {(() => {
            const list = processResults(results[activeBucket] || []);
            return (
              <div className="bucket-content">
                <div className="bucket-header">
                  <h3>{activeBucket} Predictions ({list.length})</h3>
                  <p className="bucket-desc">{BUCKET_META[activeBucket]?.desc}</p>
                </div>
                {list.length === 0 ? (
                  <div className="empty-state glass-panel">
                    <p>No colleges found matching your search filters in <strong>{activeBucket}</strong> tier.</p>
                    {(searchQ || filterDistrict !== 'ALL' || filterBranch !== 'ALL') && (
                      <button className="btn btn-secondary" onClick={() => { setSearchQ(''); setFilterDistrict('ALL'); setFilterBranch('ALL'); }} style={{ marginTop: '12px' }}>Reset Filters</button>
                    )}
                  </div>
                ) : (
                  <div className="cards-list">{list.map(item => renderCard(item, activeBucket))}</div>
                )}
              </div>
            );
          })()}

          <div className="bottom-cta glass-panel" style={{ marginTop: '30px' }}>
            <div>
              <h3>Arrange your Target Preferences</h3>
              <p>Arranged your target choices? Head over to the Preference Builder to prioritize and export your option form list.</p>
            </div>
            <Link href="/preference-builder" className="btn btn-primary">Arrange Preference Order →</Link>
          </div>
        </div>
      )}
    </div>
  );
}

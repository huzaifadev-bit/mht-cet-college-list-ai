"use html";
"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { API_BASE_URL } from '../config';
import { 
  Search, 
  MapPin, 
  DollarSign, 
  TrendingUp, 
  Plus, 
  Compass, 
  Globe, 
  Map, 
  Award,
  AlertCircle,
  HelpCircle,
  FolderPlus,
  BookmarkCheck
} from 'lucide-react';

interface College {
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
  maps_location: string | null;
}

interface Branch {
  code: string;
  name: string;
}

interface PredictionResult {
  college: College;
  branch: Branch;
  cap_round: number;
  seat_type: string;
  admission_probability: number;
  category_closing_percentiles: Record<string, Array<{ round: number; percentile: number; rank: number }>>;
  current_vacant_seats: number;
  previous_vacant_seats: number;
  explanation: string;
}

export default function PredictorPage() {
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [predictions, setPredictions] = useState<Record<string, PredictionResult[]>>({
    "Safe": [],
    "High Chance": [],
    "Moderate Chance": [],
    "Dream": []
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Active Saved Preferences to check which ones are already added
  const [savedItems, setSavedItems] = useState<Array<{college_code: number, branch_code: string}>>([]);
  
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('ALL');
  const [selectedBranch, setSelectedBranch] = useState('ALL');
  const [sortBy, setSortBy] = useState('PROBABILITY_DESC');

  // Expanded Accordion State for cutoff details
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      try {
        const u = JSON.parse(savedUser);
        if (u.profile_data) {
          setProfile(u.profile_data);
          fetchPredictions(savedToken, u.profile_data);
          fetchActivePreferences(savedToken);
        } else {
          setError('Please configure your scores and preferences on the home page first.');
        }
      } catch (e) {
        setError('Error reading student profile.');
      }
    } else {
      setError('Please login to access the AI college predictor.');
    }
  }, []);

  const fetchActivePreferences = async (authToken: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/preferences/active`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        const items = data.items || [];
        setSavedItems(items.map((i: any) => ({
          college_code: i.college.code,
          branch_code: i.branch.code
        })));
      }
    } catch (e) {
      console.log('Error fetching active preferences:', e);
    }
  };

  const fetchPredictions = async (authToken: string, profData: any) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          percentile: profData.percentile,
          rank: profData.rank,
          category: profData.category,
          gender: profData.gender,
          home_university: profData.home_university,
          candidature_type: profData.candidature_type || 'Type A',
          tfws_status: profData.tfws_status || false,
          defence_status: profData.defence_status || false,
          ph_status: profData.ph_status || false,
          minority_status: profData.minority_status,
          preferred_branches: profData.preferred_branches || [],
          preferred_districts: profData.preferred_districts || [],
          max_fees: profData.max_fees || null,
          gov_private_pref: profData.gov_private_pref || 'ANY',
          autonomous_pref: profData.autonomous_pref || 'ANY',
          hostel_required: profData.hostel_required || false,
          placement_priority: profData.placement_priority || false
        })
      });
      const data = await res.json();
      if (res.ok) {
        setPredictions(data);
      } else {
        throw new Error(data.detail || 'Prediction calculation failed');
      }
    } catch (err: any) {
      setError(err.message || 'Error occurred while loading recommendations.');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    if (expandedIds.includes(id)) {
      setExpandedIds(expandedIds.filter(x => x !== id));
    } else {
      setExpandedIds([...expandedIds, id]);
    }
  };

  const handleAddToPreferences = async (item: PredictionResult) => {
    if (!token) return;
    
    // Check if already exists
    const exists = savedItems.some(
      s => s.college_code === item.college.code && s.branch_code === item.branch.code
    );
    if (exists) return;

    // Fetch existing preferences first
    try {
      const activeRes = await fetch(`${API_BASE_URL}/api/preferences/active`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const activeData = await activeRes.json();
      
      const currentItems = activeData.items || [];
      const newOrder = currentItems.length + 1;
      
      const updatedItems = currentItems.map((i: any) => ({
        college_code: i.college.code,
        branch_code: i.branch.code,
        preference_order: i.preference_order,
        locked: i.locked
      }));
      
      updatedItems.push({
        college_code: item.college.code,
        branch_code: item.branch.code,
        preference_order: newOrder,
        locked: false
      });
      
      const saveRes = await fetch(`${API_BASE_URL}/api/preferences`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: activeData.name || 'My CAP Preference List',
          items: updatedItems
        })
      });
      
      if (saveRes.ok) {
        setSavedItems([...savedItems, { college_code: item.college.code, branch_code: item.branch.code }]);
      } else {
        alert('Failed to add college to preference list');
      }
    } catch (e) {
      console.log('Error adding to preference list:', e);
    }
  };

  // Helper to extract unique districts and branches from loaded predictions
  const getFilterOptions = () => {
    const districts = new Set<string>();
    const branches = new Set<string>();
    
    Object.values(predictions).forEach((bucketList) => {
      bucketList.forEach((pred) => {
        districts.add(pred.college.district.name);
        branches.add(pred.branch.name);
      });
    });
    
    return {
      districts: Array.from(districts),
      branches: Array.from(branches)
    };
  };

  const { districts, branches } = getFilterOptions();

  // Filter and Sort function for a single bucket list
  const processBucketList = (bucketList: PredictionResult[]) => {
    let list = [...bucketList];
    
    // Search Query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        item => 
          item.college.name.toLowerCase().includes(q) || 
          item.college.code.toString().includes(q) || 
          item.branch.name.toLowerCase().includes(q)
      );
    }
    
    // District Filter
    if (selectedDistrict !== 'ALL') {
      list = list.filter(item => item.college.district.name === selectedDistrict);
    }
    
    // Branch Filter
    if (selectedBranch !== 'ALL') {
      list = list.filter(item => item.branch.name === selectedBranch);
    }
    
    // Sort
    list.sort((a, b) => {
      if (sortBy === 'PROBABILITY_DESC') {
        return b.admission_probability - a.admission_probability;
      }
      if (sortBy === 'FEES_ASC') {
        const feesA = a.college.fees ?? 999999;
        const feesB = b.college.fees ?? 999999;
        return feesA - feesB;
      }
      if (sortBy === 'PLACEMENT_DESC') {
        const pkgA = a.college.average_package ?? 0;
        const pkgB = b.college.average_package ?? 0;
        return pkgB - pkgA;
      }
      return 0;
    });
    
    return list;
  };

  const rendersBucketCard = (item: PredictionResult, statusBucket: string) => {
    const id = `${item.college.code}_${item.branch.code}`;
    const isExpanded = expandedIds.includes(id);
    
    const isAdded = savedItems.some(
      s => s.college_code === item.college.code && s.branch_code === item.branch.code
    );

    // Probability indicator color
    let probColor = 'var(--success-color)';
    if (statusBucket === 'High Chance') probColor = 'var(--accent-secondary)';
    if (statusBucket === 'Moderate Chance') probColor = 'var(--warning-color)';
    if (statusBucket === 'Dream') probColor = 'var(--error-color)';

    return (
      <div key={id} className="prediction-card glass-panel animate-fade-in">
        <div className="card-primary-row">
          <div className="college-info">
            <span className="college-code">CODE: {item.college.code}</span>
            <h3>{item.college.name}</h3>
            <p className="branch-label">{item.branch.name} ({item.branch.code})</p>
            
            <div className="college-metadata-row">
              <span className="meta-badge"><MapPin size={12} /> {item.college.district.name}</span>
              <span className="meta-badge"><Award size={12} /> {item.college.status}</span>
              {item.college.autonomous && <span className="meta-badge label-auto">Autonomous</span>}
              {item.college.hostel_availability && <span className="meta-badge">Hostel Available</span>}
            </div>
          </div>

          <div className="prediction-metrics">
            <div className="probability-display" style={{ color: probColor }}>
              <span className="prob-pct">{item.admission_probability}%</span>
              <span className="prob-lbl">{statusBucket}</span>
            </div>
            
            <button 
              className={`add-pref-btn ${isAdded ? 'added' : ''}`}
              onClick={() => handleAddToPreferences(item)}
              disabled={isAdded}
            >
              {isAdded ? (
                <>
                  <BookmarkCheck size={16} />
                  <span>Added</span>
                </>
              ) : (
                <>
                  <Plus size={16} />
                  <span>Add Preference</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Dynamic visual probability bar */}
        <div className="probability-bar-bg">
          <div 
            className="probability-bar-fill" 
            style={{ width: `${item.admission_probability}%`, backgroundColor: probColor }}
          ></div>
        </div>

        <div className="card-secondary-details">
          <div className="details-grid">
            <div>
              <p className="detail-lbl">Average Placement</p>
              <p className="detail-val">{item.college.average_package ? `${item.college.average_package} LPA` : 'N/A'}</p>
            </div>
            <div>
              <p className="detail-lbl">Highest Placement</p>
              <p className="detail-val">{item.college.highest_package ? `${item.college.highest_package} LPA` : 'N/A'}</p>
            </div>
            <div>
              <p className="detail-lbl">Annual Open Fees</p>
              <p className="detail-val">{item.college.fees ? `Rs. ${item.college.fees.toLocaleString()}` : 'N/A'}</p>
            </div>
            <div>
              <p className="detail-lbl">Vacant Seats</p>
              <p className="detail-val badge-vacant">{item.current_vacant_seats} vacant</p>
            </div>
          </div>
          
          <p className="ai-explanation">
            <strong>AI Trend Review:</strong> {item.explanation}
          </p>

          {/* Cutoffs Toggle Accordion */}
          <div className="accordion-wrapper">
            <button className="accordion-trigger-btn" onClick={() => toggleExpand(id)}>
              {isExpanded ? 'Hide Historical Cutoffs' : 'Show Historical Cutoffs & Links'}
            </button>
            
            {isExpanded && (
              <div className="accordion-content">
                <table className="cutoffs-table">
                  <thead>
                    <tr>
                      <th>Year</th>
                      <th>CAP Round</th>
                      <th>Seat Category</th>
                      <th>Percentile</th>
                      <th>Closing Rank</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(item.category_closing_percentiles).map(([yr, entries]) => 
                      entries.map((entry, idx) => (
                        <tr key={`${yr}_${idx}`}>
                          <td>{yr}</td>
                          <td>Round {entry.round}</td>
                          <td>{item.seat_type}</td>
                          <td style={{ color: 'var(--accent-primary)', fontWeight: '600' }}>{entry.percentile}%</td>
                          <td>#{entry.rank}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                <div className="links-row">
                  {item.college.official_website && (
                    <a href={item.college.official_website} target="_blank" rel="noreferrer" className="link-item">
                      <Globe size={14} /> Official Website
                    </a>
                  )}
                  {item.college.maps_location && (
                    <a href={item.college.maps_location} target="_blank" rel="noreferrer" className="link-item">
                      <Map size={14} /> Google Maps
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="predictor-workspace animate-fade-in">
      <div className="page-header">
        <div className="title-area">
          <Compass className="header-icon" />
          <div>
            <h1>AI College Admission Predictor</h1>
            <p>Recommendations classified based on your percentile & category preferences.</p>
          </div>
        </div>
        
        {profile && (
          <div className="scores-badge glass-panel">
            <div>
              <span className="badge-lbl">YOUR Percentile</span>
              <span className="badge-val">{profile.percentile}%</span>
            </div>
            <div>
              <span className="badge-lbl">State Rank</span>
              <span className="badge-val">#{profile.rank}</span>
            </div>
            <div>
              <span className="badge-lbl">Category</span>
              <span className="badge-val">{profile.category}</span>
            </div>
          </div>
        )}
      </div>

      {error ? (
        <div className="error-card glass-panel">
          <AlertCircle size={32} className="error-icon" />
          <p>{error}</p>
          <Link href="/" className="btn btn-primary mt-15">
            Configure Profile Scores
          </Link>
        </div>
      ) : loading ? (
        <div className="loader-container">
          <div className="loader"></div>
          <p>AI Engine is analyzing historic closing cutoffs and vacancies... please wait.</p>
        </div>
      ) : (
        <>
          {/* SEARCH & FILTERS WORKSPACE */}
          <div className="filters-workspace glass-panel">
            <div className="search-box">
              <Search className="search-icon" size={18} />
              <input 
                type="text" 
                placeholder="Search by college name, code, or branch..." 
                className="search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="dropdowns-row">
              <div className="filter-group">
                <label>Preferred District</label>
                <select value={selectedDistrict} onChange={(e) => setSelectedDistrict(e.target.value)} className="filter-select">
                  <option value="ALL">All Districts</option>
                  {districts.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <div className="filter-group">
                <label>Branch Select</label>
                <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)} className="filter-select">
                  <option value="ALL">All Branches</option>
                  {branches.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>

              <div className="filter-group">
                <label>Sort Results By</label>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="filter-select">
                  <option value="PROBABILITY_DESC">Highest Probability First</option>
                  <option value="FEES_ASC">Lowest Annual Fees First</option>
                  <option value="PLACEMENT_DESC">Highest Placements First</option>
                </select>
              </div>
            </div>
          </div>

          {/* BUCKETS GRID CONTAINER */}
          <div className="buckets-grid">
            {/* SAFE BUCKET */}
            <div className="bucket-column">
              <div className="bucket-header">
                <span className="badge badge-safe">95–100%</span>
                <h2>Safe Colleges</h2>
                <p>High security options. You are almost certain to get allocated here.</p>
              </div>
              <div className="bucket-list">
                {processBucketList(predictions["Safe"]).length > 0 ? (
                  processBucketList(predictions["Safe"]).map(item => rendersBucketCard(item, 'Safe'))
                ) : (
                  <div className="empty-bucket-card">No safe colleges match your filters.</div>
                )}
              </div>
            </div>

            {/* HIGH CHANCE BUCKET */}
            <div className="bucket-column">
              <div className="bucket-header">
                <span className="badge badge-high">75–95%</span>
                <h2>High Chance</h2>
                <p>Strong targets. Your percentile matches well with previous closing cutoffs.</p>
              </div>
              <div className="bucket-list">
                {processBucketList(predictions["High Chance"]).length > 0 ? (
                  processBucketList(predictions["High Chance"]).map(item => rendersBucketCard(item, 'High Chance'))
                ) : (
                  <div className="empty-bucket-card">No high chance colleges match your filters.</div>
                )}
              </div>
            </div>

            {/* MODERATE CHANCE BUCKET */}
            <div className="bucket-column">
              <div className="bucket-header">
                <span className="badge badge-moderate">50–75%</span>
                <h2>Moderate Chance</h2>
                <p>Competitive target range. Admissions depend on rounds and vacancy counts.</p>
              </div>
              <div className="bucket-list">
                {processBucketList(predictions["Moderate Chance"]).length > 0 ? (
                  processBucketList(predictions["Moderate Chance"]).map(item => rendersBucketCard(item, 'Moderate Chance'))
                ) : (
                  <div className="empty-bucket-card">No moderate colleges match your filters.</div>
                )}
              </div>
            </div>

            {/* DREAM BUCKET */}
            <div className="bucket-column">
              <div className="bucket-header">
                <span className="badge badge-dream">Below 50%</span>
                <h2>Dream Colleges</h2>
                <p>High reach options. Highly competitive but worth adding at the top of your list.</p>
              </div>
              <div className="bucket-list">
                {processBucketList(predictions["Dream"]).length > 0 ? (
                  processBucketList(predictions["Dream"]).map(item => rendersBucketCard(item, 'Dream'))
                ) : (
                  <div className="empty-bucket-card">No dream colleges match your filters.</div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      <style jsx>{`
        .predictor-workspace {
          max-width: 100%;
          margin: 0 auto;
        }
        
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
        }
        
        .title-area {
          display: flex;
          align-items: center;
          gap: 15px;
        }
        .header-icon {
          color: var(--accent-primary);
          width: 36px;
          height: 36px;
        }
        
        .scores-badge {
          display: flex;
          gap: 20px;
          padding: 12px 24px;
        }
        .badge-lbl {
          display: block;
          font-size: 0.72rem;
          color: var(--text-secondary);
          text-transform: uppercase;
          font-weight: 600;
        }
        .badge-val {
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--accent-primary);
        }
        
        .error-card {
          text-align: center;
          padding: 60px;
          max-width: 500px;
          margin: 40px auto;
        }
        .error-icon {
          color: var(--error-color);
          margin-bottom: 15px;
        }
        .mt-15 {
          margin-top: 15px;
        }
        
        .loader-container {
          text-align: center;
          padding: 80px;
        }
        .loader {
          width: 50px;
          height: 50px;
          border: 4px solid rgba(255, 255, 255, 0.05);
          border-top-color: var(--accent-primary);
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 20px auto;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        .filters-workspace {
          display: grid;
          grid-template-columns: 1fr 1.2fr;
          gap: 30px;
          align-items: center;
          padding: 16px 24px;
          margin-bottom: 30px;
        }
        
        .search-box {
          position: relative;
          display: flex;
          align-items: center;
        }
        .search-icon {
          position: absolute;
          left: 14px;
          color: var(--text-secondary);
        }
        .search-input {
          width: 100%;
          padding: 12px 16px 12px 42px;
          background: rgba(0,0,0,0.2);
          border: 1px solid var(--panel-border);
          color: var(--text-primary);
          border-radius: 10px;
          outline: none;
        }
        .search-input:focus {
          border-color: var(--accent-primary);
        }
        
        .dropdowns-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 15px;
        }
        .filter-group label {
          display: block;
          font-size: 0.72rem;
          color: var(--text-secondary);
          text-transform: uppercase;
          margin-bottom: 4px;
          font-weight: 500;
        }
        .filter-select {
          width: 100%;
          padding: 10px;
          background: rgba(0,0,0,0.2);
          border: 1px solid var(--panel-border);
          color: var(--text-primary);
          border-radius: 8px;
          outline: none;
        }
        
        .buckets-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          align-items: start;
        }
        
        .bucket-column {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }
        
        .bucket-header {
          padding: 10px;
        }
        .bucket-header h2 {
          font-size: 1.15rem;
          margin: 8px 0 4px 0;
        }
        .bucket-header p {
          font-size: 0.78rem;
          color: var(--text-secondary);
          line-height: 1.4;
        }
        
        .bucket-list {
          display: flex;
          flex-direction: column;
          gap: 15px;
          max-height: 70vh;
          overflow-y: auto;
          padding-right: 4px;
        }
        
        .empty-bucket-card {
          text-align: center;
          padding: 30px;
          border: 1px dashed var(--panel-border);
          border-radius: 12px;
          color: var(--text-secondary);
          font-size: 0.85rem;
        }
        
        .prediction-card {
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        
        .card-primary-row {
          display: flex;
          justify-content: space-between;
          gap: 10px;
        }
        
        .college-code {
          font-size: 0.65rem;
          color: var(--accent-primary);
          font-weight: 700;
          letter-spacing: 0.05em;
        }
        .college-info h3 {
          font-size: 0.92rem;
          margin: 2px 0;
          line-height: 1.3;
        }
        .branch-label {
          font-size: 0.8rem;
          color: var(--text-secondary);
          margin-bottom: 6px;
        }
        
        .college-metadata-row {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }
        .meta-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 0.65rem;
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--panel-border);
          padding: 2px 6px;
          border-radius: 4px;
          color: var(--text-secondary);
        }
        .label-auto {
          border-color: var(--accent-secondary);
          color: var(--accent-secondary);
        }
        
        .prediction-metrics {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          justify-content: space-between;
          min-width: 90px;
        }
        .probability-display {
          text-align: right;
        }
        .prob-pct {
          display: block;
          font-size: 1.4rem;
          font-weight: 800;
          font-family: var(--font-heading);
          line-height: 1;
        }
        .prob-lbl {
          font-size: 0.68rem;
          font-weight: 600;
          text-transform: uppercase;
        }
        
        .add-pref-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          padding: 6px 10px;
          border-radius: 6px;
          background: var(--accent-primary);
          color: #ffffff;
          border: none;
          font-size: 0.72rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .add-pref-btn:hover {
          background: var(--accent-primary-hover);
        }
        .add-pref-btn.added {
          background: rgba(16, 185, 129, 0.1);
          color: var(--success-color);
          border: 1px solid rgba(16, 185, 129, 0.2);
          cursor: not-allowed;
        }
        
        .probability-bar-bg {
          width: 100%;
          height: 3px;
          background: rgba(255,255,255,0.05);
          border-radius: 2px;
          overflow: hidden;
        }
        .probability-bar-fill {
          height: 100%;
          border-radius: 2px;
        }
        
        .card-secondary-details {
          border-top: 1px solid var(--panel-border);
          padding-top: 10px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        
        .details-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px 15px;
        }
        .detail-lbl {
          font-size: 0.65rem;
          color: var(--text-secondary);
          margin-bottom: 2px;
        }
        .detail-val {
          font-size: 0.8rem;
          font-weight: 600;
        }
        .badge-vacant {
          color: var(--warning-color);
        }
        
        .ai-explanation {
          font-size: 0.76rem;
          color: var(--text-secondary);
          line-height: 1.4;
          background: rgba(255,255,255,0.01);
          border-left: 2px solid var(--accent-primary);
          padding-left: 8px;
        }
        
        .accordion-wrapper {
          margin-top: 4px;
        }
        .accordion-trigger-btn {
          width: 100%;
          text-align: center;
          background: transparent;
          border: none;
          color: var(--accent-secondary);
          font-size: 0.72rem;
          font-weight: 600;
          cursor: pointer;
          text-decoration: underline;
        }
        
        .accordion-content {
          margin-top: 10px;
          padding: 8px;
          background: rgba(0,0,0,0.1);
          border-radius: 6px;
        }
        
        .cutoffs-table {
          width: 100%;
          font-size: 0.7rem;
          border-collapse: collapse;
          margin-bottom: 8px;
        }
        .cutoffs-table th, .cutoffs-table td {
          padding: 4px;
          text-align: left;
          border-bottom: 1px solid var(--panel-border);
        }
        .cutoffs-table th {
          color: var(--text-secondary);
          font-weight: 600;
        }
        
        .links-row {
          display: flex;
          gap: 12px;
        }
        .link-item {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 0.72rem;
          color: var(--text-secondary);
          text-decoration: underline;
        }
        .link-item:hover {
          color: var(--text-primary);
        }

        @media (max-width: 1400px) {
          .buckets-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (max-width: 768px) {
          .page-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 15px;
          }
          .filters-workspace {
            grid-template-columns: 1fr;
            gap: 15px;
          }
          .buckets-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

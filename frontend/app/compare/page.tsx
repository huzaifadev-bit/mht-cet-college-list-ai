"use html";
"use client";

import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';
import { 
  ArrowRightLeft, 
  Search, 
  Plus, 
  X, 
  Check, 
  AlertCircle, 
  MapPin, 
  DollarSign, 
  Award, 
  Sparkles,
  ExternalLink
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

export default function ComparisonPage() {
  const [token, setToken] = useState<string | null>(null);
  
  // Compared colleges list (max 5)
  const [comparedColleges, setComparedColleges] = useState<College[]>([]);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    if (savedToken) {
      setToken(savedToken);
    }
  }, []);

  const handleSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (query.length < 3) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      // Fetch colleges list through predictor endpoint
      const res = await fetch(`${API_BASE_URL}/api/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          percentile: 90.0,
          rank: 10000,
          category: 'OPEN',
          gender: 'M',
          home_university: 'State-Level',
          candidature_type: 'Type A',
          preferred_branches: [],
          preferred_districts: [],
          max_fees: null
        })
      });
      if (res.ok) {
        const data = await res.json();
        // Flatten
        const flat: any[] = [];
        Object.values(data).forEach((list: any) => flat.push(...list));
        
        // Filter unique colleges
        const collegesMap = new Map();
        flat.forEach((item: any) => {
          collegesMap.set(item.college.code, item.college);
        });
        
        const uniqueColleges = Array.from(collegesMap.values());
        
        // Match query
        const filtered = uniqueColleges.filter(
          col => 
            col.name.toLowerCase().includes(query.toLowerCase()) ||
            col.code.toString().includes(query)
        );
        
        setSearchResults(filtered.slice(0, 10));
      }
    } catch (e) {
      console.log('Error fetching search results:', e);
    } finally {
      setSearching(false);
    }
  };

  const addCollegeToCompare = async (college: College) => {
    if (comparedColleges.some(c => c.code === college.code)) {
      alert('College is already added to comparison.');
      return;
    }
    if (comparedColleges.length >= 5) {
      alert('You can compare a maximum of 5 colleges at once.');
      return;
    }

    // Pull full details of compared colleges from API
    try {
      const updatedCodes = [...comparedColleges.map(c => c.code), college.code];
      const res = await fetch('http://localhost:8000/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ college_codes: updatedCodes })
      });
      if (res.ok) {
        const data = await res.json();
        setComparedColleges(data);
      }
    } catch (e) {
      setComparedColleges([...comparedColleges, college]);
    }
    
    setSearchQuery('');
    setSearchResults([]);
  };

  const removeCollege = (code: number) => {
    setComparedColleges(comparedColleges.filter(c => c.code !== code));
  };

  return (
    <div className="compare-workspace animate-fade-in">
      <div className="page-header">
        <div className="title-area">
          <ArrowRightLeft className="header-icon" />
          <div>
            <h1>Compare Colleges</h1>
            <p>Evaluate up to 5 engineering colleges side-by-side to make the best choice.</p>
          </div>
        </div>
      </div>

      {/* SELECTOR WORKSPACE */}
      <div className="selector-workspace glass-panel">
        <div className="search-side">
          <h3>Search Colleges to Compare</h3>
          <p className="hint">Search by college name or institute code (e.g. 6006, coep, vit):</p>
          
          <div className="search-bar">
            <Search className="search-icon" size={18} />
            <input 
              type="text" 
              placeholder="Search college to add..." 
              value={searchQuery}
              onChange={handleSearch}
              className="search-input"
            />
          </div>

          {searching && <p className="search-msg">Searching...</p>}

          {searchResults.length > 0 && (
            <div className="search-results-overlay">
              {searchResults.map((col) => (
                <div key={col.code} className="search-result-item">
                  <div>
                    <span className="res-code">CODE: {col.code}</span>
                    <p className="res-name">{col.name}</p>
                    <p className="res-sub">{col.district.name} | {col.status}</p>
                  </div>
                  <button className="add-res-btn" onClick={() => addCollegeToCompare(col)}>
                    <Plus size={14} /> Compare
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="selected-side">
          <h3>Currently Comparing ({comparedColleges.length}/5)</h3>
          {comparedColleges.length > 0 ? (
            <div className="compare-chips-list">
              {comparedColleges.map((col) => (
                <div key={col.code} className="compare-chip glass-card">
                  <div>
                    <span className="chip-code">CODE: {col.code}</span>
                    <p className="chip-name">{col.name}</p>
                  </div>
                  <button className="remove-chip-btn" onClick={() => removeCollege(col.code)}>
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-compare-msg">
              <Sparkles size={24} className="glow-icon" />
              <p>Your comparison workspace is empty. Search on the left to add colleges.</p>
            </div>
          )}
        </div>
      </div>

      {/* COMPARISON MATRIX TABLE */}
      {comparedColleges.length > 0 && (
        <div className="matrix-workspace glass-panel animate-fade-in">
          <div className="table-responsive">
            <table className="matrix-table">
              <thead>
                <tr>
                  <th className="feature-col">Parameters</th>
                  {comparedColleges.map((col) => (
                    <th key={col.code} className="college-header-col">
                      <div className="col-table-hdr">
                        <span className="cc-lbl">CODE {col.code}</span>
                        <h4>{col.name}</h4>
                        <button className="remove-col-btn" onClick={() => removeCollege(col.code)}>
                          Remove
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="feature-label">District / Location</td>
                  {comparedColleges.map(c => (
                    <td key={c.code} className="feature-value">
                      <MapPin size={12} className="val-icon" /> {c.district?.name || 'N/A'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="feature-label">University Affiliation</td>
                  {comparedColleges.map(c => (
                    <td key={c.code} className="feature-value">{c.university?.name || 'N/A'}</td>
                  ))}
                </tr>
                <tr>
                  <td className="feature-label">College Status</td>
                  {comparedColleges.map(c => (
                    <td key={c.code} className="feature-value">
                      <Award size={12} className="val-icon" /> {c.status}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="feature-label">Autonomy Status</td>
                  {comparedColleges.map(c => (
                    <td key={c.code} className="feature-value">
                      {c.autonomous ? (
                        <span className="val-success"><Check size={12} /> Autonomous</span>
                      ) : (
                        <span className="val-secondary">Non-Autonomous</span>
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="feature-label">Annual Tuition Fees</td>
                  {comparedColleges.map(c => (
                    <td key={c.code} className="feature-value font-highlight">
                      {c.fees ? `Rs. ${c.fees.toLocaleString()}` : 'N/A'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="feature-label">Hostel Availability</td>
                  {comparedColleges.map(c => (
                    <td key={c.code} className="feature-value">
                      {c.hostel_availability ? 'Yes (Available)' : 'No / External'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="feature-label">Average Placement Package</td>
                  {comparedColleges.map(c => (
                    <td key={c.code} className="feature-value font-success">
                      {c.average_package ? `${c.average_package} LPA` : 'N/A'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="feature-label">Highest Placement Package</td>
                  {comparedColleges.map(c => (
                    <td key={c.code} className="feature-value">
                      {c.highest_package ? `${c.highest_package} LPA` : 'N/A'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="feature-label">Minority Quota</td>
                  {comparedColleges.map(c => (
                    <td key={c.code} className="feature-value">{c.minority_status || 'None'}</td>
                  ))}
                </tr>
                <tr>
                  <td className="feature-label">Official Links</td>
                  {comparedColleges.map(c => (
                    <td key={c.code} className="feature-value">
                      <div className="links-stack">
                        {c.official_website && (
                          <a href={c.official_website} target="_blank" rel="noreferrer" className="table-link">
                            Website <ExternalLink size={10} />
                          </a>
                        )}
                        {c.maps_location && (
                          <a href={c.maps_location} target="_blank" rel="noreferrer" className="table-link">
                            Google Maps <ExternalLink size={10} />
                          </a>
                        )}
                      </div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style jsx>{`
        .compare-workspace {
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
        
        .selector-workspace {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
          margin-bottom: 40px;
          position: relative;
        }
        
        .search-side, .selected-side {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .search-side h3, .selected-side h3 {
          font-size: 1.1rem;
        }
        .hint {
          font-size: 0.8rem;
          color: var(--text-secondary);
        }
        
        .search-bar {
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
        
        .search-results-overlay {
          position: absolute;
          top: 100%;
          left: 0;
          width: 48%;
          background: #111625;
          border: 1px solid var(--panel-border);
          border-radius: 10px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          z-index: 20;
          max-height: 250px;
          overflow-y: auto;
          margin-top: 4px;
        }
        
        .search-result-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 16px;
          border-bottom: 1px solid var(--panel-border);
        }
        .search-result-item:last-child {
          border-bottom: none;
        }
        .search-result-item:hover {
          background: rgba(255,255,255,0.02);
        }
        
        .res-code {
          font-size: 0.65rem;
          color: var(--accent-primary);
          font-weight: 700;
        }
        .res-name {
          font-size: 0.85rem;
          font-weight: 600;
          margin: 1px 0;
        }
        .res-sub {
          font-size: 0.72rem;
          color: var(--text-secondary);
        }
        .add-res-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 6px 10px;
          background: rgba(99, 102, 241, 0.1);
          color: var(--accent-primary);
          border: 1px solid rgba(99, 102, 241, 0.2);
          border-radius: 6px;
          font-size: 0.75rem;
          cursor: pointer;
        }
        
        .compare-chips-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .compare-chip {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 14px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.01);
        }
        .chip-code {
          font-size: 0.62rem;
          color: var(--accent-primary);
          font-weight: 700;
        }
        .chip-name {
          font-size: 0.82rem;
          font-weight: 600;
        }
        .remove-chip-btn {
          background: transparent;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
        }
        .remove-chip-btn:hover {
          color: var(--error-color);
        }
        
        .empty-compare-msg {
          text-align: center;
          padding: 40px;
          border: 1px dashed var(--panel-border);
          border-radius: 12px;
          color: var(--text-secondary);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }
        .glow-icon {
          color: var(--accent-primary);
          filter: drop-shadow(0 0 4px rgba(99, 102, 241, 0.4));
        }
        .empty-compare-msg p {
          font-size: 0.85rem;
          margin: 0;
        }
        
        .matrix-workspace {
          padding: 24px;
          overflow-x: auto;
        }
        .table-responsive {
          width: 100%;
        }
        
        .matrix-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          font-size: 0.88rem;
        }
        .matrix-table th, .matrix-table td {
          padding: 16px 20px;
          border-bottom: 1px solid var(--panel-border);
          vertical-align: middle;
        }
        
        .feature-col {
          font-weight: 600;
          color: var(--text-secondary);
          background: rgba(0,0,0,0.15);
          width: 240px;
          border-right: 1px solid var(--panel-border);
        }
        
        .college-header-col {
          min-width: 200px;
        }
        
        .col-table-hdr {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .cc-lbl {
          font-size: 0.65rem;
          color: var(--accent-primary);
          font-weight: 700;
          letter-spacing: 0.05em;
        }
        .col-table-hdr h4 {
          font-size: 0.9rem;
          line-height: 1.3;
        }
        .remove-col-btn {
          align-self: flex-start;
          background: transparent;
          border: none;
          color: var(--error-color);
          font-size: 0.72rem;
          text-decoration: underline;
          cursor: pointer;
          padding: 0;
        }
        
        .feature-label {
          font-weight: 500;
          color: var(--text-secondary);
          border-right: 1px solid var(--panel-border);
          font-size: 0.85rem;
        }
        
        .feature-value {
          color: var(--text-primary);
        }
        
        .val-icon {
          color: var(--text-secondary);
          margin-right: 4px;
          vertical-align: middle;
        }
        
        .val-success {
          color: var(--success-color);
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-weight: 600;
        }
        .val-secondary {
          color: var(--text-secondary);
        }
        
        .font-highlight {
          color: var(--accent-primary);
          font-weight: 700;
        }
        .font-success {
          color: var(--success-color);
          font-weight: 700;
        }
        
        .links-stack {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .table-link {
          color: var(--accent-secondary);
          text-decoration: underline;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 0.78rem;
        }

        @media (max-width: 900px) {
          .selector-workspace {
            grid-template-columns: 1fr;
            gap: 20px;
          }
          .search-results-overlay {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}

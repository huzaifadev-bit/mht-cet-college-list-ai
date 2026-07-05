"use html";
"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { API_BASE_URL } from '../config';
import { 
  Sliders, 
  Trash2, 
  Lock, 
  Unlock, 
  ArrowUp, 
  ArrowDown, 
  FileText, 
  Download, 
  Share2, 
  Plus, 
  ShieldAlert, 
  CheckCircle,
  AlertTriangle,
  Lightbulb,
  Search,
  Printer
} from 'lucide-react';

interface College {
  code: number;
  name: string;
  district: { name: string };
  fees: number | null;
  average_package: number | null;
}

interface Branch {
  code: string;
  name: string;
}

interface PreferenceItem {
  id: number;
  college: College;
  branch: Branch;
  preference_order: number;
  locked: boolean;
  admission_probability: number | null;
}

interface AIReview {
  has_warnings: boolean;
  warnings: string[];
  risky_choices: string[];
  missing_recommendations: Array<{ college_name: string; branch_name: string; reason: string }>;
  overall_score: number;
}

export default function PreferenceBuilderPage() {
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [preferences, setPreferences] = useState<PreferenceItem[]>([]);
  const [listName, setListName] = useState('My CAP Preference List');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Search state to add colleges manually
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  // AI Review State
  const [review, setReview] = useState<AIReview | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);

  // Drag and Drop State
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      try {
        const u = JSON.parse(savedUser);
        setProfile(u.profile_data);
        fetchPreferenceList(savedToken);
      } catch (e) {
        setError('Error reading user session.');
      }
    } else {
      setError('Please login to build your preference list.');
    }
  }, []);

  const fetchPreferenceList = async (authToken: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/preferences/active`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setListName(data.name || 'My CAP Preference List');
        // Sort items by preference_order
        const items = data.items || [];
        items.sort((a: any, b: any) => a.preference_order - b.preference_order);
        
        // Let's populate local probabilities if not present
        const processedItems = await Promise.all(items.map(async (item: any) => {
          let prob = item.admission_probability;
          // Calculate probability dynamically if needed
          return {
            id: item.id,
            college: item.college,
            branch: item.branch,
            preference_order: item.preference_order,
            locked: item.locked,
            admission_probability: prob
          };
        }));
        
        setPreferences(processedItems);
      } else {
        throw new Error('Failed to load preferences.');
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching preference list.');
    } finally {
      setLoading(false);
    }
  };

  const savePreferenceList = async (itemsList: PreferenceItem[]) => {
    if (!token) return;
    try {
      const payload = {
        name: listName,
        items: itemsList.map((item, idx) => ({
          college_code: item.college.code,
          branch_code: item.branch.code,
          preference_order: idx + 1,
          locked: item.locked
        }))
      };
      
      const res = await fetch(`${API_BASE_URL}/api/preferences`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        // Reload list to get resolved probability and fresh IDs
        fetchPreferenceList(token);
        // Clear old review
        setReview(null);
      }
    } catch (e) {
      console.log('Error saving preferences:', e);
    }
  };

  // Reorder commands: Move up or down
  const moveItem = (index: number, direction: 'UP' | 'DOWN') => {
    const nextIndex = direction === 'UP' ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= preferences.length) return;
    
    // Check if either is locked
    if (preferences[index].locked || preferences[nextIndex].locked) {
      alert('Cannot move locked colleges. Unlock them first.');
      return;
    }

    const updated = [...preferences];
    const temp = updated[index];
    updated[index] = updated[nextIndex];
    updated[nextIndex] = temp;

    // Rescale orders
    updated.forEach((item, idx) => {
      item.preference_order = idx + 1;
    });

    setPreferences(updated);
    savePreferenceList(updated);
  };

  const removeItem = (index: number) => {
    const updated = preferences.filter((_, idx) => idx !== index);
    updated.forEach((item, idx) => {
      item.preference_order = idx + 1;
    });
    setPreferences(updated);
    savePreferenceList(updated);
  };

  const toggleLock = (index: number) => {
    const updated = [...preferences];
    updated[index].locked = !updated[index].locked;
    setPreferences(updated);
    savePreferenceList(updated);
  };

  // Run AI preference review
  const runAIReview = async () => {
    if (!token) return;
    setReviewLoading(true);
    setReview(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/preferences/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        setReview(data);
      } else {
        alert(data.detail || 'Failed to review preferences');
      }
    } catch (e) {
      console.log('Error running AI review:', e);
    } finally {
      setReviewLoading(false);
    }
  };

  // Manual Search to Add Colleges
  const handleSearchChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (query.length < 3) {
      setSearchResults([]);
      return;
    }
    
    setSearching(true);
    try {
      // Direct mock predictions or fetch predictions to find matching colleges
      // Let's call the prediction endpoint with very broad filters to fetch matches
      const res = await fetch(`${API_BASE_URL}/api/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          percentile: profile?.percentile || 90.0,
          rank: profile?.rank || 10000,
          category: profile?.category || 'OPEN',
          gender: profile?.gender || 'M',
          home_university: profile?.home_university || 'Savitribai Phule Pune University',
          candidature_type: 'Type A',
          preferred_branches: [],
          preferred_districts: [],
          max_fees: null
        })
      });
      if (res.ok) {
        const data = await res.json();
        // Flatten buckets
        const flat: any[] = [];
        Object.values(data).forEach((list: any) => flat.push(...list));
        
        // Filter by search query
        const filtered = flat.filter(
          item => 
            item.college.name.toLowerCase().includes(query.toLowerCase()) ||
            item.college.code.toString().includes(query) ||
            item.branch.name.toLowerCase().includes(query.toLowerCase())
        );
        
        // Unique entries
        const unique = [];
        const seen = new Set();
        for (const item of filtered) {
          const key = `${item.college.code}_${item.branch.code}`;
          if (!seen.has(key)) {
            seen.add(key);
            unique.push(item);
          }
        }
        
        setSearchResults(unique.slice(0, 10)); // Limit 10
      }
    } catch (e) {
      console.log(e);
    } finally {
      setSearching(false);
    }
  };

  const addManualCollege = (item: any) => {
    // Check if already added
    const exists = preferences.some(
      p => p.college.code === item.college.code && p.branch.code === item.branch.code
    );
    if (exists) {
      alert('This option is already in your preference list.');
      return;
    }

    const newItem: PreferenceItem = {
      id: Date.now(), // temporary id
      college: item.college,
      branch: item.branch,
      preference_order: preferences.length + 1,
      locked: false,
      admission_probability: item.admission_probability
    };

    const updated = [...preferences, newItem];
    setPreferences(updated);
    setSearchQuery('');
    setSearchResults([]);
    savePreferenceList(updated);
  };

  // Drag and Drop Handlers
  const handleDragStart = (index: number) => {
    if (preferences[index].locked) return;
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    if (preferences[index].locked) return;

    const updated = [...preferences];
    const item = updated[draggedIndex];
    updated.splice(draggedIndex, 1);
    updated.splice(index, 0, item);

    updated.forEach((item, idx) => {
      item.preference_order = idx + 1;
    });

    setDraggedIndex(index);
    setPreferences(updated);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    savePreferenceList(preferences);
  };

  const getWhatsAppShareLink = () => {
    const text = `Check out my AI-optimized MHT CET CAP Preference List! Built with 3 years cutoffs and vacancies. Open this link: http://localhost:3000`;
    return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="pref-builder-workspace animate-fade-in">
      <div className="page-header print-hide">
        <div className="title-area">
          <Sliders className="header-icon" />
          <div>
            <h1>CAP Preference List Builder</h1>
            <p>Strategically arrange, lock, and AI-audit your final option form choices.</p>
          </div>
        </div>

        <div className="actions-row">
          <button className="btn btn-secondary" onClick={handlePrint}>
            <Printer size={16} /> Print Friendly
          </button>
          
          {token && (
            <>
              <a 
                href={`${API_BASE_URL}/api/preferences/download/pdf`} 
                target="_blank" 
                rel="noreferrer" 
                className="btn btn-primary"
                style={{ padding: '10px 16px', fontSize: '0.85rem' }}
              >
                <Download size={16} /> Export PDF
              </a>
              
              <a 
                href={`${API_BASE_URL}/api/preferences/download/excel`} 
                target="_blank" 
                rel="noreferrer" 
                className="btn btn-secondary"
                style={{ padding: '10px 16px', fontSize: '0.85rem' }}
              >
                <FileText size={16} /> Export Excel
              </a>
            </>
          )}
        </div>
      </div>

      {error ? (
        <div className="error-card glass-panel print-hide">
          <ShieldAlert size={32} className="error-icon" />
          <p>{error}</p>
        </div>
      ) : loading ? (
        <div className="loader-container print-hide">
          <div className="loader"></div>
          <p>Loading preference form workspace...</p>
        </div>
      ) : (
        <div className="builder-layout">
          {/* LEFT: PREFERENCE WORKSPACE */}
          <div className="workspace-panel glass-panel">
            <div className="panel-title-row print-hide">
              <h2>My Choice List ({preferences.length} options)</h2>
              <p className="hint">Drag & drop rows to reorder, or use the Up/Down buttons.</p>
            </div>

            {/* Print Only Header */}
            <div className="print-only-header">
              <h1>MHT CET Option Form Preference List</h1>
              {profile && (
                <p>
                  Candidate: {profile.name || 'Student'} | Percentile: {profile.percentile}% | Rank: #{profile.rank} | Category: {profile.category}
                </p>
              )}
            </div>

            <div className="preferences-table-wrapper">
              <table className="preferences-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>Pref</th>
                    <th style={{ width: '80px' }} className="print-hide">Lock</th>
                    <th style={{ width: '100px' }}>Choice Code</th>
                    <th>College Name & Branch</th>
                    <th style={{ width: '100px' }}>Tuition Fees</th>
                    <th style={{ width: '100px' }}>AI Prob.</th>
                    <th style={{ width: '100px' }} className="print-hide">Reorder</th>
                    <th style={{ width: '50px' }} className="print-hide">Wipe</th>
                  </tr>
                </thead>
                <tbody>
                  {preferences.length > 0 ? (
                    preferences.map((item, idx) => {
                      const isLocked = item.locked;
                      const choiceCode = `${item.college.code}${item.branch.code}`;
                      
                      // Probability label
                      let probBadge = 'badge-dream';
                      if (item.admission_probability !== null) {
                        if (item.admission_probability >= 95.0) probBadge = 'badge-safe';
                        else if (item.admission_probability >= 75.0) probBadge = 'badge-high';
                        else if (item.admission_probability >= 50.0) probBadge = 'badge-moderate';
                      }

                      return (
                        <tr 
                          key={item.id}
                          draggable={!isLocked}
                          onDragStart={() => handleDragStart(idx)}
                          onDragOver={(e) => handleDragOver(e, idx)}
                          onDragEnd={handleDragEnd}
                          className={`draggable-row ${isLocked ? 'locked-row' : ''}`}
                        >
                          <td className="bold-text">#{idx + 1}</td>
                          <td className="print-hide">
                            <button 
                              className={`lock-toggle-btn ${isLocked ? 'active' : ''}`}
                              onClick={() => toggleLock(idx)}
                              title={isLocked ? 'Unlock option to reorder' : 'Lock option in place'}
                            >
                              {isLocked ? <Lock size={14} /> : <Unlock size={14} />}
                            </button>
                          </td>
                          <td className="mono-text">{choiceCode}</td>
                          <td>
                            <div className="col-br-details">
                              <span className="col-name">{item.college.name}</span>
                              <span className="br-name">{item.branch.name}</span>
                            </div>
                          </td>
                          <td>{item.college.fees ? `Rs. ${item.college.fees.toLocaleString()}` : 'N/A'}</td>
                          <td>
                            <span className={`badge ${probBadge}`}>
                              {item.admission_probability !== null ? `${item.admission_probability}%` : 'N/A'}
                            </span>
                          </td>
                          <td className="print-hide">
                            <div className="reorder-btns">
                              <button 
                                className="reorder-btn" 
                                onClick={() => moveItem(idx, 'UP')}
                                disabled={idx === 0 || isLocked}
                              >
                                <ArrowUp size={12} />
                              </button>
                              <button 
                                className="reorder-btn" 
                                onClick={() => moveItem(idx, 'DOWN')}
                                disabled={idx === preferences.length - 1 || isLocked}
                              >
                                <ArrowDown size={12} />
                              </button>
                            </div>
                          </td>
                          <td className="print-hide">
                            <button className="delete-row-btn" onClick={() => removeItem(idx)}>
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="empty-row-msg">
                        Your preference list is empty. Add colleges from the Predictor page or search below.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* MANUAL ADD WORKSPACE */}
            <div className="manual-add-workspace print-hide">
              <h3>Add College Choice Manually</h3>
              <div className="manual-search-box">
                <Search size={18} className="search-icon" />
                <input 
                  type="text" 
                  placeholder="Type college name, code, or branch..." 
                  className="search-input"
                  value={searchQuery}
                  onChange={handleSearchChange}
                />
              </div>

              {searching && <p className="search-msg">Searching options...</p>}

              {searchResults.length > 0 && (
                <div className="search-results-overlay">
                  {searchResults.map((item) => (
                    <div key={`${item.college.code}_${item.branch.code}`} className="search-result-item">
                      <div className="res-details">
                        <span className="res-code">{item.college.code}{item.branch.code}</span>
                        <p className="res-name">{item.college.name}</p>
                        <p className="res-branch">{item.branch.name}</p>
                      </div>
                      <button className="add-res-btn" onClick={() => addManualCollege(item)}>
                        <Plus size={14} /> Add
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: AI REVIEW CONSOLE */}
          <div className="review-panel glass-panel print-hide">
            <div className="panel-title-row">
              <h2>AI Counselling Review</h2>
              <p>Audit order sequence, evaluate safe options, and review strategies.</p>
            </div>

            <button 
              className="btn btn-primary w-full run-review-btn" 
              onClick={runAIReview}
              disabled={reviewLoading}
            >
              {reviewLoading ? 'Analyzing...' : 'Run CAP Form Review'}
              <Sliders size={16} />
            </button>

            {review && (
              <div className="review-results animate-fade-in">
                {/* Strategic score */}
                <div className="score-widget">
                  <div className="score-circle">
                    <span className="score-num">{review.overall_score}</span>
                    <span className="score-total">/100</span>
                  </div>
                  <div>
                    <h4>Form Strategy Score</h4>
                    <p className="score-desc">
                      {review.overall_score >= 85 ? 'Excellent balance of options!' : 'Review the warnings below to optimize your choices.'}
                    </p>
                  </div>
                </div>

                {/* Warnings Section */}
                <div className="review-section">
                  <h3>
                    <AlertTriangle className="sec-icon warning-icon" size={16} />
                    Choice Order Warnings
                  </h3>
                  {review.warnings.length > 0 ? (
                    <ul className="warnings-list">
                      {review.warnings.map((w, idx) => (
                        <li key={idx} className="warning-item">{w}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="success-review-msg">
                      <CheckCircle size={14} /> No ordering or capacity anomalies found!
                    </div>
                  )}
                </div>

                {/* Risky Choices Section */}
                {review.risky_choices.length > 0 && (
                  <div className="review-section">
                    <h3>
                      <ShieldAlert className="sec-icon risky-icon" size={16} />
                      Risky/Reach Choices (Dream)
                    </h3>
                    <p className="sec-hint">These colleges have historical cutoffs above your score. Keep them at the top, but ensure you have safe options below.</p>
                    <div className="risky-list">
                      {review.risky_choices.map((r, idx) => (
                        <span key={idx} className="risky-badge">{r}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommendations Section */}
                {review.missing_recommendations.length > 0 && (
                  <div className="review-section">
                    <h3>
                      <Lightbulb className="sec-icon rec-icon" size={16} />
                      Recommended Target Options
                    </h3>
                    <p className="sec-hint">Colleges matching your percentile that could strengthen your preference list:</p>
                    <div className="recs-list">
                      {review.missing_recommendations.map((r, idx) => (
                        <div key={idx} className="rec-item">
                          <p className="rec-name"><strong>{r.college_name}</strong></p>
                          <p className="rec-branch">{r.branch_name}</p>
                          <p className="rec-reason">{r.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Share widgets */}
                <div className="share-box">
                  <h3>Share Preference List</h3>
                  <div className="share-buttons">
                    <a href={getWhatsAppShareLink()} target="_blank" rel="noreferrer" className="btn btn-secondary share-whatsapp-btn">
                      <Share2 size={14} /> Share on WhatsApp
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        .pref-builder-workspace {
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
        
        .actions-row {
          display: flex;
          gap: 12px;
        }
        
        .builder-layout {
          display: grid;
          grid-template-columns: 1.3fr 0.7fr;
          gap: 30px;
          align-items: start;
        }
        
        .panel-title-row {
          margin-bottom: 20px;
        }
        .panel-title-row h2 {
          font-size: 1.3rem;
          margin-bottom: 4px;
        }
        .panel-title-row p {
          font-size: 0.82rem;
          color: var(--text-secondary);
        }
        
        .preferences-table-wrapper {
          overflow-x: auto;
          margin-bottom: 25px;
        }
        
        .preferences-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.88rem;
          text-align: left;
        }
        .preferences-table th, .preferences-table td {
          padding: 12px 16px;
          border-bottom: 1px solid var(--panel-border);
        }
        .preferences-table th {
          color: var(--text-secondary);
          font-weight: 600;
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          background: rgba(0,0,0,0.15);
        }
        
        .draggable-row {
          cursor: grab;
          transition: background 0.2s;
        }
        .draggable-row:hover {
          background: rgba(255, 255, 255, 0.01);
        }
        .draggable-row:active {
          cursor: grabbing;
        }
        
        .locked-row {
          cursor: not-allowed;
          background: rgba(255,255,255,0.002);
          opacity: 0.75;
        }
        
        .bold-text {
          font-weight: 700;
          color: var(--accent-primary);
        }
        .mono-text {
          font-family: monospace;
          font-weight: 600;
          color: var(--text-secondary);
        }
        
        .col-br-details {
          display: flex;
          flex-direction: column;
        }
        .col-name {
          font-weight: 600;
          color: var(--text-primary);
          line-height: 1.3;
        }
        .br-name {
          font-size: 0.76rem;
          color: var(--text-secondary);
        }
        
        .lock-toggle-btn {
          background: transparent;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          padding: 6px;
          border-radius: 4px;
          transition: all 0.2s;
        }
        .lock-toggle-btn:hover {
          color: var(--text-primary);
          background: rgba(255,255,255,0.04);
        }
        .lock-toggle-btn.active {
          color: var(--warning-color);
          background: rgba(245, 158, 11, 0.08);
        }
        
        .reorder-btns {
          display: flex;
          gap: 4px;
        }
        .reorder-btn {
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--panel-border);
          color: var(--text-secondary);
          cursor: pointer;
          padding: 6px;
          border-radius: 4px;
          transition: all 0.2s;
        }
        .reorder-btn:hover:not(:disabled) {
          color: var(--text-primary);
          background: rgba(255,255,255,0.06);
        }
        .reorder-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
        
        .delete-row-btn {
          background: transparent;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          padding: 6px;
          border-radius: 4px;
          transition: all 0.2s;
        }
        .delete-row-btn:hover {
          color: var(--error-color);
          background: rgba(239, 68, 68, 0.08);
        }
        
        .empty-row-msg {
          text-align: center;
          padding: 40px;
          color: var(--text-secondary);
          font-style: italic;
        }
        
        .manual-add-workspace {
          border-top: 1px solid var(--panel-border);
          padding-top: 25px;
          position: relative;
        }
        .manual-add-workspace h3 {
          font-size: 1.05rem;
          margin-bottom: 12px;
        }
        .manual-search-box {
          position: relative;
          display: flex;
          align-items: center;
        }
        .manual-search-box .search-icon {
          position: absolute;
          left: 14px;
          color: var(--text-secondary);
        }
        .manual-search-box .search-input {
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
          right: 0;
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
        .res-branch {
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
        
        .run-review-btn {
          width: 100%;
          padding: 14px;
          margin-bottom: 25px;
        }
        
        .score-widget {
          display: flex;
          align-items: center;
          gap: 20px;
          background: rgba(255,255,255,0.02);
          border: 1px solid var(--panel-border);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 25px;
        }
        .score-circle {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          border: 4px solid var(--accent-primary);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        .score-num {
          font-size: 1.15rem;
          font-weight: 800;
          line-height: 1;
        }
        .score-total {
          font-size: 0.62rem;
          color: var(--text-secondary);
        }
        
        .review-section {
          border-top: 1px solid var(--panel-border);
          padding: 20px 0;
        }
        .review-section h3 {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 1rem;
          margin-bottom: 12px;
        }
        .sec-icon {
          width: 16px;
          height: 16px;
        }
        .warning-icon { color: var(--warning-color); }
        .risky-icon { color: var(--error-color); }
        .rec-icon { color: var(--accent-secondary); }
        
        .sec-hint {
          font-size: 0.72rem;
          color: var(--text-secondary);
          margin-bottom: 12px;
        }
        
        .warnings-list {
          list-style-type: none;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .warning-item {
          font-size: 0.8rem;
          color: var(--warning-color);
          background: rgba(245, 158, 11, 0.05);
          border-left: 2px solid var(--warning-color);
          padding: 8px 12px;
          border-radius: 0 6px 6px 0;
          line-height: 1.4;
        }
        
        .success-review-msg {
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--success-color);
          font-size: 0.8rem;
          font-weight: 500;
        }
        
        .risky-list {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .risky-badge {
          font-size: 0.72rem;
          background: rgba(239, 68, 68, 0.1);
          color: var(--error-color);
          border: 1px solid rgba(239, 68, 68, 0.2);
          padding: 4px 8px;
          border-radius: 4px;
        }
        
        .recs-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .rec-item {
          background: rgba(255,255,255,0.01);
          border: 1px solid var(--panel-border);
          border-radius: 8px;
          padding: 12px;
        }
        .rec-name {
          font-size: 0.82rem;
          color: var(--text-primary);
        }
        .rec-branch {
          font-size: 0.72rem;
          color: var(--text-secondary);
          margin-bottom: 4px;
        }
        .rec-reason {
          font-size: 0.75rem;
          color: var(--text-secondary);
          line-height: 1.4;
        }
        
        .share-box {
          border-top: 1px solid var(--panel-border);
          padding-top: 20px;
        }
        .share-box h3 {
          font-size: 0.95rem;
          margin-bottom: 10px;
        }
        .share-buttons {
          display: flex;
        }
        .share-whatsapp-btn {
          width: 100%;
          background: #25d366 !important;
          color: #ffffff !important;
          border: none;
        }
        .share-whatsapp-btn:hover {
          filter: brightness(1.1);
        }
        
        .print-only-header {
          display: none;
        }
        
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          .print-hide {
            display: none !important;
          }
          .workspace-panel {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            background: transparent !important;
          }
          .builder-layout {
            grid-template-columns: 1fr;
          }
          .print-only-header {
            display: block !important;
            margin-bottom: 25px;
            text-align: center;
          }
          .print-only-header h1 {
            font-size: 1.6rem;
            color: #1a365d;
            margin-bottom: 6px;
          }
          .print-only-header p {
            font-size: 0.85rem;
            color: #4a5568;
          }
          .preferences-table th {
            background: #e2e8f0 !important;
            color: black !important;
            border-bottom: 2px solid #cbd5e0 !important;
          }
          .preferences-table td {
            border-bottom: 1px solid #e2e8f0 !important;
          }
        }

        @media (max-width: 1100px) {
          .builder-layout {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

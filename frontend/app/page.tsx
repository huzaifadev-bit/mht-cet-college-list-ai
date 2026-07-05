"use html";
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE_URL } from './config';
import { 
  Sparkles, 
  ArrowRight, 
  CheckCircle, 
  Compass, 
  Sliders, 
  ArrowRightLeft, 
  MessageSquare,
  Shield,
  FileSpreadsheet
} from 'lucide-react';

export default function LandingPage() {
  const router = useRouter();
  
  // Auth state
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<{name: string, email: string, is_admin: boolean} | null>(null);
  const [isLoginView, setIsLoginView] = useState(true);
  
  // Auth Form State
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Profile Form State
  const [percentile, setPercentile] = useState('');
  const [rank, setRank] = useState('');
  const [category, setCategory] = useState('OPEN');
  const [gender, setGender] = useState('M');
  const [homeUniversity, setHomeUniversity] = useState('Savitribai Phule Pune University');
  const [candidatureType, setCandidatureType] = useState('Type A');
  const [tfwsStatus, setTfwsStatus] = useState(false);
  const [defenceStatus, setDefenceStatus] = useState(false);
  const [phStatus, setPhStatus] = useState(false);
  const [minorityStatus, setMinorityStatus] = useState('None');
  
  // Branch Preferences (List of branches)
  const [selectedBranches, setSelectedBranches] = useState<string[]>(['Computer Engineering', 'Information Technology']);
  const [branchInput, setBranchInput] = useState('');
  
  // Locations Preferences
  const [preferredDistricts, setPreferredDistricts] = useState<string[]>([]);
  const [districtInput, setDistrictInput] = useState('');
  
  const [maxFees, setMaxFees] = useState('');
  const [govPrivatePref, setGovPrivatePref] = useState('ANY');
  const [autonomousPref, setAutonomousPref] = useState('ANY');
  const [hostelRequired, setHostelRequired] = useState(false);
  const [placementPriority, setPlacementPriority] = useState(false);
  
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');

  const availableBranches = [
    'Computer Engineering',
    'Information Technology',
    'Artificial Intelligence and Data Science',
    'Computer Science and Engineering',
    'Electronics and Telecommunication Engg',
    'Mechanical Engineering',
    'Electrical Engineering',
    'Civil Engineering',
    'Chemical Engineering'
  ];

  const availableDistricts = ['Pune', 'Mumbai', 'Thane', 'Nagpur', 'Nashik', 'Amravati', 'Aurangabad', 'Kolhapur', 'Sangli'];

  useEffect(() => {
    // Check authentication
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      try {
        const u = JSON.parse(savedUser);
        setUser(u);
        
        // Fetch user profile data to prefill form
        fetchProfile(savedToken);
      } catch (e) {
        handleLogout();
      }
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    window.location.reload();
  };

  const fetchProfile = async (authToken: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (res.ok) {
        const userData = await res.json();
        if (userData.profile_data) {
          const prof = userData.profile_data;
          setPercentile(prof.percentile?.toString() || '');
          setRank(prof.rank?.toString() || '');
          setCategory(prof.category || 'OPEN');
          setGender(prof.gender || 'M');
          setHomeUniversity(prof.home_university || 'Savitribai Phule Pune University');
          setCandidatureType(prof.candidature_type || 'Type A');
          setTfwsStatus(prof.tfws_status || false);
          setDefenceStatus(prof.defence_status || false);
          setPhStatus(prof.ph_status || false);
          setMinorityStatus(prof.minority_status || 'None');
          setSelectedBranches(prof.preferred_branches || []);
          setPreferredDistricts(prof.preferred_districts || []);
          setMaxFees(prof.max_fees?.toString() || '');
          setGovPrivatePref(prof.gov_private_pref || 'ANY');
          setAutonomousPref(prof.autonomous_pref || 'ANY');
          setHostelRequired(prof.hostel_required || false);
          setPlacementPriority(prof.placement_priority || false);
        }
      }
    } catch (e) {
      console.log('Error fetching user profile:', e);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    setAuthLoading(true);

    const url = isLoginView 
      ? `${API_BASE_URL}/api/auth/login` 
      : `${API_BASE_URL}/api/auth/register`;

    const payload = isLoginView
      ? { email: authEmail, password: authPassword }
      : { email: authEmail, password: authPassword, name: authName };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.detail || 'Authentication failed');
      }

      if (isLoginView) {
        // Logged in
        localStorage.setItem('token', data.access_token);
        
        // Fetch current user details
        const userRes = await fetch(`${API_BASE_URL}/api/auth/me`, {
          headers: { 'Authorization': `Bearer ${data.access_token}` }
        });
        const userData = await userRes.json();
        
        localStorage.setItem('user', JSON.stringify(userData));
        setToken(data.access_token);
        setUser(userData);
        setAuthSuccess('Successfully logged in! Prefilling details.');
        fetchProfile(data.access_token);
      } else {
        // Registered successfully, switch to login view
        setAuthSuccess('Account registered successfully! Please login.');
        setIsLoginView(true);
      }
    } catch (err: any) {
      setAuthError(err.message || 'Something went wrong');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg('');
    setProfileSaving(true);

    if (!percentile || !rank) {
      setProfileMsg('Please enter both MHT CET Percentile and State Rank');
      setProfileSaving(false);
      return;
    }

    const payload = {
      percentile: parseFloat(percentile),
      rank: parseInt(rank),
      category,
      gender,
      home_university: homeUniversity,
      candidature_type: candidatureType,
      tfws_status: tfwsStatus,
      defence_status: defenceStatus,
      ph_status: phStatus,
      minority_status: minorityStatus === 'None' ? null : minorityStatus,
      preferred_branches: selectedBranches,
      preferred_districts: preferredDistricts,
      max_fees: maxFees ? parseInt(maxFees) : null,
      gov_private_pref: govPrivatePref,
      autonomous_pref: autonomousPref,
      hostel_required: hostelRequired,
      placement_priority: placementPriority
    };

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        setProfileMsg('Profile saved successfully! Redirecting to predictor...');
        // Save profile locally under user key
        const updatedUser = { ...user, profile_data: payload };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        
        setTimeout(() => {
          router.push('/predictor');
        }, 1500);
      } else {
        throw new Error(data.detail || 'Failed to save profile');
      }
    } catch (err: any) {
      setProfileMsg(err.message || 'Error saving profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  const toggleBranch = (branch: string) => {
    if (selectedBranches.includes(branch)) {
      setSelectedBranches(selectedBranches.filter(b => b !== branch));
    } else {
      setSelectedBranches([...selectedBranches, branch]);
    }
  };

  const toggleDistrict = (district: string) => {
    if (preferredDistricts.includes(district)) {
      setPreferredDistricts(preferredDistricts.filter(d => d !== district));
    } else {
      setPreferredDistricts([...preferredDistricts, district]);
    }
  };

  return (
    <div className="landing-page-wrapper">
      <div className="landing-hero animate-fade-in">
        <div className="hero-content">
          <div className="glow-badge">
            <Sparkles size={14} />
            <span>AI-Powered MHT CET Guidance Platform</span>
          </div>
          <h1>Predict Colleges. Craft Preferences. <br/><font color="#6366f1">Succeed in CAP admissions.</font></h1>
          <p>
            An AI admission counselling system built on official cutoffs, vacant seats, and brochure documents. 
            No hardcoded data—completely self-learning and document-verified.
          </p>

          <div className="landing-stats-grid">
            <div className="stat-card">
              <h3>340+</h3>
              <p>Maharashtra Colleges</p>
            </div>
            <div className="stat-card">
              <h3>3 Years</h3>
              <p>Relational Cutoff Trends</p>
            </div>
            <div className="stat-card">
              <h3>100%</h3>
              <p>Document-Backed RAG Chat</p>
            </div>
          </div>
        </div>

        {/* Panel for Authentication or Profile Setup */}
        <div className="auth-profile-panel glass-panel">
          {!token ? (
            /* Auth Login/Registration forms */
            <div className="auth-container">
              <div className="auth-tabs">
                <button 
                  className={`auth-tab ${isLoginView ? 'active' : ''}`}
                  onClick={() => setIsLoginView(true)}
                >
                  Login
                </button>
                <button 
                  className={`auth-tab ${!isLoginView ? 'active' : ''}`}
                  onClick={() => setIsLoginView(false)}
                >
                  Register
                </button>
              </div>

              <form onSubmit={handleAuthSubmit} className="auth-form">
                {!isLoginView && (
                  <div className="form-group">
                    <label className="form-label">Full Name</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Enter your name" 
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                      required
                    />
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Email Address</label>
                  <input 
                    type="email" 
                    className="form-input" 
                    placeholder="student@example.com" 
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input 
                    type="password" 
                    className="form-input" 
                    placeholder="••••••••" 
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    required
                  />
                </div>

                {authError && <p className="auth-error-msg">{authError}</p>}
                {authSuccess && <p className="auth-success-msg">{authSuccess}</p>}

                <button type="submit" className="btn btn-primary w-full" disabled={authLoading}>
                  {authLoading ? 'Verifying...' : isLoginView ? 'Login to Predictor' : 'Create Account'}
                  <ArrowRight size={16} />
                </button>
              </form>
            </div>
          ) : (
            /* Profile Form Setup */
            <div className="profile-setup-container">
              <div className="profile-header">
                <h2>Candidate Profile Setup</h2>
                <p>Input your exact scores to calculate personalized college admission probabilities.</p>
              </div>

              <form onSubmit={handleProfileSubmit} className="profile-form">
                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label">MHT CET Percentile</label>
                    <input 
                      type="number" 
                      step="0.0001"
                      min="0"
                      max="100"
                      className="form-input" 
                      placeholder="e.g. 98.2435" 
                      value={percentile}
                      onChange={(e) => setPercentile(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">State Merit Rank</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      placeholder="e.g. 2503" 
                      value={rank}
                      onChange={(e) => setRank(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label">Admission Category</label>
                    <select 
                      className="form-input" 
                      value={category} 
                      onChange={(e) => setCategory(e.target.value)}
                    >
                      <option value="OPEN">OPEN (General)</option>
                      <option value="OBC">OBC</option>
                      <option value="SC">SC</option>
                      <option value="ST">ST</option>
                      <option value="EWS">EWS</option>
                      <option value="VJNT">VJNT / DT</option>
                      <option value="SBC">SBC</option>
                      <option value="TFWS">TFWS</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Candidate Gender</label>
                    <select 
                      className="form-input" 
                      value={gender} 
                      onChange={(e) => setGender(e.target.value)}
                    >
                      <option value="M">Male / General</option>
                      <option value="F">Female (Ladies Quota)</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Home University Status</label>
                  <select 
                    className="form-input" 
                    value={homeUniversity} 
                    onChange={(e) => setHomeUniversity(e.target.value)}
                  >
                    <option value="Savitribai Phule Pune University">Savitribai Phule Pune University (SPPU)</option>
                    <option value="Mumbai University">Mumbai University (MU)</option>
                    <option value="Rashtrasant Tukadoji Maharaj Nagpur University">Nagpur University (RTMNU)</option>
                    <option value="Sant Gadge Baba Amravati University">Amravati University (SGBAU)</option>
                    <option value="Shivaji University">Shivaji University (Kolhapur)</option>
                    <option value="Dr. Babasaheb Ambedkar Marathwada University">BAMU (Aurangabad)</option>
                    <option value="State-Level">Other than Home University / OMS</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Branch Preferences (Toggle options)</label>
                  <div className="options-grid">
                    {availableBranches.map((br) => (
                      <button
                        type="button"
                        key={br}
                        className={`toggle-option-btn ${selectedBranches.includes(br) ? 'active' : ''}`}
                        onClick={() => toggleBranch(br)}
                      >
                        {br}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Preferred Districts (Optional)</label>
                  <div className="options-grid">
                    {availableDistricts.map((d) => (
                      <button
                        type="button"
                        key={d}
                        className={`toggle-option-btn ${preferredDistricts.includes(d) ? 'active' : ''}`}
                        onClick={() => toggleDistrict(d)}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label">Max Annual Tuition Fees (INR)</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      placeholder="e.g. 150000" 
                      value={maxFees}
                      onChange={(e) => setMaxFees(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Autonomous Status</label>
                    <select 
                      className="form-input" 
                      value={autonomousPref} 
                      onChange={(e) => setAutonomousPref(e.target.value)}
                    >
                      <option value="ANY">Any College</option>
                      <option value="AUTONOMOUS">Autonomous Only</option>
                      <option value="NON-AUTONOMOUS">Non-Autonomous Only</option>
                    </select>
                  </div>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label">College Management</label>
                    <select 
                      className="form-input" 
                      value={govPrivatePref} 
                      onChange={(e) => setGovPrivatePref(e.target.value)}
                    >
                      <option value="ANY">Any</option>
                      <option value="GOVT">Government / Govt-Aided Only</option>
                      <option value="PVT">Private Colleges Only</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Minority Status</label>
                    <select 
                      className="form-input" 
                      value={minorityStatus} 
                      onChange={(e) => setMinorityStatus(e.target.value)}
                    >
                      <option value="None">None</option>
                      <option value="Gujarati">Gujarati Linguistic</option>
                      <option value="Sindhi">Sindhi Linguistic</option>
                      <option value="Muslim">Muslim Religious</option>
                      <option value="Roman Catholic">Christian Minority</option>
                    </select>
                  </div>
                </div>

                <div className="checkboxes-row">
                  <label className="checkbox-container">
                    <input 
                      type="checkbox" 
                      checked={hostelRequired} 
                      onChange={(e) => setHostelRequired(e.target.checked)}
                    />
                    <span className="checkmark"></span>
                    Hostel Facility Required
                  </label>
                  <label className="checkbox-container">
                    <input 
                      type="checkbox" 
                      checked={placementPriority} 
                      onChange={(e) => setPlacementPriority(e.target.checked)}
                    />
                    <span className="checkmark"></span>
                    High Placement Packages Priority
                  </label>
                </div>

                {profileMsg && <p className="profile-msg">{profileMsg}</p>}

                <div className="profile-buttons-row">
                  <button type="submit" className="btn btn-primary w-full" disabled={profileSaving}>
                    {profileSaving ? 'Saving...' : 'Save Profile & Run Predictor'}
                    <ArrowRight size={16} />
                  </button>
                  
                  <button type="button" className="btn btn-secondary logout-btn-text" onClick={handleLogout}>
                    Logout Profile
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Feature Breakdown Cards */}
      <section className="features-section animate-fade-in" style={{ animationDelay: '0.2s' }}>
        <h2>AI CAP Guidance Capabilities</h2>
        <p>The platform aggregates official data and provides precise, document-verified counselling.</p>
        
        <div className="features-grid">
          <div className="feature-card glass-panel">
            <Compass className="feature-icon" />
            <h3>College Probability Predictor</h3>
            <p>Calculate your chances across Safe, High, Moderate, and Dream buckets using 3-year historical cutoffs and seat vacancy indicators.</p>
          </div>
          <div className="feature-card glass-panel">
            <Sliders className="feature-icon" />
            <h3>CAP Preference Builder</h3>
            <p>Build and arrange your choice form using drag-and-drop. AI reviews your option order for risk and cutoff validation warnings.</p>
          </div>
          <div className="feature-card glass-panel">
            <MessageSquare className="feature-icon" />
            <h3>AI RAG Chat Counsellor</h3>
            <p>Query cutoffs, vacant seats, hostel details, and placements. Returns 100% accurate information cited from official PDFs.</p>
          </div>
          <div className="feature-card glass-panel">
            <ArrowRightLeft className="feature-icon" />
            <h3>College Comparison Matrix</h3>
            <p>Compare up to 5 engineering institutes side-by-side on NIRF ranking, average placements package, fees, and location details.</p>
          </div>
        </div>
      </section>

      {/* Landing page specific CSS */}
      <style jsx>{`
        .landing-page-wrapper {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px 0;
        }
        
        .landing-hero {
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          gap: 40px;
          align-items: center;
          margin-bottom: 60px;
        }
        
        .hero-content h1 {
          font-size: 2.8rem;
          line-height: 1.15;
          margin-bottom: 20px;
          font-weight: 800;
        }
        .hero-content p {
          color: var(--text-secondary);
          font-size: 1.1rem;
          line-height: 1.6;
          margin-bottom: 35px;
        }
        
        .glow-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(99, 102, 241, 0.15);
          color: var(--accent-primary);
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border: 1px solid rgba(99, 102, 241, 0.25);
          margin-bottom: 20px;
          box-shadow: 0 0 15px rgba(99, 102, 241, 0.1);
        }
        
        .landing-stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }
        
        .stat-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--panel-border);
          border-radius: 12px;
          padding: 16px;
        }
        .stat-card h3 {
          font-size: 1.8rem;
          color: var(--accent-primary);
          margin-bottom: 4px;
        }
        .stat-card p {
          font-size: 0.85rem;
          color: var(--text-secondary);
          margin: 0;
        }
        
        .auth-profile-panel {
          padding: 30px;
          background: var(--panel-bg);
          border: 1px solid var(--panel-border);
          box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        }
        
        .auth-tabs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          margin-bottom: 25px;
          background: rgba(0,0,0,0.2);
          border-radius: 8px;
          padding: 4px;
        }
        .auth-tab {
          padding: 10px;
          background: transparent;
          border: none;
          color: var(--text-secondary);
          font-family: var(--font-heading);
          font-weight: 600;
          font-size: 0.9rem;
          cursor: pointer;
          border-radius: 6px;
          transition: all 0.2s;
        }
        .auth-tab.active {
          background: var(--accent-primary);
          color: #ffffff;
        }
        
        .auth-form {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }
        
        .auth-error-msg {
          color: var(--error-color);
          font-size: 0.85rem;
          font-weight: 500;
        }
        
        .auth-success-msg {
          color: var(--success-color);
          font-size: 0.85rem;
          font-weight: 500;
        }
        
        .w-full {
          width: 100%;
        }
        
        .profile-header {
          margin-bottom: 25px;
        }
        .profile-header h2 {
          font-size: 1.4rem;
          margin-bottom: 6px;
        }
        .profile-header p {
          font-size: 0.85rem;
          color: var(--text-secondary);
        }
        
        .profile-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
          max-height: 60vh;
          overflow-y: auto;
          padding-right: 8px;
        }
        
        .form-row-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        
        .options-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 6px;
        }
        
        .toggle-option-btn {
          padding: 6px 12px;
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--panel-border);
          color: var(--text-secondary);
          font-size: 0.78rem;
          cursor: pointer;
          transition: all 0.2s;
        }
        .toggle-option-btn:hover {
          color: var(--text-primary);
          background: rgba(255,255,255,0.06);
        }
        .toggle-option-btn.active {
          background: rgba(99, 102, 241, 0.15);
          border-color: var(--accent-primary);
          color: var(--accent-primary);
          font-weight: 600;
        }
        
        .checkboxes-row {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin: 10px 0;
        }
        
        .checkbox-container {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 0.88rem;
          color: var(--text-secondary);
          cursor: pointer;
          user-select: none;
        }
        .checkbox-container input {
          width: 16px;
          height: 16px;
          accent-color: var(--accent-primary);
        }
        
        .profile-msg {
          color: var(--accent-primary);
          font-size: 0.85rem;
          font-weight: 600;
        }
        
        .profile-buttons-row {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 10px;
        }
        
        .logout-btn-text {
          font-size: 0.85rem;
          padding: 8px;
          background: transparent;
          color: var(--text-secondary);
          border: none;
          cursor: pointer;
          text-decoration: underline;
        }
        .logout-btn-text:hover {
          color: var(--error-color);
        }
        
        .features-section {
          text-align: center;
          margin-bottom: 40px;
        }
        .features-section h2 {
          font-size: 2rem;
          margin-bottom: 8px;
        }
        .features-section > p {
          color: var(--text-secondary);
          margin-bottom: 40px;
        }
        
        .features-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 25px;
          text-align: left;
        }
        
        .feature-card {
          padding: 30px;
          transition: all 0.3s ease;
        }
        .feature-card:hover {
          transform: translateY(-4px);
          border-color: rgba(99, 102, 241, 0.2);
          box-shadow: 0 10px 30px rgba(99, 102, 241, 0.05);
        }
        
        .feature-icon {
          color: var(--accent-primary);
          width: 32px;
          height: 32px;
          margin-bottom: 18px;
        }
        .feature-card h3 {
          font-size: 1.2rem;
          margin-bottom: 8px;
        }
        .feature-card p {
          color: var(--text-secondary);
          font-size: 0.9rem;
          line-height: 1.5;
        }

        @media (max-width: 1024px) {
          .landing-hero {
            grid-template-columns: 1fr;
            gap: 30px;
          }
          .features-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

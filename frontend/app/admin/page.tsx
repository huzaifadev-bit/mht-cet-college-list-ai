"use html";
"use client";

import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';
import { 
  ClipboardList, 
  UploadCloud, 
  Database, 
  Trash2, 
  Activity, 
  CheckCircle, 
  XCircle, 
  Clock, 
  BarChart, 
  HelpCircle,
  AlertTriangle
} from 'lucide-react';

interface UploadedDocument {
  id: number;
  filename: string;
  file_type: string;
  academic_year: string;
  cap_round: number | null;
  status: string;
  error_message: string | null;
  uploaded_at: string;
}

interface Analytics {
  colleges_indexed: number;
  cutoff_records: number;
  total_student_queries: number;
  uploaded_pdfs: number;
  average_student_percentile: number;
}

export default function AdminDashboard() {
  const [token, setToken] = useState<string | null>(null);
  const [adminUser, setAdminUser] = useState<any>(null);
  const [error, setError] = useState('');

  // Admin login states
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const handleAdminLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          username: adminEmail,
          password: adminPassword
        })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.access_token);
        
        // Fetch user profile
        const userRes = await fetch(`${API_BASE_URL}/api/auth/me`, {
          headers: { 'Authorization': `Bearer ${data.access_token}` }
        });
        const userData = await userRes.json();
        
        if (userData.is_admin) {
          localStorage.setItem('user', JSON.stringify(userData));
          setToken(data.access_token);
          setAdminUser(userData);
          fetchAnalytics(data.access_token);
          fetchDocuments(data.access_token);
          setError('');
          window.location.reload(); // Reload to populate polling and layout triggers
        } else {
          localStorage.removeItem('token');
          setLoginError('Access Denied. Admin privileges required.');
        }
      } else {
        setLoginError(data.detail || 'Invalid admin credentials.');
      }
    } catch (err: any) {
      setLoginError('Error logging in.');
    } finally {
      setLoginLoading(false);
    }
  };
  
  // Analytics
  const [analytics, setAnalytics] = useState<Analytics>({
    colleges_indexed: 0,
    cutoff_records: 0,
    total_student_queries: 0,
    uploaded_pdfs: 0,
    average_student_percentile: 0.0
  });

  // Logs list
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Upload Form State
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState('cutoff');
  const [academicYear, setAcademicYear] = useState('2024-25');
  const [capRound, setCapRound] = useState('1');
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const [uploadError, setUploadError] = useState('');

  // Reindexing state
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (savedToken && savedUser) {
      try {
        const u = JSON.parse(savedUser);
        if (u.is_admin) {
          setToken(savedToken);
          setAdminUser(u);
          fetchAnalytics(savedToken);
          fetchDocuments(savedToken);
          
          // Set poll interval to update logs processing status
          const interval = setInterval(() => {
            fetchDocuments(savedToken);
            fetchAnalytics(savedToken);
          }, 5000);
          
          return () => clearInterval(interval);
        } else {
          setError('Access Denied. Admin privileges required.');
        }
      } catch (e) {
        setError('Error reading session data.');
      }
    } else {
      setError('Please login as administrator to access the dashboard.');
    }
  }, []);

  const fetchAnalytics = async (authToken: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/analytics`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch (e) {
      console.log('Error fetching analytics:', e);
    }
  };

  const fetchDocuments = async (authToken: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/documents`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch (e) {
      console.log('Error fetching uploaded documents logs:', e);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setUploadFile(e.target.files[0]);
      setUploadMsg('');
      setUploadError('');
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadMsg('');
    setUploadError('');
    
    if (!uploadFile) {
      setUploadError('Please select a PDF document to upload.');
      return;
    }

    setUploadLoading(true);
    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('file_type', fileType);
    formData.append('academic_year', academicYear);
    if (fileType === 'cutoff' || fileType === 'vacancy') {
      formData.append('cap_round', capRound);
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        setUploadMsg(data.message || 'File uploaded successfully and queued for parsing.');
        setUploadFile(null);
        // Clear input element
        const fileInput = document.getElementById('admin-file-input') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        
        fetchDocuments(token!);
        fetchAnalytics(token!);
      } else {
        throw new Error(data.detail || 'Upload failed');
      }
    } catch (err: any) {
      setUploadError(err.message || 'Error occurred during PDF upload.');
    } finally {
      setUploadLoading(false);
    }
  };

  const handleWipeDatabase = async () => {
    if (!confirm('WARNING: Wiping the database will delete all college data, cutoffs, vacancy tables, preference forms, and vectorized chunks. This action is irreversible. Proceed?')) {
      return;
    }

    setResetLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/reset`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'Database wiped successfully.');
        fetchDocuments(token!);
        fetchAnalytics(token!);
      } else {
        alert(data.detail || 'Failed to wipe database');
      }
    } catch (e) {
      console.log(e);
      alert('Error wiping database.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="admin-workspace animate-fade-in">
      <div className="page-header">
        <div className="title-area">
          <ClipboardList className="header-icon" />
          <div>
            <h1>Admin Control Panel</h1>
            <p>Upload official PDFs, check background parsing queues, and monitor database health.</p>
          </div>
        </div>
      </div>

      {!token ? (
        <div className="error-card glass-panel" style={{ maxWidth: '400px', margin: '40px auto', textAlign: 'left' }}>
          <h2 style={{ fontSize: '1.4rem', marginBottom: '8px', fontWeight: 'bold' }}>Admin Login Portal</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '20px' }}>
            Enter administrator credentials to access the data index control panel.
          </p>
          <form onSubmit={handleAdminLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <label className="form-label">Email Address</label>
              <input 
                type="email" 
                className="form-input" 
                placeholder="admin@example.com" 
                value={adminEmail} 
                onChange={e => setAdminEmail(e.target.value)} 
                required 
              />
            </div>
            <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <label className="form-label">Password</label>
              <input 
                type="password" 
                className="form-input" 
                placeholder="••••••••" 
                value={adminPassword} 
                onChange={e => setAdminPassword(e.target.value)} 
                required 
              />
            </div>
            {loginError && <p className="auth-error-msg" style={{ color: 'var(--error-color)', fontSize: '0.85rem', margin: 0 }}>{loginError}</p>}
            <button type="submit" className="btn btn-primary w-full" disabled={loginLoading} style={{ marginTop: '10px' }}>
              {loginLoading ? 'Verifying...' : 'Login as Admin'}
            </button>
          </form>
        </div>
      ) : error ? (
        <div className="error-card glass-panel">
          <XCircle size={32} className="error-icon" />
          <p>{error}</p>
        </div>
      ) : (
        <div className="admin-layout">
          {/* TOP ANALYTICS GRID */}
          <div className="analytics-grid">
            <div className="analytics-card glass-panel">
              <Database className="card-icon" />
              <div>
                <span>Colleges Indexed</span>
                <h2>{analytics.colleges_indexed}</h2>
              </div>
            </div>
            
            <div className="analytics-card glass-panel">
              <Activity className="card-icon glow-blue" />
              <div>
                <span>Cutoff records</span>
                <h2>{analytics.cutoff_records}</h2>
              </div>
            </div>

            <div className="analytics-card glass-panel">
              <BarChart className="card-icon glow-green" />
              <div>
                <span>Queries Handled</span>
                <h2>{analytics.total_student_queries}</h2>
              </div>
            </div>

            <div className="analytics-card glass-panel">
              <UploadCloud className="card-icon glow-orange" />
              <div>
                <span>PDF Documents</span>
                <h2>{analytics.uploaded_pdfs}</h2>
              </div>
            </div>
          </div>

          <div className="dashboard-columns">
            {/* COLUMN 1: UPLOADER & DB ACTIONS */}
            <div className="column-left flex-col gap-25">
              {/* FILE UPLOADER */}
              <div className="uploader-card glass-panel">
                <h3>Upload Official PDF Data</h3>
                <p className="hint">Upload a fresh CET Cutoff list, Seat Vacancy sheet, or College details brochure.</p>
                
                <form onSubmit={handleUploadSubmit} className="uploader-form">
                  <div className="file-drop-area">
                    <UploadCloud size={32} className="drop-icon" />
                    <input 
                      type="file" 
                      accept=".pdf" 
                      id="admin-file-input" 
                      onChange={handleFileChange}
                      required
                    />
                    <p className="drop-text">
                      {uploadFile ? `Selected: ${uploadFile.name}` : 'Click here or drag and drop your official PDF (PDF only)'}
                    </p>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Document Type</label>
                    <select 
                      className="form-input"
                      value={fileType}
                      onChange={(e) => setFileType(e.target.value)}
                    >
                      <option value="cutoff">Official CAP Round Cutoffs</option>
                      <option value="seat_matrix">Official Seat Matrix (Intake per College)</option>
                      <option value="vacancy">Official Seat Vacancy Chart</option>
                      <option value="fee">Tuition Fee Structure brochure</option>
                      <option value="placement">Placements Report slide/PDF</option>
                      <option value="hostel">Hostel Accommodation info</option>
                      <option value="college_info">College Profile / Details brochure</option>
                    </select>
                  </div>

                  <div className="form-row-2">
                    <div className="form-group">
                      <label className="form-label">Academic Year</label>
                      <select 
                        className="form-input"
                        value={academicYear}
                        onChange={(e) => setAcademicYear(e.target.value)}
                      >
                        <option value="2024-25">2024-25 (Current)</option>
                        <option value="2023-24">2023-24 (Previous)</option>
                        <option value="2022-23">2022-23 (Historical)</option>
                      </select>
                    </div>

                    {(fileType === 'cutoff' || fileType === 'vacancy') && (
                      <div className="form-group">
                        <label className="form-label">CAP Admission Round</label>
                        <select 
                          className="form-input"
                          value={capRound}
                          onChange={(e) => setCapRound(e.target.value)}
                        >
                          <option value="1">Round 1</option>
                          <option value="2">Round 2</option>
                          <option value="3">Round 3</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {uploadMsg && <p className="success-upload-msg">{uploadMsg}</p>}
                  {uploadError && <p className="error-upload-msg">{uploadError}</p>}

                  <button type="submit" className="btn btn-primary w-full" disabled={uploadLoading}>
                    {uploadLoading ? 'Uploading and Queueing...' : 'Upload & Start Parsing Ingestion'}
                  </button>
                </form>
              </div>

              {/* DB ADMIN CONTROLS */}
              <div className="db-controls-card glass-panel">
                <h3>Database Maintenance Console</h3>
                <p className="hint">Reset data to restart a fresh indexing cycle for new CAP rounds.</p>
                
                <div className="maintenance-action-box">
                  <div className="action-desc">
                    <AlertTriangle className="warn-icon" size={16} />
                    <div>
                      <p className="action-title">Wipe Database & Reindex</p>
                      <p className="action-para">Clears all relational tables and vector indexes. Preserves admin login accounts.</p>
                    </div>
                  </div>
                  
                  <button 
                    className="btn btn-secondary wipe-btn"
                    onClick={handleWipeDatabase}
                    disabled={resetLoading}
                  >
                    {resetLoading ? 'Wiping Database...' : 'WIPE ALL KNOWLEDGE BASE'}
                  </button>
                </div>
              </div>
            </div>

            {/* COLUMN 2: PROCESSING LOGS */}
            <div className="column-right glass-panel">
              <div className="panel-title-row">
                <h2>Document Parsing Status Logs</h2>
                <p>Background worker process status logs. Updates every 5 seconds.</p>
              </div>

              <div className="logs-table-wrapper">
                <table className="logs-table">
                  <thead>
                    <tr>
                      <th>Filename</th>
                      <th>Type</th>
                      <th>Year</th>
                      <th>Status</th>
                      <th>Worker Output / Error details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.length > 0 ? (
                      documents.map((doc) => {
                        let statusIcon = <Clock className="status-ico-pending" size={12} />;
                        let statusClass = 'status-pending';
                        if (doc.status === 'completed') {
                          statusIcon = <CheckCircle className="status-ico-complete" size={12} />;
                          statusClass = 'status-complete';
                        } else if (doc.status === 'failed') {
                          statusIcon = <XCircle className="status-ico-failed" size={12} />;
                          statusClass = 'status-failed';
                        }

                        return (
                          <tr key={doc.id}>
                            <td className="filename-td">{doc.filename}</td>
                            <td className="type-td">{doc.file_type.toUpperCase()}</td>
                            <td className="year-td">{doc.academic_year}</td>
                            <td>
                              <span className={`status-badge ${statusClass}`}>
                                {statusIcon} {doc.status.toUpperCase()}
                              </span>
                            </td>
                            <td className="log-msg-td">{doc.error_message || 'Indexing in progress...'}</td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="empty-row-msg">
                          No documents uploaded yet. Upload a PDF on the left.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .admin-workspace {
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
        
        .admin-layout {
          display: flex;
          flex-direction: column;
          gap: 30px;
        }
        
        .analytics-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
        }
        .analytics-card {
          padding: 20px;
          display: flex;
          align-items: center;
          gap: 20px;
        }
        .card-icon {
          width: 36px;
          height: 36px;
          color: var(--accent-primary);
          filter: drop-shadow(0 0 6px rgba(99, 102, 241, 0.4));
        }
        .glow-blue {
          color: var(--accent-secondary);
          filter: drop-shadow(0 0 6px rgba(14, 165, 233, 0.4));
        }
        .glow-green {
          color: var(--success-color);
          filter: drop-shadow(0 0 6px rgba(16, 185, 129, 0.4));
        }
        .glow-orange {
          color: var(--warning-color);
          filter: drop-shadow(0 0 6px rgba(245, 158, 11, 0.4));
        }
        .analytics-card span {
          font-size: 0.72rem;
          color: var(--text-secondary);
          text-transform: uppercase;
          font-weight: 600;
        }
        .analytics-card h2 {
          font-size: 1.6rem;
          font-weight: 700;
        }
        
        .dashboard-columns {
          display: grid;
          grid-template-columns: 0.8fr 1.2fr;
          gap: 30px;
          align-items: start;
        }
        
        .flex-col {
          display: flex;
          flex-direction: column;
        }
        .gap-25 {
          gap: 25px;
        }
        
        .uploader-card h3, .db-controls-card h3, .column-right h2 {
          font-size: 1.2rem;
          margin-bottom: 4px;
        }
        .hint {
          font-size: 0.8rem;
          color: var(--text-secondary);
          margin-bottom: 20px;
        }
        
        .uploader-form {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }
        
        .file-drop-area {
          border: 2px dashed var(--panel-border);
          border-radius: 12px;
          padding: 30px;
          text-align: center;
          position: relative;
          cursor: pointer;
          transition: all 0.2s;
          background: rgba(0,0,0,0.1);
        }
        .file-drop-area:hover {
          border-color: var(--accent-primary);
          background: rgba(99, 102, 241, 0.02);
        }
        .file-drop-area input {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          width: 100%;
          height: 100%;
          opacity: 0;
          cursor: pointer;
        }
        
        .drop-icon {
          color: var(--text-secondary);
          margin-bottom: 8px;
        }
        .drop-text {
          font-size: 0.82rem;
          color: var(--text-secondary);
        }
        
        .form-row-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
        }
        
        .success-upload-msg {
          color: var(--success-color);
          font-size: 0.8rem;
          font-weight: 500;
        }
        .error-upload-msg {
          color: var(--error-color);
          font-size: 0.8rem;
          font-weight: 500;
        }
        
        .w-full {
          width: 100%;
        }
        
        .maintenance-action-box {
          background: rgba(255,255,255,0.01);
          border: 1px solid var(--panel-border);
          border-radius: 10px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 15px;
        }
        .maintenance-action-box .action-desc {
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }
        .warn-icon {
          color: var(--error-color);
          flex-shrink: 0;
          margin-top: 2px;
        }
        .action-title {
          font-size: 0.9rem;
          font-weight: 600;
        }
        .action-para {
          font-size: 0.76rem;
          color: var(--text-secondary);
          line-height: 1.4;
          margin-top: 1px;
        }
        .wipe-btn {
          color: var(--error-color) !important;
          border-color: rgba(239, 68, 68, 0.2) !important;
        }
        .wipe-btn:hover {
          background: rgba(239, 68, 68, 0.08) !important;
        }
        
        .column-right {
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        
        .panel-title-row {
          margin-bottom: 20px;
        }
        .panel-title-row h2 {
          font-size: 1.2rem;
          margin-bottom: 4px;
        }
        .panel-title-row p {
          font-size: 0.82rem;
          color: var(--text-secondary);
        }
        
        .logs-table-wrapper {
          overflow-y: auto;
          max-height: 60vh;
        }
        .logs-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.8rem;
          text-align: left;
        }
        .logs-table th, .logs-table td {
          padding: 12px 14px;
          border-bottom: 1px solid var(--panel-border);
        }
        .logs-table th {
          color: var(--text-secondary);
          font-weight: 600;
          text-transform: uppercase;
          font-size: 0.72rem;
          letter-spacing: 0.05em;
          background: rgba(0,0,0,0.15);
        }
        
        .filename-td {
          font-weight: 600;
          max-width: 150px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .type-td {
          font-family: monospace;
          color: var(--accent-secondary);
        }
        .year-td {
          color: var(--text-secondary);
        }
        
        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 0.65rem;
          font-weight: 600;
          padding: 2px 6px;
          border-radius: 4px;
        }
        .status-pending {
          background: rgba(255,255,255,0.05);
          color: var(--text-secondary);
        }
        .status-complete {
          background: rgba(16, 185, 129, 0.1);
          color: var(--success-color);
          border: 1px solid rgba(16, 185, 129, 0.2);
        }
        .status-failed {
          background: rgba(239, 68, 68, 0.1);
          color: var(--error-color);
          border: 1px solid rgba(239, 68, 68, 0.2);
        }
        .status-ico-pending { color: var(--text-secondary); }
        .status-ico-complete { color: var(--success-color); }
        .status-ico-failed { color: var(--error-color); }
        
        .log-msg-td {
          max-width: 250px;
          color: var(--text-secondary);
          line-height: 1.3;
        }
        
        .empty-row-msg {
          text-align: center;
          padding: 40px;
          color: var(--text-secondary);
          font-style: italic;
        }
        
        .error-card {
          text-align: center;
          padding: 50px;
          max-width: 500px;
          margin: 40px auto;
        }
        .error-icon {
          color: var(--error-color);
          margin-bottom: 15px;
        }

        @media (max-width: 1024px) {
          .analytics-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .dashboard-columns {
            grid-template-columns: 1fr;
          }
        }
        @media (max-width: 600px) {
          .analytics-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

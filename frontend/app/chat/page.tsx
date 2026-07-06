"use html";
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { API_BASE_URL } from '../config';
import { 
  MessageSquare, 
  Send, 
  Sparkles, 
  AlertCircle, 
  BookOpen, 
  HelpCircle,
  Clock,
  Trash2
} from 'lucide-react';

interface Message {
  role: 'student' | 'ai';
  content: string;
  sources?: string[];
  timestamp: string;
}

export default function ChatbotPage() {
  const [token, setToken] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const presetQuestions = [
    "I got 92.4 percentile in OBC. Which Pune colleges can I get?",
    "Compare VIT Pune and PCCOE.",
    "Which colleges had vacant Computer Engineering seats last year?",
    "What was the CAP Round 3 closing percentile for AI & Data Science?"
  ];

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    if (savedToken) {
      setToken(savedToken);
    }
    
    // Set initial welcome message
    setMessages([
      {
        role: 'ai',
        content: "Hello! I am your AI MHT CET Admission Counsellor. I answer admission queries using only the official PDFs (cutoffs, vacancies, fees, placements) uploaded by your administrator. Ask me anything!",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async (text: string) => {
    if (!text.trim() || loading) return;
    
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Add user message
    const userMessage: Message = {
      role: 'student',
      content: text,
      timestamp
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setLoading(true);

    try {
      // Build history payload
      const chat_history = messages.map(m => ({
        role: m.role === 'student' ? 'user' : 'model',
        content: m.content
      }));

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: text,
          chat_history
        })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to fetch AI response.');
      }

      const aiMessage: Message = {
        role: 'ai',
        content: data.response,
        sources: data.sources || [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      
      setMessages(prev => [...prev, aiMessage]);
    } catch (err: any) {
      const errorMessage: Message = {
        role: 'ai',
        content: `Error: ${err.message || 'Could not reach the AI server. Make sure the FastAPI backend is running.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    if (confirm("Wipe chat history?")) {
      setMessages([
        {
          role: 'ai',
          content: "Chat history cleared. Ask me any new MHT CET admission question!",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
  };

  return (
    <div className="chat-workspace animate-fade-in">
      <div className="page-header">
        <div className="title-area">
          <MessageSquare className="header-icon" />
          <div>
            <h1>AI Admission Counsellor</h1>
            <p>Get instant answers verified by official cutoffs and vacancy documents.</p>
          </div>
        </div>
        
        <button className="btn btn-secondary clear-btn" onClick={clearChat} title="Clear Chat">
          <Trash2 size={16} /> WIPE HISTORY
        </button>
      </div>

      <div className="chat-layout">
        {/* LEFT PANEL: PRESETS & CONTEXT INFO */}
        <div className="presets-panel glass-panel">
          <div className="panel-header-mini">
            <HelpCircle size={16} className="panel-icon" />
            <h3>Suggested Questions</h3>
          </div>
          <p className="panel-desc">Click any suggested query below to test the AI recommendation engine:</p>
          
          <div className="presets-list">
            {presetQuestions.map((q, idx) => (
              <button 
                key={idx} 
                className="preset-btn glass-card"
                onClick={() => handleSend(q)}
                disabled={loading}
              >
                {q}
              </button>
            ))}
          </div>

          <div className="context-card glass-card">
            <BookOpen size={16} className="context-icon" />
            <h4>Document-Backed Chat</h4>
            <p>Every response is evaluated against the administrator's uploaded files (e.g. CAP rounds, vacancy charts). We enforce strict RAG boundaries to prevent AI hallucinations.</p>
          </div>
        </div>

        {/* RIGHT PANEL: CONVERSATION WORKSPACE */}
        <div className="conversation-panel glass-panel">
          <div className="message-stream">
            {messages.map((m, idx) => {
              const isUser = m.role === 'student';
              return (
                <div key={idx} className={`message-bubble-wrapper ${isUser ? 'user-wrapper' : 'ai-wrapper'}`}>
                  {!isUser && (
                    <div className="bot-avatar">
                      <Sparkles size={14} className="avatar-icon" />
                    </div>
                  )}
                  
                  <div className="message-content-box">
                    <div className={`message-bubble ${isUser ? 'user-bubble' : 'ai-bubble'}`}>
                      <p className="msg-text">{m.content}</p>
                      
                      {m.sources && m.sources.length > 0 && (
                        <div className="msg-sources">
                          <span className="source-lbl">SOURCES CITED:</span>
                          <div className="sources-badges">
                            {m.sources.map((src, sIdx) => (
                              <span key={sIdx} className="source-badge">{src}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <span className="message-timestamp">
                      <Clock size={10} /> {m.timestamp}
                    </span>
                  </div>
                </div>
              );
            })}

            {loading && (
              <div className="message-bubble-wrapper ai-wrapper">
                <div className="bot-avatar bubble-loading">
                  <Sparkles size={14} className="avatar-icon-spin" />
                </div>
                <div className="message-content-box">
                  <div className="message-bubble ai-bubble loading-bubble">
                    <div className="dots-container">
                      <div className="dot"></div>
                      <div className="dot"></div>
                      <div className="dot"></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* INPUT FORM BAR */}
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSend(inputValue); }} 
            className="chat-input-bar"
          >
            <input 
              type="text" 
              placeholder="Ask about vit Pune placements, coep cutoff for Open, vacant CS seats..." 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="chat-input-field"
              disabled={loading}
            />
            <button type="submit" className="btn btn-primary send-btn" disabled={loading || !inputValue.trim()}>
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>

      <style jsx>{`
        .chat-workspace {
          height: 84vh;
          display: flex;
          flex-direction: column;
        }
        
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
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
        
        .chat-layout {
          display: grid;
          grid-template-columns: 0.6fr 1.4fr;
          gap: 25px;
          flex: 1;
          min-height: 0; /* Important for flex child scroll */
        }
        
        .presets-panel {
          display: flex;
          flex-direction: column;
          gap: 15px;
          height: 100%;
          overflow-y: auto;
        }
        
        .panel-header-mini {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .panel-icon {
          color: var(--accent-primary);
        }
        .panel-desc {
          font-size: 0.8rem;
          color: var(--text-secondary);
          line-height: 1.4;
        }
        
        .presets-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .preset-btn {
          text-align: left;
          padding: 12px;
          font-size: 0.82rem;
          color: var(--text-primary);
          cursor: pointer;
          border-radius: 8px;
          background: rgba(255,255,255,0.01);
          line-height: 1.3;
        }
        .preset-btn:hover {
          background: rgba(99, 102, 241, 0.05);
          border-color: rgba(99, 102, 241, 0.2);
        }
        
        .context-card {
          margin-top: auto;
          padding: 15px;
          background: rgba(99, 102, 241, 0.02);
          border-color: rgba(99, 102, 241, 0.08);
        }
        .context-icon {
          color: var(--accent-primary);
          margin-bottom: 8px;
        }
        .context-card h4 {
          font-size: 0.88rem;
          margin-bottom: 4px;
        }
        .context-card p {
          font-size: 0.76rem;
          color: var(--text-secondary);
          line-height: 1.4;
        }
        
        .conversation-panel {
          display: flex;
          flex-direction: column;
          height: 100%;
          padding: 20px;
          min-height: 0;
        }
        
        .message-stream {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 20px;
          padding-right: 8px;
          margin-bottom: 20px;
        }
        
        .message-bubble-wrapper {
          display: flex;
          gap: 12px;
          max-width: 80%;
        }
        .user-wrapper {
          align-self: flex-end;
          flex-direction: row-reverse;
        }
        .ai-wrapper {
          align-self: flex-start;
        }
        
        .bot-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(99, 102, 241, 0.15);
          border: 1px solid rgba(99, 102, 241, 0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--accent-primary);
          flex-shrink: 0;
        }
        
        .bubble-loading {
          background: rgba(255,255,255,0.03);
          border-color: var(--panel-border);
          color: var(--text-secondary);
        }
        .avatar-icon-spin {
          animation: spin 2s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        
        .message-content-box {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .user-wrapper .message-content-box {
          align-items: flex-end;
        }
        .ai-wrapper .message-content-box {
          align-items: flex-start;
        }
        
        .message-bubble {
          padding: 12px 18px;
          border-radius: 16px;
          font-size: 0.9rem;
          line-height: 1.5;
        }
        
        .user-bubble {
          background: var(--accent-primary);
          color: #ffffff;
          border-bottom-right-radius: 4px;
        }
        
        .ai-bubble {
          background: rgba(255,255,255,0.02);
          border: 1px solid var(--panel-border);
          color: var(--text-primary);
          border-bottom-left-radius: 4px;
        }
        
        .loading-bubble {
          padding: 14px 22px;
        }
        .dots-container {
          display: flex;
          gap: 4px;
        }
        .dot {
          width: 6px;
          height: 6px;
          background: var(--text-secondary);
          border-radius: 50%;
          animation: bounce 1.4s infinite ease-in-out both;
        }
        .dot:nth-child(1) { animation-delay: -0.32s; }
        .dot:nth-child(2) { animation-delay: -0.16s; }
        
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1.0); }
        }
        
        .msg-text {
          white-space: pre-wrap;
        }
        
        .msg-sources {
          margin-top: 12px;
          border-top: 1px dashed var(--panel-border);
          padding-top: 8px;
        }
        .source-lbl {
          display: block;
          font-size: 0.65rem;
          color: var(--accent-secondary);
          font-weight: 700;
          letter-spacing: 0.05em;
          margin-bottom: 4px;
        }
        .sources-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .source-badge {
          font-size: 0.68rem;
          background: rgba(14, 165, 233, 0.1);
          color: var(--accent-secondary);
          border: 1px solid rgba(14, 165, 233, 0.2);
          padding: 2px 6px;
          border-radius: 4px;
        }
        
        .message-timestamp {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 0.68rem;
          color: var(--text-secondary);
          opacity: 0.6;
        }
        
        .chat-input-bar {
          display: flex;
          gap: 12px;
          background: rgba(0, 0, 0, 0.25);
          border: 1px solid var(--panel-border);
          border-radius: 12px;
          padding: 6px 6px 6px 16px;
        }
        .chat-input-field {
          flex: 1;
          background: transparent;
          border: none;
          color: var(--text-primary);
          font-family: var(--font-body);
          font-size: 0.92rem;
          outline: none;
        }
        .send-btn {
          padding: 10px 16px;
        }

        @media (max-width: 900px) {
          .chat-layout {
            grid-template-columns: 1fr;
          }
          .presets-panel {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}

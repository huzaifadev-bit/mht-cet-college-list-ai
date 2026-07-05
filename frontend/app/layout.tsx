"use html"; // indicator for raw HTML templates if needed, but in Next.js this is a tsx layout
"use client";

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Compass, 
  ClipboardList, 
  ArrowRightLeft, 
  MessageSquare, 
  Sliders, 
  User, 
  Sun, 
  Moon, 
  Menu, 
  X,
  LogOut,
  Sparkles
} from 'lucide-react';
import './globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  
  // Theme state
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // User Authentication states
  const [user, setUser] = useState<{name: string, email: string, is_admin: boolean} | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    // Read theme from local storage
    const savedTheme = localStorage.getItem('theme') as 'dark' | 'light' | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
    }

    // Read user auth token from local storage
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setToken(null);
    router.push('/');
  };

  const navItems = [
    { name: 'Predictor', href: '/predictor', icon: Compass },
    { name: 'Preference Builder', href: '/preference-builder', icon: Sliders },
    { name: 'RAG Chatbot', href: '/chat', icon: MessageSquare },
    { name: 'Compare', href: '/compare', icon: ArrowRightLeft },
  ];

  if (user && user.is_admin) {
    navItems.push({ name: 'Admin Control', href: '/admin', icon: ClipboardList });
  }

  return (
    <html lang="en">
      <head>
        <title>MHT CET AI College Predictor</title>
        <meta name="description" content="Most accurate MHT CET Admission Predictor & Choice Option Form Generator powered by AI RAG." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <div className="app-container">
          {/* Mobile Header Bar */}
          <header className="mobile-header">
            <button className="menu-btn" onClick={() => setSidebarOpen(true)}>
              <Menu size={24} />
            </button>
            <div className="mobile-logo">
              <Sparkles size={20} className="glow-icon" />
              <span>MHT CET <font color="#6366f1">AI</font></span>
            </div>
            <button className="theme-toggle-btn" onClick={toggleTheme}>
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </header>

          {/* Sidebar Navigation */}
          <aside className={`sidebar-nav ${sidebarOpen ? 'open' : ''}`}>
            <div className="sidebar-header">
              <div className="logo">
                <Sparkles size={24} className="glow-icon" />
                <h2>MHT CET <span>AI</span></h2>
              </div>
              <button className="close-sidebar-btn" onClick={() => setSidebarOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <nav className="nav-menu">
              <Link 
                href="/" 
                className={`nav-link-item ${pathname === '/' ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <User size={18} />
                <span>Landing Dashboard</span>
              </Link>
              
              <div className="menu-divider">PREDICTION SERVICES</div>
              
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`nav-link-item ${pathname === item.href ? 'active' : ''}`}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <Icon size={18} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="sidebar-footer">
              {user && user.is_admin ? (
                <div className="user-profile-widget">
                  <div className="user-info">
                    <p className="user-name">{user.name}</p>
                    <p className="user-role">Administrator</p>
                  </div>
                  <button className="logout-btn" onClick={handleLogout} title="Logout">
                    <LogOut size={16} />
                  </button>
                </div>
              ) : null}
              
              <button className="sidebar-theme-toggle" onClick={toggleTheme}>
                {theme === 'dark' ? (
                  <>
                    <Sun size={16} />
                    <span>Light Mode</span>
                  </>
                ) : (
                  <>
                    <Moon size={16} />
                    <span>Dark Mode</span>
                  </>
                )}
              </button>
            </div>
          </aside>

          {/* Background Overlay for mobile sidebar */}
          {sidebarOpen && (
            <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)}></div>
          )}

          {/* Main Workspace */}
          <main className="main-content">
            {children}
          </main>
        </div>

        {/* Sidebar Styling inline within globals.css or here for isolation */}
        <style jsx global>{`
          .mobile-header {
            display: none;
            width: 100%;
            height: 60px;
            background: rgba(16, 22, 40, 0.95);
            backdrop-filter: blur(8px);
            border-bottom: 1px solid var(--panel-border);
            padding: 0 20px;
            align-items: center;
            justify-content: space-between;
            position: sticky;
            top: 0;
            z-index: 50;
          }
          
          .sidebar-nav {
            width: var(--sidebar-width);
            background: rgba(10, 15, 29, 0.98);
            border-right: 1px solid var(--panel-border);
            display: flex;
            flex-direction: column;
            height: 100vh;
            position: sticky;
            top: 0;
            z-index: 100;
            transition: transform 0.3s ease;
          }
          
          .sidebar-header {
            padding: 30px 24px;
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          
          .logo {
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .logo h2 {
            font-size: 1.3rem;
            font-weight: 800;
            background: linear-gradient(135deg, #ffffff, #94a3b8);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
          }
          .logo h2 span {
            color: var(--accent-primary);
            -webkit-text-fill-color: initial;
          }
          
          .glow-icon {
            color: var(--accent-primary);
            filter: drop-shadow(0 0 6px rgba(99, 102, 241, 0.6));
          }
          
          .close-sidebar-btn, .menu-btn, .theme-toggle-btn {
            background: transparent;
            border: none;
            color: var(--text-secondary);
            cursor: pointer;
          }
          
          .close-sidebar-btn {
            display: none;
          }
          
          .nav-menu {
            flex: 1;
            padding: 10px 16px;
            display: flex;
            flex-direction: column;
            gap: 4px;
          }
          
          .nav-link-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 16px;
            border-radius: 10px;
            color: var(--text-secondary);
            font-size: 0.95rem;
            font-weight: 500;
            transition: all 0.2s ease;
          }
          .nav-link-item:hover, .nav-link-item.active {
            color: var(--text-primary);
            background: rgba(255, 255, 255, 0.03);
          }
          .nav-link-item.active {
            background: linear-gradient(90deg, rgba(99, 102, 241, 0.15) 0%, rgba(99, 102, 241, 0.02) 100%);
            border-left: 3px solid var(--accent-primary);
            padding-left: 13px;
          }
          
          .menu-divider {
            font-size: 0.72rem;
            font-weight: 700;
            color: var(--text-secondary);
            opacity: 0.5;
            padding: 20px 16px 8px 16px;
            letter-spacing: 0.08em;
          }
          
          .sidebar-footer {
            padding: 20px 16px;
            border-top: 1px solid var(--panel-border);
            display: flex;
            flex-direction: column;
            gap: 10px;
          }
          
          .user-profile-widget {
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid var(--panel-border);
            border-radius: 10px;
            padding: 10px 12px;
          }
          .user-info {
            overflow: hidden;
          }
          .user-name {
            font-size: 0.85rem;
            font-weight: 600;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .user-role {
            font-size: 0.72rem;
            color: var(--text-secondary);
          }
          .logout-btn {
            background: transparent;
            border: none;
            color: var(--text-secondary);
            cursor: pointer;
            padding: 4px;
            border-radius: 4px;
            transition: background 0.2s;
          }
          .logout-btn:hover {
            color: var(--error-color);
            background: rgba(239, 68, 68, 0.08);
          }
          
          .login-prompt-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 10px;
            background: rgba(99, 102, 241, 0.1);
            color: var(--accent-primary);
            border: 1px solid rgba(99, 102, 241, 0.2);
            border-radius: 10px;
            font-size: 0.85rem;
            font-weight: 600;
          }
          .login-prompt-btn:hover {
            background: rgba(99, 102, 241, 0.15);
          }
          
          .sidebar-theme-toggle {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 10px;
            background: transparent;
            border: 1px solid var(--panel-border);
            color: var(--text-secondary);
            border-radius: 10px;
            font-size: 0.85rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
          }
          .sidebar-theme-toggle:hover {
            color: var(--text-primary);
            background: rgba(255, 255, 255, 0.02);
          }
          
          .sidebar-overlay {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            backdrop-filter: blur(4px);
            z-index: 90;
          }

          @media (max-width: 1024px) {
            .mobile-header {
              display: flex;
            }
            .sidebar-nav {
              position: fixed;
              top: 0;
              left: 0;
              bottom: 0;
              transform: translateX(-100%);
              height: 100vh;
            }
            .sidebar-nav.open {
              transform: translateX(0);
            }
            .close-sidebar-btn {
              display: block;
            }
            .sidebar-overlay {
              display: block;
            }
          }
        `}</style>
      </body>
    </html>
  );
}

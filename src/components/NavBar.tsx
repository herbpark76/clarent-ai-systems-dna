import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Network, Menu, X, ChevronDown } from 'lucide-react';

const NAV_LINKS = [
  { label: 'System Map', href: '/#system-map' },
  { label: 'Learning Paths', href: '/#learning-paths' },
  { label: 'Deep Dives', href: '/#deep-dives' },
  { label: 'AI DNA', href: '/#ai-dna' },
  { label: 'Contact', href: '/#waitlist' },
];

const SIGNAL_DESK_LINKS = [
  { label: 'Signal Desk', href: '/signal-desk', desc: 'Latest AI news by system layer' },
  { label: 'Labs', href: '/labs', desc: 'Hands-on tutorials with checklists' },
  { label: 'Use-Case Library', href: '/use-cases', desc: 'Real-world AI applications' },
  { label: 'Model Tracker', href: '/models', desc: 'Compare AI models side by side' },
  { label: 'AI Risk & Governance', href: '/risk', desc: 'Risks, controls, and governance' },
];

export default function NavBar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [signalDeskOpen, setSignalDeskOpen] = useState(false);
  const navigate = useNavigate();

  const handleNavClick = (href: string) => {
    setMobileMenuOpen(false);
    setSignalDeskOpen(false);
    if (href.startsWith('/#')) {
      const hash = href.slice(1);
      if (window.location.pathname === '/') {
        document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth' });
      } else {
        navigate('/');
        setTimeout(() => {
          document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } else {
      navigate(href);
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.06] bg-[#080c14]/90 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 group-hover:scale-105 transition-transform">
              <Network className="w-3.5 h-3.5 text-white" />
            </div>
            <div>
              <span className="text-sm font-semibold text-white">AI Systems DNA</span>
              <span className="hidden sm:block text-[9px] text-white/35 leading-none -mt-0.5">Clarent · AI DNA Framework</span>
            </div>
          </Link>
          <div className="hidden md:flex items-center gap-0.5">
            {NAV_LINKS.map((l) => (
              <button
                key={l.label}
                onClick={() => handleNavClick(l.href)}
                className="px-3 py-1.5 text-xs text-white/55 hover:text-white rounded-md hover:bg-white/[0.05] transition-all"
              >
                {l.label}
              </button>
            ))}
            {/* Signal Desk dropdown */}
            <div className="relative">
              <button
                onClick={() => setSignalDeskOpen(!signalDeskOpen)}
                onBlur={() => setTimeout(() => setSignalDeskOpen(false), 150)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs text-white/55 hover:text-white rounded-md hover:bg-white/[0.05] transition-all"
              >
                Signal Desk
                <ChevronDown className={`w-3 h-3 transition-transform ${signalDeskOpen ? 'rotate-180' : ''}`} />
              </button>
              {signalDeskOpen && (
                <div className="absolute right-0 top-full mt-1 w-64 rounded-xl border border-white/10 bg-[#0c1118] shadow-xl shadow-black/40 overflow-hidden">
                  {SIGNAL_DESK_LINKS.map((l) => (
                    <button
                      key={l.href}
                      onClick={() => handleNavClick(l.href)}
                      className="w-full text-left px-4 py-2.5 hover:bg-white/[0.05] transition-colors block"
                    >
                      <div className="text-xs font-semibold text-white">{l.label}</div>
                      <div className="text-[10px] text-white/35 leading-tight mt-0.5">{l.desc}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => handleNavClick('/#waitlist')}
              className="ml-2 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-xs font-semibold hover:from-blue-400 hover:to-cyan-400 transition-all"
            >
              Get Updates
            </button>
          </div>
          <button className="md:hidden p-2 text-white/50 hover:text-white" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-white/[0.06] bg-[#080c14] px-4 py-3 flex flex-col gap-1 max-h-[calc(100vh-3.5rem)] overflow-y-auto">
          {NAV_LINKS.map((l) => (
            <button
              key={l.label}
              onClick={() => handleNavClick(l.href)}
              className="px-3 py-2 text-sm text-white/55 hover:text-white rounded-md hover:bg-white/[0.05] transition-all text-left"
            >
              {l.label}
            </button>
          ))}
          <div className="px-3 py-1.5 text-[10px] font-semibold text-white/30 uppercase tracking-wide">Signal Desk</div>
          {SIGNAL_DESK_LINKS.map((l) => (
            <button
              key={l.href}
              onClick={() => handleNavClick(l.href)}
              className="px-3 py-2 text-sm text-white/55 hover:text-white rounded-md hover:bg-white/[0.05] transition-all text-left pl-6"
            >
              {l.label}
            </button>
          ))}
        </div>
      )}
    </nav>
  );
}

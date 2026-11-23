import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Network, Menu, X, ChevronDown } from 'lucide-react';

interface NavItem { label: string; href: string; desc?: string }

// Three groups instead of seven links: learn, explore, news.
const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Learn',
    items: [
      { label: 'Learning Paths', href: '/#learning-paths', desc: 'Short lesson series, from beginner up' },
      { label: 'Deep Dives', href: '/#deep-dives', desc: 'One topic in depth, with a quiz' },
      { label: 'Labs', href: '/labs', desc: 'Hands-on tutorials with checklists' },
    ],
  },
  {
    label: 'Explore',
    items: [
      { label: 'System Map', href: '/#system-map', desc: 'All 24 concepts and how they connect' },
      { label: 'Use-Case Library', href: '/use-cases', desc: 'How people are using AI at work' },
      { label: 'Model Tracker', href: '/models', desc: 'Compare AI models side by side' },
      { label: 'AI Risk & Governance', href: '/risk', desc: 'What can go wrong and how to control it' },
    ],
  },
];

const NAV_LINKS: NavItem[] = [
  { label: 'News', href: '/signal-desk' },
  { label: 'Contact', href: '/contact' },
];

function scrollToHash(hash: string) {
  const id = hash.slice(1);
  const el = document.getElementById(id) || document.querySelector(id);
  el?.scrollIntoView({ behavior: 'smooth' });
}

export default function NavBar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = window.location;

  // Handle hash navigation when arriving on the homepage
  useEffect(() => {
    if (location.hash) {
      setTimeout(() => scrollToHash(location.hash), 100);
    }
  }, [location.pathname, location.hash]);

  const handleHashClick = (e: React.MouseEvent, href: string) => {
    if (href.startsWith('/#')) {
      e.preventDefault();
      setMobileMenuOpen(false);
      setOpenGroup(null);
      const hash = href.slice(1);
      if (window.location.pathname === '/') {
        scrollToHash(hash);
      } else {
        navigate('/');
        setTimeout(() => scrollToHash(hash), 100);
      }
    } else {
      setMobileMenuOpen(false);
      setOpenGroup(null);
    }
  };

  const navLinkClass = "px-3 py-1.5 text-xs text-white/55 hover:text-white rounded-md hover:bg-white/[0.05] transition-all";

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
            {NAV_GROUPS.map((group) => (
              <div key={group.label} className="relative">
                <button
                  onClick={() => setOpenGroup(openGroup === group.label ? null : group.label)}
                  onBlur={() => setTimeout(() => setOpenGroup((g) => (g === group.label ? null : g)), 150)}
                  className={`flex items-center gap-1 ${navLinkClass}`}
                  aria-expanded={openGroup === group.label}
                >
                  {group.label}
                  <ChevronDown className={`w-3 h-3 transition-transform ${openGroup === group.label ? 'rotate-180' : ''}`} />
                </button>
                {openGroup === group.label && (
                  <div className="absolute left-0 top-full mt-1 w-64 rounded-xl border border-white/10 bg-[#0c1118] shadow-xl shadow-black/40 overflow-hidden">
                    {group.items.map((l) => (
                      <Link
                        key={l.href}
                        to={l.href}
                        onClick={(e) => handleHashClick(e, l.href)}
                        className="w-full text-left px-4 py-2.5 hover:bg-white/[0.05] transition-colors block"
                      >
                        <div className="text-xs font-semibold text-white">{l.label}</div>
                        {l.desc && <div className="text-[11px] text-white/50 leading-tight mt-0.5">{l.desc}</div>}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {NAV_LINKS.map((l) => (
              <Link
                key={l.label}
                to={l.href}
                onClick={(e) => handleHashClick(e, l.href)}
                className={navLinkClass}
              >
                {l.label}
              </Link>
            ))}
            <Link
              to="/#waitlist"
              onClick={(e) => handleHashClick(e, '/#waitlist')}
              className="ml-2 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-xs font-semibold hover:from-blue-400 hover:to-cyan-400 transition-all"
            >
              Get Updates
            </Link>
          </div>
          <button className="md:hidden p-2 text-white/50 hover:text-white" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-white/[0.06] bg-[#080c14] px-4 py-3 flex flex-col gap-1 max-h-[calc(100vh-3.5rem)] overflow-y-auto">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="mb-1">
              <div className="px-3 py-1.5 text-[10px] font-semibold text-white/40 uppercase tracking-wide">{group.label}</div>
              {group.items.map((l) => (
                <Link
                  key={l.href}
                  to={l.href}
                  onClick={(e) => handleHashClick(e, l.href)}
                  className="block px-3 py-2 text-sm text-white/65 hover:text-white rounded-md hover:bg-white/[0.05] transition-all text-left pl-6"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          ))}
          {NAV_LINKS.map((l) => (
            <Link
              key={l.label}
              to={l.href}
              onClick={(e) => handleHashClick(e, l.href)}
              className="px-3 py-2 text-sm text-white/65 hover:text-white rounded-md hover:bg-white/[0.05] transition-all text-left"
            >
              {l.label}
            </Link>
          ))}
          <Link
            to="/#waitlist"
            onClick={(e) => handleHashClick(e, '/#waitlist')}
            className="mt-2 px-3 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-sm font-semibold text-center"
          >
            Get Updates
          </Link>
        </div>
      )}
    </nav>
  );
}

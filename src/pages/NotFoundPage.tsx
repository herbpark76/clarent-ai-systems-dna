import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import NavBar from '../components/NavBar';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-[#080c14] text-white font-sans antialiased">
      <NavBar />
      <div className="pt-20 max-w-lg mx-auto px-4 text-center">
        <div className="w-12 h-12 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center mx-auto mb-4">
          <Compass className="w-5 h-5 text-white/40" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Page not found</h1>
        <p className="text-sm text-white/40 mb-6">The page you're looking for doesn't exist or has moved.</p>
        <Link to="/" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-sm font-semibold hover:from-blue-400 hover:to-cyan-400 transition-all">
          Back to home
        </Link>
      </div>
    </div>
  );
}

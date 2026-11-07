import { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import NavBar from '../components/NavBar';
import { supabase } from '../lib/supabase';
import { setPageMeta } from '../lib/seo';

export default function UnsubscribePage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'already'>('loading');

  useEffect(() => {
    setPageMeta({
      title: 'Unsubscribe — AI Systems DNA',
      description: 'Unsubscribe from AI Systems DNA updates.',
      path: '/unsubscribe',
      noindex: true,
    });

    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (!token) {
      setStatus('error');
      return;
    }

    (async () => {
      const { data, error } = await supabase
        .from('ai_systems_waitlist')
        .update({ unsubscribed_at: new Date().toISOString() })
        .eq('unsubscribe_token', token)
        .is('unsubscribed_at', null)
        .select('id');

      if (error) {
        setStatus('error');
        return;
      }
      if (!data || data.length === 0) {
        setStatus('already');
        return;
      }
      setStatus('success');
    })();
  }, []);

  return (
    <div className="min-h-screen bg-[#080c14] text-white font-sans antialiased">
      <NavBar />
      <div className="pt-20 max-w-lg mx-auto px-4 text-center">
        {status === 'loading' && (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-6 h-6 text-white/30 animate-spin" />
            <p className="text-sm text-white/40">Processing your request...</p>
          </div>
        )}
        {status === 'success' && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            </div>
            <h1 className="text-xl font-bold text-white">You're unsubscribed</h1>
            <p className="text-sm text-white/40">You won't receive any more update emails from us. If this was a mistake, you can sign up again anytime.</p>
          </div>
        )}
        {status === 'already' && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-white/40" />
            </div>
            <h1 className="text-xl font-bold text-white">Already unsubscribed</h1>
            <p className="text-sm text-white/40">This email is already off our list. No further action is needed.</p>
          </div>
        )}
        {status === 'error' && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <XCircle className="w-6 h-6 text-red-400" />
            </div>
            <h1 className="text-xl font-bold text-white">Something went wrong</h1>
            <p className="text-sm text-white/40">We couldn't process your unsubscribe request. The link may be invalid or expired. Please <a href="/contact" className="text-cyan-400 hover:text-cyan-300 transition-colors">contact us</a> and we'll remove you manually.</p>
          </div>
        )}
      </div>
    </div>
  );
}

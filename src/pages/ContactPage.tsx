import { useState, useEffect } from 'react';
import { Mail, Building2, User, MessageSquare, Loader2, Check, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import NavBar from '../components/NavBar';
import { supabase } from '../lib/supabase';
import { setPageMeta } from '../lib/seo';

const TOPICS = [
  'AI training',
  'Indirect tax & ONESOURCE',
  'Building an AI platform',
  'Other',
];

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', company: '', topic: '', message: '' });
  const [honeypot, setHoneypot] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setPageMeta({
      title: 'Contact — AI Systems DNA',
      description: 'Get in touch with Clarent about AI training, indirect tax & ONESOURCE, or building an AI platform.',
      path: '/contact',
    });
  }, []);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = 'Please enter your name.';
    if (!form.email.trim()) e.email = 'Please enter your email.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Please enter a valid email address.';
    if (!form.topic) e.topic = 'Please select a topic.';
    if (!form.message.trim()) e.message = 'Please enter a message.';
    else if (form.message.trim().length < 10) e.message = 'Message must be at least 10 characters.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (honeypot) return;
    if (!validate()) return;
    setStatus('loading');

    const { error } = await supabase.from('contact_messages').insert({
      name: form.name.trim(),
      email: form.email.trim(),
      company: form.company.trim() || null,
      topic: form.topic,
      message: form.message.trim(),
    });

    if (error) {
      setStatus('error');
      return;
    }

    // Fire-and-forget: notify admin via edge function (never blocks the user)
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/contact-email`;
      fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          company: form.company.trim() || null,
          topic: form.topic,
          message: form.message.trim(),
        }),
      }).catch(() => {});
    } catch { /* no-op */ }

    setStatus('success');
    setForm({ name: '', email: '', company: '', topic: '', message: '' });
  };

  return (
    <div className="min-h-screen bg-[#080c14] text-white font-sans antialiased">
      <NavBar />
      <div className="pt-14">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-24">
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 mb-3 px-3 py-1 rounded-full border border-white/10 bg-white/[0.04] text-xs text-white/45">
              <Mail className="w-3 h-3" />
              Contact
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight mb-3">Get in touch</h1>
            <p className="text-sm text-white/45 leading-relaxed">
              Whether you're exploring AI training, have a question about indirect tax and ONESOURCE, or want to talk about building an AI platform — we'd love to hear from you.
            </p>
          </div>

          {status === 'success' ? (
            <div className="p-7 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.07] text-center">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/25 flex items-center justify-center mx-auto mb-3">
                <Check className="w-5 h-5 text-emerald-400" />
              </div>
              <h2 className="text-base font-bold text-white mb-1.5">Message sent</h2>
              <p className="text-sm text-white/45 mb-4">Thanks for reaching out. We'll get back to you soon.</p>
              <button
                onClick={() => setStatus('idle')}
                className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-white/45 mb-1.5">Name <span className="text-white/25">(required)</span></label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" />
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Your name"
                    className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-white/[0.05] border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.07] transition-all"
                  />
                </div>
                {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-white/45 mb-1.5">Email <span className="text-white/25">(required)</span></label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" />
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="you@example.com"
                    className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-white/[0.05] border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.07] transition-all"
                  />
                </div>
                {errors.email && <p className="text-xs text-red-400 mt-1">{errors.email}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-white/45 mb-1.5">Company <span className="text-white/25">(optional)</span></label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" />
                  <input
                    type="text"
                    value={form.company}
                    onChange={(e) => setForm({ ...form, company: e.target.value })}
                    placeholder="Your company"
                    className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-white/[0.05] border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.07] transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-white/45 mb-1.5">Topic <span className="text-white/25">(required)</span></label>
                <select
                  value={form.topic}
                  onChange={(e) => setForm({ ...form, topic: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg bg-white/[0.05] border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/50 transition-all appearance-none cursor-pointer"
                >
                  <option value="" className="bg-[#0f1523] text-white/40">Select a topic...</option>
                  {TOPICS.map((t) => <option key={t} value={t} className="bg-[#0f1523] text-white">{t}</option>)}
                </select>
                {errors.topic && <p className="text-xs text-red-400 mt-1">{errors.topic}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-white/45 mb-1.5">Message <span className="text-white/25">(required)</span></label>
                <div className="relative">
                  <MessageSquare className="absolute left-3 top-3 w-3.5 h-3.5 text-white/25" />
                  <textarea
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    placeholder="Tell us how we can help..."
                    rows={5}
                    className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-white/[0.05] border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.07] transition-all resize-none"
                  />
                </div>
                {errors.message && <p className="text-xs text-red-400 mt-1">{errors.message}</p>}
              </div>

              {/* Honeypot field — hidden from real users, bots fill it */}
              <input
                type="text"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
                style={{ position: 'absolute', left: '-9999px', opacity: 0 }}
                aria-hidden="true"
              />

              {status === 'error' && (
                <p className="text-xs text-red-400">Something went wrong. Please try again or email us directly.</p>
              )}

              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full py-2.5 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold text-sm hover:from-blue-400 hover:to-cyan-400 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/20"
              >
                {status === 'loading' ? <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Sending...</span> : 'Send message'}
              </button>

              <p className="text-center text-xs text-white/25">
                By submitting, you agree to our <Link to="/privacy" className="text-cyan-400/70 hover:text-cyan-300 transition-colors">Privacy Policy</Link>.
              </p>
            </form>
          )}

          {/* Clarent link */}
          <div className="mt-12 pt-8 border-t border-white/[0.05]">
            <a
              href="https://clarenttech.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors"
            >
              A Clarent Technologies product
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

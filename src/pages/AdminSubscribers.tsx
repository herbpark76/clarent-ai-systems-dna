import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Mail, Users, Download, Loader2, ArrowLeft,
  Eye, EyeOff, Send, AlertTriangle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import NavBar from '../components/NavBar';
import { setPageMeta } from '../lib/seo';

interface WaitlistRow {
  id: string;
  name: string | null;
  email: string | null;
  learning_interest: string | null;
  created_at: string;
  unsubscribed_at: string | null;
}

interface ContactRow {
  id: string;
  name: string;
  email: string;
  company: string | null;
  topic: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

type Tab = 'subscribers' | 'contact' | 'digest';

function formatDate(s: string): string {
  return new Date(s).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map((cell) => `"${(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminSubscribers() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tab, setTab] = useState<Tab>('subscribers');
  const [subscribers, setSubscribers] = useState<WaitlistRow[]>([]);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [digestHtml, setDigestHtml] = useState<string | null>(null);
  const [digestRecipients, setDigestRecipients] = useState(0);
  const [digestLoading, setDigestLoading] = useState(false);
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);

  useEffect(() => {
    setPageMeta({ title: 'Admin — Subscribers & Messages', path: '/admin/subscribers', noindex: true });
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const role = (data.session?.user?.app_metadata as any)?.role;
      setIsAdmin(role === 'admin');
      setAuthChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const role = (session?.user?.app_metadata as any)?.role;
      setIsAdmin(role === 'admin');
      setAuthChecked(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    if (tab === 'subscribers') {
      const { data } = await supabase
        .from('ai_systems_waitlist')
        .select('id, name, email, learning_interest, created_at, unsubscribed_at')
        .order('created_at', { ascending: false });
      setSubscribers((data || []) as WaitlistRow[]);
    } else if (tab === 'contact') {
      const { data } = await supabase
        .from('contact_messages')
        .select('*')
        .order('created_at', { ascending: false });
      setContacts((data || []) as ContactRow[]);
    }
    setLoading(false);
  }, [tab]);

  useEffect(() => {
    if (isAdmin) loadData();
  }, [isAdmin, loadData]);

  const handleToggleRead = async (id: string, isRead: boolean) => {
    await supabase.from('contact_messages').update({ is_read: !isRead }).eq('id', id);
    setContacts((prev) => prev.map((c) => c.id === id ? { ...c, is_read: !isRead } : c));
  };

  const handlePreviewDigest = async () => {
    setDigestLoading(true);
    setSendResult(null);
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/weekly-digest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mode: 'preview' }),
      });
      const result = await resp.json();
      if (result.html !== undefined) {
        setDigestHtml(result.html);
        setDigestRecipients(result.recipient_count || 0);
      } else {
        setSendResult(result.error || 'Failed to generate preview.');
      }
    } catch {
      setSendResult('Failed to connect to digest function.');
    }
    setDigestLoading(false);
  };

  const handleSendDigest = async () => {
    setShowSendConfirm(false);
    setDigestLoading(true);
    setSendResult(null);
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/weekly-digest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mode: 'send' }),
      });
      const result = await resp.json();
      if (result.sent !== undefined) {
        setSendResult(`Sent ${result.sent} of ${result.total} emails${result.failed > 0 ? ` (${result.failed} failed)` : ''}.`);
      } else {
        setSendResult(result.error || 'Failed to send digest.');
      }
    } catch {
      setSendResult('Failed to connect to digest function.');
    }
    setDigestLoading(false);
  };

  const exportSubscribersCsv = () => {
    const rows: string[][] = [
      ['Date', 'Name', 'Email', 'Interest', 'Status'],
      ...subscribers.map((s) => [
        formatDate(s.created_at),
        s.name || '',
        s.email || '',
        s.learning_interest || '',
        s.unsubscribed_at ? 'Unsubscribed' : 'Active',
      ]),
    ];
    downloadCsv('subscribers.csv', rows);
  };

  const exportContactsCsv = () => {
    const rows: string[][] = [
      ['Date', 'Name', 'Email', 'Company', 'Topic', 'Message', 'Read'],
      ...contacts.map((c) => [
        formatDate(c.created_at),
        c.name,
        c.email,
        c.company || '',
        c.topic,
        c.message.replace(/\n/g, ' '),
        c.is_read ? 'Yes' : 'No',
      ]),
    ];
    downloadCsv('contact-messages.csv', rows);
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#080c14] text-white">
        <NavBar />
        <div className="pt-20 flex items-center justify-center"><Loader2 className="w-5 h-5 text-white/30 animate-spin" /></div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#080c14] text-white font-sans antialiased">
        <NavBar />
        <div className="pt-20 max-w-lg mx-auto px-4 text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Admin access required</h1>
          <p className="text-sm text-white/40 mb-6">You need to be signed in as an admin to view this page.</p>
          <Link to="/" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-white text-sm hover:bg-white/[0.08] transition-all">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080c14] text-white font-sans antialiased">
      <NavBar />
      <div className="pt-14 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-24">
        <Link to="/admin/signal-desk" className="inline-flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 mb-6 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Signal Desk Admin
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Subscribers & Messages</h1>
            <p className="text-[11px] text-white/35">Manage signups, contact messages, and weekly digest</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="inline-flex items-center gap-0.5 rounded-lg bg-white/[0.04] border border-white/[0.08] p-0.5 mb-6">
          {([
            { id: 'subscribers' as const, label: 'Subscribers', icon: Users },
            { id: 'contact' as const, label: 'Contact Messages', icon: Mail },
            { id: 'digest' as const, label: 'Weekly Digest', icon: Send },
          ]).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => { setTab(id); setDigestHtml(null); setSendResult(null); }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                tab === id ? 'bg-white/[0.08] text-white' : 'text-white/40 hover:text-white/70'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>

        {loading && tab !== 'digest' ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 text-white/30 animate-spin" /></div>
        ) : tab === 'subscribers' ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs text-white/40">{subscribers.length} total signups · {subscribers.filter((s) => !s.unsubscribed_at).length} active</span>
              <button onClick={exportSubscribersCsv} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.03] text-xs text-white/60 hover:text-white hover:bg-white/[0.06] transition-all">
                <Download className="w-3.5 h-3.5" /> Export CSV
              </button>
            </div>
            {subscribers.length === 0 ? (
              <p className="text-sm text-white/30 text-center py-12">No signups yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wide text-white/35">
                      <th className="text-left px-4 py-2 font-semibold">Date</th>
                      <th className="text-left px-4 py-2 font-semibold">Name</th>
                      <th className="text-left px-4 py-2 font-semibold">Email</th>
                      <th className="text-left px-4 py-2 font-semibold">Interest</th>
                      <th className="text-left px-4 py-2 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscribers.map((s) => (
                      <tr key={s.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-2.5 text-xs text-white/40">{formatDate(s.created_at)}</td>
                        <td className="px-4 py-2.5 text-xs text-white/70">{s.name || '—'}</td>
                        <td className="px-4 py-2.5 text-xs text-white/70">{s.email || '—'}</td>
                        <td className="px-4 py-2.5 text-xs text-white/50">{s.learning_interest || '—'}</td>
                        <td className="px-4 py-2.5">
                          {s.unsubscribed_at ? (
                            <span className="text-[10px] text-white/30">Unsubscribed</span>
                          ) : (
                            <span className="text-[10px] text-emerald-400/70">Active</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : tab === 'contact' ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs text-white/40">{contacts.length} messages · {contacts.filter((c) => !c.is_read).length} unread</span>
              <button onClick={exportContactsCsv} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/[0.03] text-xs text-white/60 hover:text-white hover:bg-white/[0.06] transition-all">
                <Download className="w-3.5 h-3.5" /> Export CSV
              </button>
            </div>
            {contacts.length === 0 ? (
              <p className="text-sm text-white/30 text-center py-12">No contact messages yet.</p>
            ) : (
              <div className="space-y-2">
                {contacts.map((c) => (
                  <div key={c.id} className={`rounded-xl border p-4 transition-all ${c.is_read ? 'border-white/[0.04] bg-white/[0.01]' : 'border-cyan-500/15 bg-cyan-500/[0.03]'}`}>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-white">{c.name}</span>
                          <span className="text-[10px] text-white/30">{formatDate(c.created_at)}</span>
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-white/[0.06] text-white/50">{c.topic}</span>
                        </div>
                        <a href={`mailto:${c.email}`} className="text-xs text-cyan-400/70 hover:text-cyan-300 transition-colors">{c.email}</a>
                        {c.company && <span className="text-xs text-white/40 ml-2">· {c.company}</span>}
                      </div>
                      <button
                        onClick={() => handleToggleRead(c.id, c.is_read)}
                        className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md border border-white/10 text-[10px] text-white/40 hover:text-white/70 hover:bg-white/[0.05] transition-all"
                      >
                        {c.is_read ? <><EyeOff className="w-3 h-3" /> Mark unread</> : <><Eye className="w-3 h-3" /> Mark read</>}
                      </button>
                    </div>
                    <p className="text-sm text-white/55 leading-relaxed">{c.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : tab === 'digest' ? (
          <div>
            <div className="mb-6">
              <h2 className="text-sm font-bold text-white mb-2">Weekly Signal Desk Digest</h2>
              <p className="text-xs text-white/40 leading-relaxed mb-4">
                Preview the digest email (top published Signal Desk entries from the past 7 days), then send it to all active subscribers. Each email includes a personalized unsubscribe link.
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handlePreviewDigest}
                  disabled={digestLoading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-white/10 bg-white/[0.03] text-xs font-semibold text-white/70 hover:text-white hover:bg-white/[0.06] transition-all disabled:opacity-50"
                >
                  {digestLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
                  Preview digest
                </button>
                {digestHtml !== null && (
                  <button
                    onClick={() => setShowSendConfirm(true)}
                    disabled={digestLoading || digestRecipients === 0}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-xs font-semibold hover:from-blue-400 hover:to-cyan-400 transition-all disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" /> Send digest now
                  </button>
                )}
              </div>
              {sendResult && (
                <div className={`mt-4 p-3 rounded-lg text-xs ${sendResult.startsWith('Sent') ? 'border border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-300' : 'border border-red-500/20 bg-red-500/[0.07] text-red-300'}`}>
                  {sendResult}
                </div>
              )}
            </div>

            {digestHtml !== null && (
              <div>
                <div className="text-[10px] text-white/30 uppercase tracking-wide mb-2">
                  Preview · {digestRecipients} recipient{digestRecipients !== 1 ? 's' : ''}
                </div>
                <div className="rounded-xl border border-white/[0.08] overflow-hidden max-h-[600px] overflow-y-auto">
                  <div dangerouslySetInnerHTML={{ __html: digestHtml }} />
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Send confirmation dialog */}
      {showSendConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="max-w-md w-full rounded-2xl border border-white/10 bg-[#0c1118] p-6 shadow-2xl">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <h3 className="text-sm font-bold text-white">Send digest to all subscribers?</h3>
            </div>
            <p className="text-sm text-white/50 leading-relaxed mb-6">
              This will email the weekly digest to <span className="text-white font-semibold">{digestRecipients}</span> active subscriber{digestRecipients !== 1 ? 's' : ''}. Each email includes a personalized unsubscribe link. This cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => setShowSendConfirm(false)} className="px-4 py-2 rounded-lg border border-white/10 text-xs text-white/50 hover:text-white hover:bg-white/[0.05] transition-all">
                Cancel
              </button>
              <button onClick={handleSendDigest} className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-xs font-semibold hover:from-blue-400 hover:to-cyan-400 transition-all">
                Send to {digestRecipients} subscriber{digestRecipients !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

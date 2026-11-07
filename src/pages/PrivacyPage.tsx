import { useEffect } from 'react';
import { Shield } from 'lucide-react';
import NavBar from '../components/NavBar';
import { setPageMeta } from '../lib/seo';

export default function PrivacyPage() {
  useEffect(() => {
    setPageMeta({
      title: 'Privacy Policy — AI Systems DNA',
      description: 'What data we collect, why we collect it, and how to unsubscribe or request deletion.',
      path: '/privacy',
    });
  }, []);

  return (
    <div className="min-h-screen bg-[#080c14] text-white font-sans antialiased">
      <NavBar />
      <div className="pt-14">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-24">
          <div className="inline-flex items-center gap-2 mb-3 px-3 py-1 rounded-full border border-white/10 bg-white/[0.04] text-xs text-white/45">
            <Shield className="w-3 h-3" />
            Privacy
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight mb-2">Privacy Policy</h1>
          <p className="text-xs text-white/30 mb-10">Last updated: November 7, 2026</p>

          <div className="space-y-8 text-sm text-white/55 leading-relaxed">
            <section>
              <h2 className="text-base font-bold text-white mb-3">What we collect</h2>
              <ul className="space-y-2 list-disc list-outside pl-5">
                <li><span className="text-white/70">Newsletter signups:</span> your name, email, and selected learning interest when you click "Get Updates."</li>
                <li><span className="text-white/70">Contact form messages:</span> your name, email, company (optional), topic, and message when you reach out through our contact page.</li>
                <li><span className="text-white/70">Learner portal data:</span> for invited trainees only — progress, journal entries, quiz attempts, and submitted work. This data is visible to you and to your assigned admin.</li>
                <li><span className="text-white/70">Privacy-friendly page analytics:</span> we use Vercel Web Analytics, which collects aggregate, anonymous page-view data. It does not use cookies or track individuals.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-bold text-white mb-3">Why we collect it</h2>
              <ul className="space-y-2 list-disc list-outside pl-5">
                <li>To send you updates about new content and features when you sign up.</li>
                <li>To respond to your inquiries when you contact us.</li>
                <li>To track learning progress and provide coaching for invited trainees.</li>
                <li>To understand which pages are popular so we can improve the site.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-base font-bold text-white mb-3">We don't sell your data</h2>
              <p>We do not sell, rent, or share your personal data with third parties for marketing purposes. Your information is used only to operate this site and communicate with you about things you signed up for.</p>
            </section>

            <section>
              <h2 className="text-base font-bold text-white mb-3">How to unsubscribe</h2>
              <p>Every update email we send includes an unsubscribe link. You can also unsubscribe at any time by clicking the link in any digest email, or by contacting us through our <a href="/contact" className="text-cyan-400 hover:text-cyan-300 transition-colors">contact page</a> and asking to be removed.</p>
            </section>

            <section>
              <h2 className="text-base font-bold text-white mb-3">How to request deletion</h2>
              <p>If you'd like us to delete your data — your signup, contact messages, or learner portal records — just reach out through our <a href="/contact" className="text-cyan-400 hover:text-cyan-300 transition-colors">contact page</a> and let us know. We'll remove your information within a reasonable timeframe.</p>
            </section>

            <section>
              <h2 className="text-base font-bold text-white mb-3">Contact</h2>
              <p>Questions about this policy? Use our <a href="/contact" className="text-cyan-400 hover:text-cyan-300 transition-colors">contact page</a> and select "Other" as the topic.</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

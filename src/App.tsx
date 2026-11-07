import { lazy, Suspense, type ComponentType } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import HomePage from './pages/HomePage';
import ErrorBoundary from './components/ErrorBoundary';
import { Loader2 } from 'lucide-react';

function lazyRetry<T extends { default: ComponentType<Record<string, unknown>> }>(
  factory: () => Promise<T>,
): ReturnType<typeof lazy<T>> {
  return lazy(() =>
    factory().catch((err) => {
      const KEY = '__vite_retry_ts';
      const stored = sessionStorage.getItem(KEY);
      const now = Date.now();
      if (!stored || now - parseInt(stored, 10) > 10_000) {
        sessionStorage.setItem(KEY, String(now));
        window.location.reload();
      }
      throw err;
    }),
  );
}

const ArticlePage = lazyRetry(() => import('./components/ArticlePage'));
const ConceptPage = lazyRetry(() => import('./components/ConceptPage'));
const AdminSignalDesk = lazyRetry(() => import('./pages/AdminSignalDesk'));
const AdminSubscribers = lazyRetry(() => import('./pages/AdminSubscribers'));
const SignalDeskPage = lazyRetry(() => import('./pages/SignalDeskPage'));
const EntryDetailPage = lazyRetry(() => import('./pages/EntryDetailPage'));
const LabsPage = lazyRetry(() => import('./pages/LabsPage'));
const UseCasesPage = lazyRetry(() => import('./pages/UseCasesPage'));
const ModelsPage = lazyRetry(() => import('./pages/ModelsPage'));
const RiskPage = lazyRetry(() => import('./pages/RiskPage'));
const NotFoundPage = lazyRetry(() => import('./pages/NotFoundPage'));
const LearnPortal = lazyRetry(() => import('./pages/LearnPortal'));
const ContactPage = lazyRetry(() => import('./pages/ContactPage'));
const PrivacyPage = lazyRetry(() => import('./pages/PrivacyPage'));
const UnsubscribePage = lazyRetry(() => import('./pages/UnsubscribePage'));

function PageLoader() {
  return (
    <div className="min-h-screen bg-[#080c14] flex items-center justify-center">
      <Loader2 className="w-6 h-6 text-white/30 animate-spin" />
    </div>
  );
}

const withBoundary = (el: React.ReactNode) => (
  <ErrorBoundary>
    <Suspense fallback={<PageLoader />}>{el}</Suspense>
  </ErrorBoundary>
);

const withSuspense = (el: React.ReactNode) => (
  <Suspense fallback={<PageLoader />}>{el}</Suspense>
);

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/articles/:slug" element={withSuspense(<ArticlePage />)} />
        <Route path="/concepts/:slug" element={withSuspense(<ConceptPage />)} />
        <Route path="/admin/signal-desk" element={withSuspense(<AdminSignalDesk />)} />
        <Route path="/admin/subscribers" element={withSuspense(<AdminSubscribers />)} />
        <Route path="/signal-desk" element={withSuspense(<SignalDeskPage />)} />
        <Route path="/signal-desk/:slug" element={withSuspense(<EntryDetailPage />)} />
        <Route path="/labs" element={withSuspense(<LabsPage />)} />
        <Route path="/use-cases" element={withSuspense(<UseCasesPage />)} />
        <Route path="/models" element={withSuspense(<ModelsPage />)} />
        <Route path="/risk" element={withSuspense(<RiskPage />)} />
        <Route path="/learn" element={withBoundary(<LearnPortal />)} />
        <Route path="/contact" element={withSuspense(<ContactPage />)} />
        <Route path="/privacy" element={withSuspense(<PrivacyPage />)} />
        <Route path="/unsubscribe" element={withSuspense(<UnsubscribePage />)} />
        <Route path="*" element={withSuspense(<NotFoundPage />)} />
      </Routes>
      <Analytics />
    </BrowserRouter>
  );
}

import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import HomePage from './pages/HomePage';
import ErrorBoundary from './components/ErrorBoundary';
import { Loader2 } from 'lucide-react';

const ArticlePage = lazy(() => import('./components/ArticlePage'));
const ConceptPage = lazy(() => import('./components/ConceptPage'));
const AdminSignalDesk = lazy(() => import('./pages/AdminSignalDesk'));
const AdminSubscribers = lazy(() => import('./pages/AdminSubscribers'));
const SignalDeskPage = lazy(() => import('./pages/SignalDeskPage'));
const EntryDetailPage = lazy(() => import('./pages/EntryDetailPage'));
const LabsPage = lazy(() => import('./pages/LabsPage'));
const UseCasesPage = lazy(() => import('./pages/UseCasesPage'));
const ModelsPage = lazy(() => import('./pages/ModelsPage'));
const RiskPage = lazy(() => import('./pages/RiskPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const LearnPortal = lazy(() => import('./pages/LearnPortal'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const UnsubscribePage = lazy(() => import('./pages/UnsubscribePage'));

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

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import HomePage from './pages/HomePage';
import ArticlePage from './components/ArticlePage';
import ConceptPage from './components/ConceptPage';
import AdminSignalDesk from './pages/AdminSignalDesk';
import AdminSubscribers from './pages/AdminSubscribers';
import SignalDeskPage from './pages/SignalDeskPage';
import EntryDetailPage from './pages/EntryDetailPage';
import LabsPage from './pages/LabsPage';
import UseCasesPage from './pages/UseCasesPage';
import ModelsPage from './pages/ModelsPage';
import RiskPage from './pages/RiskPage';
import NotFoundPage from './pages/NotFoundPage';
import LearnPortal from './pages/LearnPortal';
import ContactPage from './pages/ContactPage';
import PrivacyPage from './pages/PrivacyPage';
import UnsubscribePage from './pages/UnsubscribePage';
import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/articles/:slug" element={<ArticlePage />} />
        <Route path="/concepts/:slug" element={<ConceptPage />} />
        <Route path="/admin/signal-desk" element={<AdminSignalDesk />} />
        <Route path="/admin/subscribers" element={<AdminSubscribers />} />
        <Route path="/signal-desk" element={<SignalDeskPage />} />
        <Route path="/signal-desk/:slug" element={<EntryDetailPage />} />
        <Route path="/labs" element={<LabsPage />} />
        <Route path="/use-cases" element={<UseCasesPage />} />
        <Route path="/models" element={<ModelsPage />} />
        <Route path="/risk" element={<RiskPage />} />
        <Route path="/learn" element={<ErrorBoundary><LearnPortal /></ErrorBoundary>} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/unsubscribe" element={<UnsubscribePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <Analytics />
    </BrowserRouter>
  );
}

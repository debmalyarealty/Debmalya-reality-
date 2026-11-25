import React, { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { AuthModal } from './components/AuthModal';
import { FirstVisitSignInPrompt } from './components/FirstVisitSignInPrompt';
import { DashboardCoachmark } from './components/DashboardCoachmark';
import { MobileFloatingActions } from './components/MobileFloatingActions';
import { HomePage } from './pages/HomePage';
import { PropertiesPage } from './pages/PropertiesPage';
import { PropertyDetailPage } from './pages/PropertyDetailPage';
import { CustomerDashboardPage } from './pages/CustomerDashboardPage';
import { OwnerAuthPage } from './pages/OwnerAuthPage';
import { OwnerDashboardPage } from './pages/OwnerDashboardPage';
import { LegalPage } from './pages/LegalPage';

import { recordNavigationEntry } from './lib/motion';

const ScrollToTop: React.FC = () => {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0);
      return;
    }
    const targetId = hash.slice(1);
    const timer = window.setTimeout(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth' });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [pathname, hash]);
  return null;
};

const RouteHistoryTracker: React.FC = () => {
  const { pathname, search } = useLocation();
  useEffect(() => {
    recordNavigationEntry(`${pathname}${search}`);
  }, [pathname, search]);
  return null;
};

const OwnerRouteRedirect: React.FC = () => {
  const { user, authLoading, ownerViewingWebsite } = useApp();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading || user?.role !== 'owner' || ownerViewingWebsite) return;
    const isOwnerArea =
      pathname.startsWith('/owner-dashboard') ||
      pathname.startsWith('/owner-login');
    if (!isOwnerArea) {
      navigate('/owner-dashboard', { replace: true });
    }
  }, [authLoading, user, ownerViewingWebsite, pathname, navigate]);

  return null;
};

const AuthRedirectObserver: React.FC = () => {
  const { pendingAuthRedirect, clearPendingAuthRedirect } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    if (!pendingAuthRedirect) return;
    const target = pendingAuthRedirect;
    clearPendingAuthRedirect();
    navigate(target, { replace: true });
  }, [pendingAuthRedirect, clearPendingAuthRedirect, navigate]);

  return null;
};

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <ScrollToTop />
        <RouteHistoryTracker />
        <OwnerRouteRedirect />
        <AuthRedirectObserver />
        <div className="min-h-screen flex flex-col bg-[var(--bg-canvas)] text-[var(--text-primary)]">
          <Navbar />
          <div className="flex-1">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/properties" element={<PropertiesPage />} />
              <Route path="/properties/:slug" element={<PropertyDetailPage />} />
              <Route path="/my-account" element={<CustomerDashboardPage />} />
              <Route path="/owner-login" element={<OwnerAuthPage />} />
              <Route path="/owner-dashboard" element={<OwnerDashboardPage />} />
              <Route path="/owner-login/dashboard" element={<OwnerDashboardPage />} />
              <Route path="/privacy-policy" element={<LegalPage type="privacy" />} />
              <Route path="/terms" element={<LegalPage type="terms" />} />
              <Route path="/disclaimer" element={<LegalPage type="disclaimer" />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
          <Footer />
          <MobileFloatingActions />
          <FirstVisitSignInPrompt />
          <DashboardCoachmark />
          <AuthModal />
        </div>
      </BrowserRouter>
    </AppProvider>
  );
}

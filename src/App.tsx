import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { NavigationTabs } from './components/NavigationTabs';
import { Dashboard } from './pages/Dashboard';
import { InspectionsList } from './pages/InspectionsList';
import { InspectionForm } from './pages/InspectionForm';
import { InspectionDetail } from './pages/InspectionDetail';
import { Condominiums } from './pages/Condominiums';
import { Templates } from './pages/Templates';
import { UsersPage } from './pages/UsersPage';
import { CompaniesPage } from './pages/CompaniesPage';
import { LoginPage } from './pages/LoginPage';
import { DevDashboard } from './pages/DevDashboard';
import { PwaInstallBanner } from './components/PwaInstallPrompt';
import { SplashScreen } from './components/SplashScreen';

function MainAppShell() {
  const { user } = useAuth();
  const [isServerReady, setIsServerReady] = useState<boolean>(() => {
    try {
      const warmedAt = sessionStorage.getItem('cast_server_warmed_at');
      if (warmedAt) {
        const diff = Date.now() - parseInt(warmedAt, 10);
        // Se verificado nos últimos 4 minutos, servidor continua aquecido
        if (diff < 4 * 60 * 1000) {
          return true;
        }
      }
    } catch {
      // ignore
    }
    return false;
  });

  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [currentParam, setCurrentParam] = useState<string | undefined>(undefined);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  const navigate = (view: string, param?: string) => {
    setCurrentView(view);
    setCurrentParam(param);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRefreshData = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  // Aguarda inicialização dos serviços antes de exibir a interface
  if (!isServerReady) {
    return (
      <SplashScreen
        minDurationMs={800}
        onReady={() => setIsServerReady(true)}
      />
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen w-full max-w-full flex flex-col bg-slate-100 font-sans text-slate-900 antialiased selection:bg-blue-600 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        currentView={currentView}
        onNavigate={navigate}
        onRefreshData={handleRefreshData}
      />

      {/* Navigation Sub-Tabs */}
      <NavigationTabs currentView={currentView} onNavigate={navigate} />

      {/* Main Viewport Container */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 pt-4 sm:pt-6 pb-20">
        {user.role === 'DEV' ? (
          <DevDashboard key={refreshTrigger} />
        ) : (
          <>
            {currentView === 'dashboard' && (
              <Dashboard key={refreshTrigger} onNavigate={navigate} />
            )}

            {currentView === 'inspections' && (
              <InspectionsList
                key={refreshTrigger}
                onNavigate={navigate}
                initialCondominiumId={currentParam || undefined}
              />
            )}

            {currentView === 'new-inspection' && (
              <InspectionForm
                key={`new-insp-${currentParam || 'none'}-${refreshTrigger}`}
                initialCondominiumId={currentParam || undefined}
                onNavigate={navigate}
                onSaved={handleRefreshData}
              />
            )}

            {currentView === 'edit-inspection' && (
              <InspectionForm
                inspectionIdToEdit={currentParam}
                onNavigate={navigate}
                onSaved={handleRefreshData}
              />
            )}

            {currentView === 'inspection-detail' && currentParam && (
              <InspectionDetail
                inspectionId={currentParam}
                onNavigate={navigate}
              />
            )}

            {currentView === 'condominiums' && (
              <Condominiums onNavigate={navigate} />
            )}

            {currentView === 'templates' && (
              <Templates onNavigate={navigate} />
            )}

            {currentView === 'users' && <UsersPage />}

            {currentView === 'companies' && <CompaniesPage />}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto py-4 text-center text-xs text-slate-400 border-t border-slate-200 bg-white w-full max-w-full overflow-hidden">
        <div className="max-w-7xl w-full mx-auto px-4 flex items-center justify-between text-slate-500">
          <span className="font-semibold text-slate-700">CAST Inspect</span>
          <span className="text-[11px] text-slate-400">Vistorias Técnicas Periódicas</span>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainAppShell />
      <PwaInstallBanner />
    </AuthProvider>
  );
}

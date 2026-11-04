import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppNav } from './components/AppNav';
import Home from './pages/Home';
import Near from './pages/Near';
import AuthPage from './pages/Auth';
import { refreshMe } from './api';
import { useGuest, useSession } from './session';
import IncidentDetail from './pages/IncidentDetail';
import MapPage from './pages/MapPage';
import Settings from './pages/Settings';
import Report from './pages/Report';
import { ThemeProvider } from './context/ThemeContext';
import NotFound from './pages/NotFound';
import Privacy from './pages/Privacy';
import { Terms } from './pages/Legal';
import AdminLogin from './admin/AdminLogin';
import AdminLayout from './admin/AdminLayout';
import Dashboard from './admin/pages/Dashboard';
import Incidents from './admin/pages/Incidents';
import Reports from './admin/pages/Reports';
import Blocked from './admin/pages/Blocked';
import Sources from './admin/pages/Sources';
import Profile from './admin/pages/Profile';
import './index.css';

// Prije ulaska u aplikaciju: prijava, registracija ili "Nastavi bez računa"
function Entry({ children }: { children: ReactNode }) {
  const session = useSession();
  const guest = useGuest();
  const { pathname, search } = useLocation();
  if (session || guest) return <>{children}</>;
  const next = pathname + search;
  return <Navigate to={next === '/' ? '/prijava' : `/prijava?next=${encodeURIComponent(next)}`} replace />;
}

export default function App() {
  // Sačuvana sesija se provjeri jednom pri otvaranju (istekla se briše)
  useEffect(() => { refreshMe(); }, []);

  return (
    <ThemeProvider>
    <div style={{ minHeight: '100vh' }}>
      <BrowserRouter>
        <AppNav />
        <Routes>
          <Route path="/prijava"               element={<AuthPage mode="login" />} />
          <Route path="/registracija"          element={<AuthPage mode="register" />} />
          <Route path="/zaboravljena-lozinka"  element={<AuthPage mode="forgot" />} />
          <Route path="/nova-lozinka"          element={<AuthPage mode="reset" />} />
          <Route path="/"              element={<Entry><Near /></Entry>} />
          <Route path="/prekidi"       element={<Entry><Home /></Entry>} />
          <Route path="/incidents/:id" element={<Entry><IncidentDetail /></Entry>} />
          <Route path="/map"           element={<Entry><MapPage /></Entry>} />
          <Route path="/report"        element={<Entry><Report /></Entry>} />
          <Route path="/settings"      element={<Entry><Settings /></Entry>} />
          <Route path="/uslovi"        element={<Terms />} />
          <Route path="/privatnost"    element={<Privacy />} />
          <Route path="/admin/login"   element={<AdminLogin />} />
          <Route path="/admin"         element={<AdminLayout />}>
            <Route index              element={<Dashboard />} />
            <Route path="prekidi"     element={<Incidents />} />
            <Route path="prijave"     element={<Reports />} />
            <Route path="blokirani"   element={<Blocked />} />
            <Route path="izvori"      element={<Sources />} />
            <Route path="profil"      element={<Profile />} />
          </Route>
          <Route path="*"              element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </div>
    </ThemeProvider>
  );
}

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { BottomNav } from './components/BottomNav';
import Home from './pages/Home';
import IncidentDetail from './pages/IncidentDetail';
import MapPage from './pages/MapPage';
import Settings from './pages/Settings';
import Report from './pages/Report';
import { ThemeProvider } from './context/ThemeContext';
import NotFound from './pages/NotFound';
import AdminLogin from './admin/AdminLogin';
import AdminLayout from './admin/AdminLayout';
import Dashboard from './admin/pages/Dashboard';
import Incidents from './admin/pages/Incidents';
import Reports from './admin/pages/Reports';
import Blocked from './admin/pages/Blocked';
import Sources from './admin/pages/Sources';
import Profile from './admin/pages/Profile';
import './index.css';

export default function App() {
  return (
    <ThemeProvider>
    <div style={{ minHeight: '100vh' }}>
      <BrowserRouter>
        <Routes>
          <Route path="/"              element={<><Home />       <BottomNav /></>} />
          <Route path="/incidents/:id" element={<IncidentDetail />} />
          <Route path="/map"           element={<><MapPage />    <BottomNav /></>} />
          <Route path="/report"        element={<Report />} />
          <Route path="/settings"      element={<><Settings />   <BottomNav /></>} />
          <Route path="/admin/login"   element={<AdminLogin />} />
          <Route path="/admin"         element={<AdminLayout />}>
            <Route index              element={<Dashboard />} />
            <Route path="prekidi"     element={<Incidents />} />
            <Route path="prijave"     element={<Reports />} />
            <Route path="blokirani"   element={<Blocked />} />
            <Route path="izvori"      element={<Sources />} />
            <Route path="profil"      element={<Profile />} />
          </Route>
          <Route path="*"              element={<><NotFound />   <BottomNav /></>} />
        </Routes>
      </BrowserRouter>
    </div>
    </ThemeProvider>
  );
}

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppNav } from './components/AppNav';
import Home from './pages/Home';
import IncidentDetail from './pages/IncidentDetail';
import MapPage from './pages/MapPage';
import Settings from './pages/Settings';
import Report from './pages/Report';
import { ThemeProvider } from './context/ThemeContext';
import NotFound from './pages/NotFound';
import Privacy from './pages/Privacy';
import AdminLogin from './admin/AdminLogin';
import AdminLayout from './admin/AdminLayout';
import { ADMIN_NAV } from './admin/nav';
import AdminPage from './admin/AdminPage';
import './index.css';

export default function App() {
  return (
    <ThemeProvider>
    <div style={{ minHeight: '100vh' }}>
      <BrowserRouter>
        <AppNav />
        <Routes>
          <Route path="/"              element={<Home />} />
          <Route path="/incidents/:id" element={<IncidentDetail />} />
          <Route path="/map"           element={<MapPage />} />
          <Route path="/report"        element={<Report />} />
          <Route path="/settings"      element={<Settings />} />
          <Route path="/privatnost"    element={<Privacy />} />
          <Route path="/admin/login"   element={<AdminLogin />} />
          <Route path="/admin"         element={<AdminLayout />}>
            {ADMIN_NAV.map(item => item.path
              ? <Route key={item.path} path={item.path} element={<AdminPage title={item.label} />} />
              : <Route key="index" index element={<AdminPage title={item.label} />} />)}
          </Route>
          <Route path="*"              element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </div>
    </ThemeProvider>
  );
}

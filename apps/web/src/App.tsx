import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { BottomNav } from './components/BottomNav';
import Home from './pages/Home';
import IncidentDetail from './pages/IncidentDetail';
import MapPage from './pages/MapPage';
import Settings from './pages/Settings';
import Report from './pages/Report';
import { ThemeProvider } from './context/ThemeContext';
import NotFound from './pages/NotFound';
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
          <Route path="*"              element={<><NotFound />   <BottomNav /></>} />
        </Routes>
      </BrowserRouter>
    </div>
    </ThemeProvider>
  );
}

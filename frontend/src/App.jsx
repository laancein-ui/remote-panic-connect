import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import ChatModeSelect from './components/ChatModeSelect';
import GlobalChat from './components/GlobalChat';
import LocalChat from './components/LocalChat';
import WiFiShare from './components/WiFiShare';
import './index.css';

const ProtectedRoute = ({ children }) => {
  const isAuthenticated = !!localStorage.getItem('token');
  return isAuthenticated ? children : <Navigate to="/" />;
};

function App() {
  return (
    <Router>
      <div className="app-container">
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/modes" element={<ProtectedRoute><ChatModeSelect /></ProtectedRoute>} />
          <Route path="/global" element={<ProtectedRoute><GlobalChat /></ProtectedRoute>} />
          <Route path="/local" element={<ProtectedRoute><LocalChat /></ProtectedRoute>} />
          <Route path="/wifishare" element={<ProtectedRoute><WiFiShare /></ProtectedRoute>} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

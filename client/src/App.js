import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import axios from 'axios';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Members from './pages/Members';
import Inventory from './pages/Inventory';
import Production from './pages/Production';
import Finance from './pages/Finance';
import Sales from './pages/Sales';

axios.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

const Sidebar = ({ user, onLogout, isOpen, toggleSidebar }) => {
  const location = useLocation();
  const role = user?.role; 

  const handleLinkClick = () => {
      if (window.innerWidth <= 768) toggleSidebar();
  };

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={toggleSidebar}></div>}
      
      <div className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="logo" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px' }}>
            <h3 style={{ margin: 0, fontSize: '20px', color: '#00a8ff' }}>🌱 EASY CO-OP</h3>
            <button className="close-btn-mobile" onClick={toggleSidebar}>✕</button>
        </div>
        <div className="menu">
          <Link onClick={handleLinkClick} to="/" className={location.pathname === '/' ? 'active' : ''}>👤 Thông tin cá nhân</Link>
          {(role === 'Giám đốc' || role === 'Kế toán') && <Link onClick={handleLinkClick} to="/dashboard" className={location.pathname === '/dashboard' ? 'active' : ''}>📊 Tổng Quan</Link>}
          {(role === 'Giám đốc') && <Link onClick={handleLinkClick} to="/members" className={location.pathname === '/members' ? 'active' : ''}>👥 Quản lý Thành viên</Link>}
          {['Giám đốc', 'Thủ kho', 'Kế toán'].includes(role) && <Link onClick={handleLinkClick} to="/inventory" className={location.pathname === '/inventory' ? 'active' : ''}>📦 Kho vật tư</Link>}
          <Link onClick={handleLinkClick} to="/production" className={location.pathname === '/production' ? 'active' : ''}>🌾 Nhật ký canh tác</Link>
          {['Giám đốc', 'Kế toán'].includes(role) && (
              <>
                  <Link onClick={handleLinkClick} to="/finance" className={location.pathname === '/finance' ? 'active' : ''}>💰 Sổ Quỹ Thu Chi</Link>
                  <Link onClick={handleLinkClick} to="/sales" className={location.pathname === '/sales' ? 'active' : ''}>🛒 Quản lý Bán hàng</Link>
              </>
          )}
        </div>
        <div style={{ marginTop: 'auto', borderTop: '1px solid #2c3e50', padding: '15px', textAlign: 'center' }}>
          <div style={{fontSize: '15px', color: '#bdc3c7', marginBottom: '12px', fontWeight: 'bold'}}>
            {user?.fullName} <br/> <span style={{color: '#f39c12', fontSize: '12px'}}>({role})</span>
          </div>
          <button onClick={onLogout} style={{ width: '100%', padding: '12px', background: '#e74c3c', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold', borderRadius: '4px' }}>🚪 Đăng Xuất</button>
        </div>
      </div>
    </>
  );
};

const ProtectedRoute = ({ children, allowedRoles }) => {
    const user = JSON.parse(localStorage.getItem('user')) || {};
    if (!allowedRoles.includes(user.role)) return <Navigate to="/" replace />;
    return children;
};

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // ==========================================
  // ĐÃ SỬA: LẮNG NGHE SỰ KIỆN CẬP NHẬT USER
  // ==========================================
  useEffect(() => {
    const loadUser = () => {
      const savedUser = localStorage.getItem('user');
      if (savedUser) setCurrentUser(JSON.parse(savedUser));
    };

    loadUser(); // Chạy lần đầu khi mở app

    // Bật radar lắng nghe tín hiệu 'userUpdated' từ các trang khác bắn sang
    window.addEventListener('userUpdated', loadUser);
    
    return () => window.removeEventListener('userUpdated', loadUser);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setCurrentUser(null);
  };

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  if (!currentUser) return <Auth onLoginSuccess={setCurrentUser} />;

  return (
    <Router>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; overflow: hidden; }
        .app-container { display: flex; height: 100vh; background-color: #f0f2f5; font-family: Arial, sans-serif; position: relative; }
        
        .sidebar { width: 240px; background-color: #1a252f; color: white; display: flex; flex-direction: column; flex-shrink: 0; box-shadow: 2px 0 5px rgba(0,0,0,0.1); z-index: 100; transition: transform 0.3s ease; }
        .logo { border-bottom: 1px solid #2c3e50; }
        .menu { display: flex; flex-direction: column; margin-top: 10px; overflow-y: auto; }
        .menu a { color: #bdc3c7; text-decoration: none; font-size: 15px; padding: 15px 20px; transition: 0.2s; border-left: 4px solid transparent; }
        .menu a.active, .menu a:hover { color: white; background-color: #2980b9; border-left: 4px solid #00a8ff; }
        .main-content { flex: 1; display: flex; flex-direction: column; overflow: hidden; width: 100%; } 
        
        .mobile-topbar { display: none; }
        .close-btn-mobile { display: none; }
        .sidebar-overlay { display: none; }

        @media (max-width: 768px) {
            .mobile-topbar {
                display: flex; align-items: center; gap: 15px;
                position: fixed; top: 0; left: 0; width: 100%;
                background: #1a252f; color: white; padding: 12px 20px;
                z-index: 90; box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            }
            .mobile-toggle-btn { background: none; border: none; color: white; font-size: 24px; cursor: pointer; padding: 0; }
            .main-content { padding-top: 55px; } 
            
            .sidebar { position: fixed; left: 0; top: 0; height: 100vh; transform: translateX(-100%); }
            .sidebar.open { transform: translateX(0); }
            .close-btn-mobile { display: block; background: none; border: none; color: white; font-size: 20px; cursor: pointer; }
            .sidebar-overlay { display: block; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 99; }
        }
      `}</style>
      
      <div className="app-container">
        <div className="mobile-topbar">
            <button className="mobile-toggle-btn" onClick={toggleSidebar}>☰</button>
            <span style={{fontWeight: 'bold', color: '#00a8ff', fontSize: '18px'}}>🌱 EASY CO-OP</span>
        </div>
        
        <Sidebar user={currentUser} onLogout={handleLogout} isOpen={isSidebarOpen} toggleSidebar={toggleSidebar} />
        
        <div className="main-content">
          <Routes>
            <Route path="/" element={<Members />} /> 
            <Route path="/production" element={<Production />} />
            <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['Giám đốc', 'Kế toán']}><Dashboard /></ProtectedRoute>} />
            <Route path="/members" element={<ProtectedRoute allowedRoles={['Giám đốc']}><Members /></ProtectedRoute>} />
            <Route path="/inventory" element={<ProtectedRoute allowedRoles={['Giám đốc', 'Thủ kho', 'Kế toán']}><Inventory /></ProtectedRoute>} />
            <Route path="/finance" element={<ProtectedRoute allowedRoles={['Giám đốc', 'Kế toán']}><Finance /></ProtectedRoute>} />
            <Route path="/sales" element={<ProtectedRoute allowedRoles={['Giám đốc', 'Kế toán']}><Sales /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
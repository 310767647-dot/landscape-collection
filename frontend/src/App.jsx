import React from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import HomePage from './pages/HomePage'
import AddMaterialPage from './pages/AddMaterialPage'
import MaterialListPage from './pages/MaterialListPage'
import MaterialDetailPage from './pages/MaterialDetailPage'
import ExportPage from './pages/ExportPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import AdminPage from './pages/AdminPage'
import LoginDebugPage from './pages/LoginDebugPage'
import ChangePasswordPage from './pages/ChangePasswordPage'

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading, user, token } = useAuth()

  console.log('=== ProtectedRoute ===')
  console.log('loading:', loading)
  console.log('isAuthenticated:', isAuthenticated)
  console.log('user:', user)
  console.log('token:', !!token)

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="loading-spinner" />
      </div>
    )
  }

  if (!isAuthenticated) {
    console.log('ProtectedRoute: 未认证，重定向到/login')
    return <Navigate to="/login" replace />
  }

  return children
}

const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="loading-spinner" />
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return children
}

const AdminRoute = ({ children }) => {
  const { isAuthenticated, user, loading } = useAuth()

  console.log('=== AdminRoute ===')
  console.log('loading:', loading)
  console.log('isAuthenticated:', isAuthenticated)
  console.log('user:', user)
  console.log('user?.role:', user?.role)
  console.log('(user?.role || "user"):', (user?.role || 'user'))
  console.log('是否为admin:', (user?.role || 'user') === 'admin')

  if (loading) {
    console.log('AdminRoute: 加载中')
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontSize: 20 }}>
        <div>加载中...<br/>loading: {loading}</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    console.log('AdminRoute: 未登录，重定向到/login')
    return <Navigate to="/login" replace />
  }

  if ((user?.role || 'user') !== 'admin') {
    console.log('AdminRoute: 不是admin，重定向到/')
    return <Navigate to="/" replace />
  }

  console.log('AdminRoute: 允许访问')
  return children
}

function AppRoutes() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout, pendingCount } = useAuth()

  const navItems = [
    { path: '/', icon: '🏠', label: '首页' },
    { path: '/add', icon: '➕', label: '录入材料' },
    { path: '/list', icon: '📋', label: '材料列表' },
    { path: '/export', icon: '📤', label: '导出数据' },
  ]
  if (user?.role === 'admin') {
    navItems.push({ path: '/admin', icon: '🛠', label: '后台管理' })
  }

  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768
  const [desktop, setDesktop] = React.useState(isDesktop)

  React.useEffect(() => {
    const handleResize = () => setDesktop(window.innerWidth >= 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const DesktopNav = () => (
    <div className="desktop-nav">
      <div className="nav-header">
        <h2>🌿 数据采集</h2>
        <p>市政景观材料管理</p>
      </div>
      <div className="nav-user">
        👤 {user?.display_name || user?.username}
      </div>
      {navItems.map(item => (
        <a
          key={item.path}
          className={location.pathname === item.path ? 'active' : ''}
          onClick={() => navigate(item.path)}
        >
          <span>{item.icon}</span>
          <span>{item.label}</span>
          {item.path === '/list' && pendingCount > 0 && (
            <span style={{ marginLeft: 'auto', background: '#ff4d4f', color: 'white', borderRadius: 10, padding: '0 6px', fontSize: 11 }}>{pendingCount}</span>
          )}
        </a>
      ))}
      <div className="nav-spacer" />
      <a onClick={() => navigate('/change-password')}>
        <span>🔑</span><span>修改密码</span>
      </a>
      <a className="nav-logout" onClick={() => { logout(); navigate('/login') }}>
        <span>🚪</span><span>退出登录</span>
      </a>
    </div>
  )
  return (
    <>
      {desktop && user && <DesktopNav />}
      <Routes>
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/login-debug" element={<LoginDebugPage />} />
        <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/add"
          element={
            <ProtectedRoute>
              <AddMaterialPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/list"
          element={
            <ProtectedRoute>
              <MaterialListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/detail/:id"
          element={
            <ProtectedRoute>
              <MaterialDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/export"
          element={
            <ProtectedRoute>
              <ExportPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminPage />
            </AdminRoute>
          }
        />
        <Route
          path="/change-password"
          element={
            <ProtectedRoute>
              <ChangePasswordPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

function App() {
  return (
    <AuthProvider>
      <div className="app-container">
        <div className="mobile-container">
          <AppRoutes />
        </div>
      </div>
    </AuthProvider>
  )
}

export default App
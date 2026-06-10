import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
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
  return (
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
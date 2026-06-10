import React, { createContext, useContext, useState, useEffect } from 'react'
import { getSetting, setSetting } from '../utils/db'
import { performSync, getPendingCount, setupNetworkListener } from '../utils/sync'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncResult, setSyncResult] = useState(null)

  useEffect(() => {
    loadStoredAuth()
    
    // 设置网络恢复监听
    const cleanup = setupNetworkListener((result) => {
      if (result.synced > 0) {
        setSyncResult(result)
        refreshPendingCount()
      }
    })
    
    return cleanup
  }, [])
  
  // 刷新待同步数量
  const refreshPendingCount = async () => {
    const count = await getPendingCount()
    setPendingCount(count)
  }
  
  // 执行同步
  const doSync = async () => {
    const result = await performSync({ force: true })
    setSyncResult(result)
    await refreshPendingCount()
    return result
  }

  const loadStoredAuth = async () => {
    console.log('=== 开始加载认证状态 ===')
    try {
      const storedToken = localStorage.getItem('auth_token')
      const storedUser = localStorage.getItem('auth_user')

      console.log('从localStorage读取:')
      console.log('  token存在:', !!storedToken)
      console.log('  user存在:', !!storedUser)

      if (storedToken && storedUser) {
        const parsedUser = JSON.parse(storedUser)
        console.log('解析的用户:', parsedUser)
        console.log('用户role:', parsedUser?.role)

        // 先设置状态，确保用户可以正常使用
        setToken(storedToken)
        setUser(parsedUser)

        // 尝试验证token，但即使失败也不清除已有的认证状态
        try {
          console.log('正在验证token...')
          const resp = await fetch('/api/user', {
            headers: { Authorization: `Bearer ${storedToken}` }
          })
          if (resp.ok) {
            const profile = await resp.json()
            console.log('从后端获取的用户信息:', profile)
            console.log('后端返回的role:', profile?.role)
            localStorage.setItem('auth_user', JSON.stringify(profile))
            await setSetting('auth_user', JSON.stringify(profile))
            setUser(profile)
          } else {
            console.warn('Token验证失败，但保留本地状态')
            // 不调用 logout()，保留用户数据
          }
        } catch (err) {
          console.warn('Token验证请求失败:', err)
          // 网络错误时也保留本地状态
        }
      }
    } catch (error) {
      console.error('加载认证状态失败:', error)
    } finally {
      setLoading(false)
      console.log('=== 认证状态加载完成 ===')
      console.log('最终状态 - token:', !!token, ', user:', !!user)
      if (user) {
        console.log('用户role:', user.role, ', 是否admin:', (user.role || 'user') === 'admin')
        // 登录成功后检查待同步记录
        refreshPendingCount()
      }
    }
  }

  const login = async (userData, authToken) => {
    console.log('=== 执行登录 ===')
    console.log('用户数据:', userData)
    console.log('Token:', !!authToken)
    localStorage.setItem('auth_token', authToken)
    localStorage.setItem('auth_user', JSON.stringify(userData))
    await setSetting('auth_token', authToken)
    await setSetting('auth_user', JSON.stringify(userData))
    setToken(authToken)
    setUser(userData)
    console.log('登录完成 - user.role:', userData?.role)
    
    // 登录后检查待同步记录并自动同步
    const count = await getPendingCount()
    setPendingCount(count)
    if (count > 0 && navigator.onLine) {
      console.log(`登录后发现 ${count} 条待同步记录，开始自动同步`)
      const result = await performSync()
      setSyncResult(result)
      await refreshPendingCount()
    }
  }

  const logout = async () => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    await setSetting('auth_token', null)
    await setSetting('auth_user', null)
    setToken(null)
    setUser(null)
  }

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    isAuthenticated: !!token && !!user,
    pendingCount,
    syncResult,
    doSync,
    refreshPendingCount,
    clearSyncResult: () => setSyncResult(null)
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
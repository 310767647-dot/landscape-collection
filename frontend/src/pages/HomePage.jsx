import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getStats, getMaterials, saveMaterial } from '../utils/api'
import { getLocalMaterials, getPendingMaterials, markMaterialSyncing, markMaterialSynced, markMaterialSyncFailed } from '../utils/db'
import { useAuth } from '../context/AuthContext'
import { performSync } from '../utils/sync'
import ConfirmModal from '../components/ConfirmModal'

function HomePage() {
  const navigate = useNavigate()
  const { user, logout, pendingCount, syncResult, doSync, clearSyncResult } = useAuth()
  const [stats, setStats] = useState({ totalMaterials: 0, totalProjects: 0 })
  const [localStats, setLocalStats] = useState({ total: 0, pending: 0 })
  const [serverStatus, setServerStatus] = useState('checking')
  const [recentMaterials, setRecentMaterials] = useState([])
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [showSyncPrompt, setShowSyncPrompt] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    checkServerAndLoadData()
  }, [])
  
  // 监听pendingCount变化
  useEffect(() => {
    setLocalStats(prev => ({ ...prev, pending: pendingCount }))
    if (pendingCount > 0 && serverStatus === 'online' && !showSyncPrompt) {
      setShowSyncPrompt(true)
    }
  }, [pendingCount])
  
  // 监听同步结果
  useEffect(() => {
    if (syncResult && syncResult.success) {
      showToast(syncResult.message)
      clearSyncResult()
    }
  }, [syncResult])
  
  const showToast = (message) => {
    setToast(message)
    setTimeout(() => setToast(null), 3000)
  }

  const handleSync = async () => {
    setSyncing(true)
    setShowSyncPrompt(false)
    
    try {
      const result = await performSync({ force: true })
      if (result.success) {
        showToast(result.message)
        await loadLocalStats()
      } else {
        showToast(result.message || '同步失败')
      }
    } catch (error) {
      showToast('同步出错：' + error.message)
    } finally {
      setSyncing(false)
    }
  }
  
  const loadLocalStats = async () => {
    const localMaterials = await getLocalMaterials()
    const pending = await getPendingMaterials()
    setLocalStats({
      total: localMaterials.length,
      pending: pending.length
    })
  }

  const checkServerAndLoadData = async () => {
    try {
      const serverOk = await checkServer()
      setServerStatus(serverOk ? 'online' : 'offline')

      if (serverOk) {
        const statsData = await getStats()
        setStats({
          totalMaterials: statsData.totalMaterials,
          totalProjects: statsData.totalProjects
        })
        setRecentMaterials(statsData.recentMaterials || [])
      }
    } catch (error) {
      console.error('Error loading data:', error)
      setServerStatus('offline')
    }

    await loadLocalStats()
  }

  const checkServer = async () => {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 3000)
      const response = await fetch('/api/health', { signal: controller.signal })
      clearTimeout(timeoutId)
      return response.ok
    } catch {
      return false
    }
  }

  return (
    <div>
      <div className="page-header" style={{ paddingBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: 20 }}>🌿 市政景观数据采集</h1>
            <p style={{ fontSize: 12, opacity: 0.9 }}>现场材料信息采集与管理</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, color: 'white', marginBottom: 4 }}>
              👤 {user?.display_name || user?.username}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => navigate('/change-password')}
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  border: 'none',
                  color: 'white',
                  padding: '4px 10px',
                  borderRadius: 10,
                  fontSize: 11,
                  cursor: 'pointer'
                }}
              >
                修改密码
              </button>
              <button
                onClick={() => setShowLogoutConfirm(true)}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  color: 'white',
                  padding: '4px 12px',
                  borderRadius: 12,
                  fontSize: 12,
                  cursor: 'pointer'
                }}
              >
                退出
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="page-content">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontSize: 14, color: '#666' }}>服务器状态</span>
          <span style={{
            fontSize: 12,
            padding: '4px 12px',
            borderRadius: 12,
            background: serverStatus === 'online' ? '#e6f7ff' : '#fff7e6',
            color: serverStatus === 'online' ? '#1890ff' : '#fa8c16'
          }}>
            {serverStatus === 'checking' ? '检查中...' : serverStatus === 'online' ? '在线' : '离线'}
          </span>
        </div>

        <div className="stats-cards">
          <div className="stat-card">
            <div className="stat-value">{stats.totalMaterials}</div>
            <div className="stat-label">云端材料记录</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.totalProjects}</div>
            <div className="stat-label">云端项目数</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{localStats.total}</div>
            <div className="stat-label">本地记录</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: pendingCount > 0 ? '#fa8c16' : '#52c41a' }}>
              {pendingCount}
            </div>
            <div className="stat-label">待同步</div>
          </div>
        </div>

        {pendingCount > 0 && serverStatus === 'online' && (
          <div className="form-section" style={{ marginTop: 12 }}>
            <button
              className="action-button primary"
              onClick={handleSync}
              disabled={syncing}
              style={{ width: '100%' }}
            >
              {syncing ? '🔄 同步中...' : `🔄 同步 ${pendingCount} 条待同步记录`}
            </button>
          </div>
        )}

        <div className="form-section">
          <div className="form-section-title">📱 快捷操作</div>

          <button
            className="action-button primary"
            onClick={() => navigate('/add')}
            style={{ marginBottom: 12 }}
          >
            ➕ 手动录入材料
          </button>



          <button
            className="action-button secondary"
            onClick={() => navigate('/list')}
            style={{ marginBottom: 12 }}
          >
            📋 查看材料列表
          </button>

          <button
            className="action-button secondary"
            onClick={() => navigate('/export')}
          >
            📤 导出数据
          </button>

          {user?.role === 'admin' && (
            <button
              className="action-button secondary"
              onClick={() => navigate('/admin')}
              style={{ marginTop: 12 }}
            >
              🛠 后台管理
            </button>
          )}
        </div>

        {recentMaterials.length > 0 && (
          <div className="form-section">
            <div className="form-section-title">🕒 最近记录</div>
            {recentMaterials.slice(0, 5).map(material => (
              <div
                key={material.id}
                className="material-card"
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/detail/${material.id}`)}
              >
                <div className="material-card-header">
                  <div className="material-name">{material.material_name}</div>
                  <span className="sync-status synced">已同步</span>
                </div>
                <div className="material-info">
                  <div className="material-info-item">
                    <span className="material-info-label">供应商</span>
                    <span className="material-info-value">{material.supplier_name || '-'}</span>
                  </div>
                  <div className="material-info-item">
                    <span className="material-info-label">数量</span>
                    <span className="material-info-value">{material.quantity} {material.unit}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="form-section" style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, color: '#999', textAlign: 'center' }}>
            <p>💡 提示：数据优先保存到本地，网络恢复后自动同步到云端</p>
            <p style={{ marginTop: 4 }}>当前版本支持手动录入材料信息</p>
          </div>
        </div>
      </div>

      <div className="tab-bar">
        <a className="tab-item active" onClick={() => navigate('/')}>
          <span className="tab-item-icon">🏠</span>
          <span className="tab-item-label">首页</span>
        </a>
        <a className="tab-item" onClick={() => navigate('/list')}>
          <span className="tab-item-icon">📋</span>
          <span className="tab-item-label">列表</span>
        </a>
        <a className="tab-item" onClick={() => navigate('/export')}>
          <span className="tab-item-icon">📤</span>
          <span className="tab-item-label">导出</span>
        </a>
      </div>

      <ConfirmModal
        show={showLogoutConfirm}
        title="退出登录"
        message="确定要退出登录吗？"
        onConfirm={() => {
          logout()
          navigate('/login')
        }}
        onCancel={() => setShowLogoutConfirm(false)}
      />

      <ConfirmModal
        show={showSyncPrompt}
        title="同步提醒"
        message={`发现 ${pendingCount} 条待同步的记录，是否立即同步？`}
        onConfirm={handleSync}
        onCancel={() => setShowSyncPrompt(false)}
      />
      
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

export default HomePage

import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMaterials, getProjects, exportMaterials } from '../utils/api'
import { getLocalMaterials } from '../utils/db'
import { exportToExcel, exportToCSV, downloadFile, shareViaWebShare } from '../utils/export'

function ExportPage() {
  const navigate = useNavigate()
  const [materials, setMaterials] = useState([])
  const [localMaterials, setLocalMaterials] = useState([])
  const [projects, setProjects] = useState([])
  const [selectedProject, setSelectedProject] = useState('')
  const [selectedMaterial, setSelectedMaterial] = useState('')
  const [selectedSupplier, setSelectedSupplier] = useState('')
  const [selectedUser, setSelectedUser] = useState('')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [includeLocal, setIncludeLocal] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [materialsData, projectsData, localData] = await Promise.all([
        getMaterials().catch(() => ({ materials: [] })),
        getProjects().catch(() => []),
        getLocalMaterials().catch(() => [])
      ])

      const serverMaterials = materialsData?.materials || (Array.isArray(materialsData) ? materialsData : [])
      setMaterials(serverMaterials)
      setProjects(Array.isArray(projectsData) ? projectsData : [])
      setLocalMaterials(Array.isArray(localData) ? localData : [])
    } catch (error) {
      console.error('Error loading data:', error)
      setMaterials([])
      setProjects([])
      setLocalMaterials([])
    } finally {
      setIsLoading(false)
    }
  }

  const showToast = (message) => {
    setToast(message)
    setTimeout(() => setToast(null), 3000)
  }

  // 获取唯一的材料名称列表
  const getUniqueMaterialNames = () => {
    const names = new Set()
    materials?.forEach(m => {
      if (m.material_name) names.add(m.material_name)
    })
    return Array.from(names).sort()
  }

  // 获取唯一的供应商名称列表
  const getUniqueSupplierNames = () => {
    const names = new Set()
    materials?.forEach(m => {
      if (m.supplier_name) names.add(m.supplier_name)
    })
    return Array.from(names).sort()
  }

  // 获取唯一的录入用户列表
  const getUniqueUsers = () => {
    const users = new Set()
    materials?.forEach(m => {
      if (m.user_display_name) users.add(m.user_display_name)
      else if (m.user_username) users.add(m.user_username)
    })
    return Array.from(users).sort()
  }

  const getFilteredMaterials = () => {
    let filtered = materials ? [...materials] : []

    if (selectedProject) {
      filtered = filtered.filter(m => m.project_name === selectedProject)
    }

    if (selectedMaterial) {
      filtered = filtered.filter(m => m.material_name === selectedMaterial)
    }

    if (selectedSupplier) {
      filtered = filtered.filter(m => m.supplier_name === selectedSupplier)
    }

    if (selectedUser) {
      filtered = filtered.filter(m => 
        m.user_display_name === selectedUser || m.user_username === selectedUser
      )
    }

    if (dateRange.start) {
      filtered = filtered.filter(m => m.arrival_time && m.arrival_time >= dateRange.start)
    }

    if (dateRange.end) {
      filtered = filtered.filter(m => m.arrival_time && m.arrival_time <= dateRange.end)
    }

    if (includeLocal && localMaterials) {
      filtered = [...filtered, ...localMaterials]
    }

    return filtered
  }

  const handleExportExcel = () => {
    const data = getFilteredMaterials()
    if (data.length === 0) {
      showToast('没有可导出的数据')
      return
    }

    const timestamp = new Date().toISOString().slice(0, 10)
    exportToExcel(data, `材料数据_${timestamp}.xlsx`)
    showToast(`成功导出 ${data.length} 条记录到 Excel`)
  }

  const handleExportCSV = () => {
    const data = getFilteredMaterials()
    if (data.length === 0) {
      showToast('没有可导出的数据')
      return
    }

    const csvContent = exportToCSV(data)
    const timestamp = new Date().toISOString().slice(0, 10)
    downloadFile(csvContent, `材料数据_${timestamp}.csv`, 'text/csv;charset=utf-8')
    showToast(`成功导出 ${data.length} 条记录到 CSV`)
  }

  const handleShare = async () => {
    const data = getFilteredMaterials()
    if (data.length === 0) {
      showToast('没有可分享的数据')
      return
    }

    setExporting(true)
    try {
      const result = await shareViaWebShare(data)
      if (result.success) {
        showToast('分享成功')
      } else {
        handleExportCSV()
      }
    } catch (error) {
      console.error('Share error:', error)
      handleExportCSV()
    } finally {
      setExporting(false)
    }
  }

  const handleSyncAndExport = async () => {
    setExporting(true)
    try {
      const { getPendingMaterials, markMaterialSynced } = await import('../utils/db')
      const pending = await getPendingMaterials()

      for (const material of pending) {
        try {
          const { saveMaterial } = await import('../utils/api')
          const result = await saveMaterial({
            project_name: material.project_name,
            material_name: material.material_name,
            supplier_name: material.supplier_name,
            specifications: material.specifications,
            quantity: material.quantity,
            unit: material.unit,
            arrival_time: material.arrival_time,
            ocr_text: material.ocr_text
          })

          if (result.success) {
            await markMaterialSynced(material.id, result.id)
          }
        } catch (error) {
          console.error('Sync error:', error)
        }
      }

      await loadData()
      showToast('数据同步完成')
    } catch (error) {
      console.error('Sync error:', error)
      showToast('同步失败')
    } finally {
      setExporting(false)
    }
  }

  const filteredCount = isLoading ? 0 : getFilteredMaterials().length
  const totalCount = isLoading ? 0 : (materials?.length || 0) + (localMaterials?.length || 0)

  return (
    <div>
      <div className="page-header">
        <h1 onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>← 📤 数据导出</h1>
        <p>导出材料数据为Excel或CSV文件</p>
      </div>

      <div className="page-content">
        <div className="form-section">
          <div className="form-section-title">📊 导出统计</div>
          <div className="stats-cards">
            <div className="stat-card">
              <div className="stat-value">{totalCount}</div>
              <div className="stat-label">总记录数</div>
            </div>
            <div className={`stat-card ${filteredCount === 0 && !isLoading ? 'warning' : ''}`}>
              <div className="stat-value" style={{ color: filteredCount === 0 && !isLoading ? '#ff4d4f' : undefined }}>
                {filteredCount}
              </div>
              <div className="stat-label">待导出</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{materials.length}</div>
              <div className="stat-label">云端记录</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: localMaterials.length > 0 ? '#fa8c16' : '#52c41a' }}>
                {localMaterials.length}
              </div>
              <div className="stat-label">本地记录</div>
            </div>
          </div>
          
          {filteredCount === 0 && !isLoading && (
            <div style={{ 
              marginTop: 12, 
              padding: 12, 
              backgroundColor: '#fff7e6', 
              borderLeft: '4px solid #faad14',
              borderRadius: '4px'
            }}>
              <p style={{ margin: 0, fontSize: 14, color: '#d46b08' }}>
                ⚠️ 当前筛选条件下没有可导出的数据，请调整筛选条件
              </p>
            </div>
          )}
        </div>

        <div className="form-section">
          <div className="form-section-title">🔍 筛选条件</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-row">
              <label className="form-label">按项目筛选</label>
              <select
                className="form-input"
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
              >
                <option value="">全部项目</option>
                {projects.map(p => (
                  <option key={p.id} value={p.name}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label className="form-label">按材料筛选</label>
              <select
                className="form-input"
                value={selectedMaterial}
                onChange={(e) => setSelectedMaterial(e.target.value)}
              >
                <option value="">全部材料</option>
                {getUniqueMaterialNames().map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-row">
              <label className="form-label">按供应商筛选</label>
              <select
                className="form-input"
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
              >
                <option value="">全部供应商</option>
                {getUniqueSupplierNames().map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label className="form-label">按录入用户筛选</label>
              <select
                className="form-input"
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
              >
                <option value="">全部用户</option>
                {getUniqueUsers().map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-row">
              <label className="form-label">开始日期</label>
              <input
                type="date"
                className="form-input"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              />
            </div>
            <div className="form-row">
              <label className="form-label">结束日期</label>
              <input
                type="date"
                className="form-input"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              />
            </div>
          </div>

          <div className="form-row">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={includeLocal}
                onChange={(e) => setIncludeLocal(e.target.checked)}
              />
              <span>包含本地记录（{localMaterials.length}条）</span>
            </label>
          </div>

          {(selectedProject || selectedMaterial || selectedSupplier || selectedUser || dateRange.start || dateRange.end) && (
            <button
              className="action-button secondary"
              onClick={() => {
                setSelectedProject('')
                setSelectedMaterial('')
                setSelectedSupplier('')
                setSelectedUser('')
                setDateRange({ start: '', end: '' })
              }}
              style={{ width: '100%', marginTop: 8 }}
            >
              🔄 重置筛选条件
            </button>
          )}
        </div>

        <div className="form-section">
          <div className="form-section-title">📤 导出方式</div>

          <button
            className="share-btn excel"
            onClick={handleExportExcel}
            disabled={filteredCount === 0}
            style={{ 
              marginBottom: 12, 
              width: '100%', 
              padding: 14,
              opacity: filteredCount === 0 ? 0.5 : 1,
              cursor: filteredCount === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            📊 导出为 Excel (.xlsx)
            {filteredCount === 0 && <span style={{ marginLeft: 8, fontSize: 12 }}>(暂无数据)</span>}
          </button>

          <button
            className="share-btn"
            onClick={handleExportCSV}
            disabled={filteredCount === 0}
            style={{
              marginBottom: 12,
              width: '100%',
              padding: 14,
              background: filteredCount === 0 ? '#999' : '#217346',
              color: 'white',
              border: 'none',
              opacity: filteredCount === 0 ? 0.5 : 1,
              cursor: filteredCount === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            📄 导出为 CSV (.csv)
            {filteredCount === 0 && <span style={{ marginLeft: 8, fontSize: 12 }}>(暂无数据)</span>}
          </button>

          <button
            className="share-btn wechat"
            onClick={handleShare}
            disabled={filteredCount === 0 || exporting}
            style={{ 
              width: '100%', 
              padding: 14,
              opacity: (filteredCount === 0 || exporting) ? 0.5 : 1,
              cursor: (filteredCount === 0 || exporting) ? 'not-allowed' : 'pointer'
            }}
          >
            💬 分享到微信/QQ
            {filteredCount === 0 && <span style={{ marginLeft: 8, fontSize: 12 }}>(暂无数据)</span>}
          </button>
        </div>

        {localMaterials.length > 0 && (
          <div className="form-section">
            <div className="form-section-title">🔄 同步操作</div>
            <p style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
              有 {localMaterials.length} 条本地记录尚未同步到云端
            </p>
            <button
              className="action-button primary"
              onClick={handleSyncAndExport}
              disabled={exporting}
              style={{ width: '100%' }}
            >
              {exporting ? '同步中...' : '🔄 同步后导出'}
            </button>
          </div>
        )}

        <div className="form-section" style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, color: '#999' }}>
            <p style={{ marginBottom: 8 }}>💡 导出说明：</p>
            <ul style={{ paddingLeft: 16, lineHeight: 1.8 }}>
              <li>Excel格式适合在电脑上查看和编辑</li>
              <li>CSV格式可以用Excel打开，也支持微信/QQ分享</li>
              <li>分享功能会生成文件并调用系统分享界面</li>
              <li>建议在WiFi环境下导出大量数据</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="tab-bar">
        <a className="tab-item" onClick={() => navigate('/')}>
          <span className="tab-item-icon">🏠</span>
          <span className="tab-item-label">首页</span>
        </a>
        <a className="tab-item" onClick={() => navigate('/list')}>
          <span className="tab-item-icon">📋</span>
          <span className="tab-item-label">列表</span>
        </a>
        <a className="tab-item active" onClick={() => navigate('/export')}>
          <span className="tab-item-icon">📤</span>
          <span className="tab-item-label">导出</span>
        </a>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

export default ExportPage
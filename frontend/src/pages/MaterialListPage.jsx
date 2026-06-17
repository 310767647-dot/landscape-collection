import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMaterials, deleteMaterial, getProjects, saveMaterial } from '../utils/api'
import { getLocalMaterials, deleteLocalMaterial, getPendingMaterials, markMaterialSyncing, markMaterialSynced, markMaterialSyncFailed } from '../utils/db'
import { base64ToFile } from '../utils/image'
import AutocompleteInput from '../components/AutocompleteInput'

function MaterialListPage() {
  const navigate = useNavigate()
  const [materials, setMaterials] = useState([])
  const [localMaterials, setLocalMaterials] = useState([])
  const [projects, setProjects] = useState([])
  const [selectedProject, setSelectedProject] = useState('')
  const [selectedMaterial, setSelectedMaterial] = useState('')
  const [selectedSupplier, setSelectedSupplier] = useState('')
  const [showLocal, setShowLocal] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [showPhotoPreview, setShowPhotoPreview] = useState(false)
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState(null)

  const getPhotoUrls = (material) => {
    if (!material) return []
    
    const urls = []
    
    if (material.photos && Array.isArray(material.photos)) {
      material.photos.forEach(photo => {
        if (photo.data) {
          urls.push(photo.data)
        }
      })
    }
    
    if (!urls.length && material.photo) {
      urls.push(material.photo)
    }
    
    if (!urls.length && material.photo_path) {
      const paths = material.photo_path.split(',')
      paths.forEach(path => {
        const trimmedPath = path.trim()
        if (trimmedPath) {
          if (trimmedPath.startsWith('data:') || trimmedPath.startsWith('blob:')) {
            urls.push(trimmedPath)
          } else {
            urls.push(trimmedPath)
          }
        }
      })
    }
    
    return urls
  }

  useEffect(() => {
    loadData()
  }, [selectedProject, selectedMaterial, selectedSupplier])

  const loadData = async () => {
    console.log('=== MaterialListPage loadData ===')
    console.log('selectedProject:', selectedProject)
    console.log('selectedMaterial:', selectedMaterial)
    console.log('selectedSupplier:', selectedSupplier)
    setIsLoading(true)
    try {
      const [serverData, localData, projectListResult] = await Promise.all([
        (selectedProject || selectedMaterial || selectedSupplier)
          ? getMaterials({ 
              ...(selectedProject && { project_name: selectedProject }),
              ...(selectedMaterial && { material_name: selectedMaterial }),
              ...(selectedSupplier && { supplier_name: selectedSupplier })
            })
          : getMaterials(),
        getLocalMaterials(),
        getProjects().catch((err) => {
          console.error('getProjects error:', err)
          return []
        })
      ])
      
      // 确保 projectListResult 是数组
      const projectList = Array.isArray(projectListResult) ? projectListResult : []
      
      console.log('Server data:', serverData)
      console.log('Local materials:', Array.isArray(localData) ? localData.length : 'not array', localData)
      console.log('Projects:', projectList.length, projectList)

      const serverMaterials = serverData?.materials || []
      setMaterials(serverMaterials)
      setLocalMaterials(Array.isArray(localData) ? localData.filter(m => 
        m.syncStatus === 'pending' || m.syncStatus === 'syncing' || m.syncStatus === 'failed'
      ) : [])
      setProjects(projectList)
    } catch (error) {
      console.error('Error loading data:', error)
      const localData = await getLocalMaterials()
      setLocalMaterials(Array.isArray(localData) ? localData : [])
    } finally {
      setIsLoading(false)
      console.log('loadData completed, isLoading:', false)
    }
  }

  const showToast = (message) => {
    setToast(message)
    setTimeout(() => setToast(null), 3000)
  }

  const handleDelete = async (id, isLocal) => {
    if (!confirm('确定要删除这条记录吗？')) return

    try {
      if (isLocal) {
        await deleteLocalMaterial(id)
        showToast('本地记录已删除')
      } else {
        await deleteMaterial(id)
        showToast('云端记录已删除')
      }
      loadData()
    } catch (error) {
      console.error('Delete error:', error)
      showToast('删除失败')
    }
  }

  const syncPendingMaterials = async () => {
    const pending = await getPendingMaterials()
    if (pending.length === 0) {
      showToast('没有待同步的记录')
      return
    }

    setSyncing(true)
    let successCount = 0
    let skippedCount = 0

    for (const material of pending) {
      try {
        if (material.serverId) {
          skippedCount++
          continue
        }

        await markMaterialSyncing(material.id)
        
        showToast(`正在同步：${successCount + 1}/${pending.length - skippedCount}`)
        
        const formData = new FormData()
        formData.append('project_name', material.project_name || '')
        formData.append('material_name', material.material_name)
        formData.append('supplier_name', material.supplier_name || '')
        formData.append('specifications', material.specifications || '')
        formData.append('quantity', material.quantity || '')
        formData.append('unit', material.unit || '')
        formData.append('arrival_time', material.arrival_time || '')
        formData.append('ocr_text', material.ocr_text || '')

        if (material.photos && Array.isArray(material.photos)) {
          material.photos.forEach((photo, index) => {
            try {
              if (photo.data) {
                const base64Data = photo.data.split(',')[1]
                const mimeType = photo.data.split(',')[0].split(':')[1].split(';')[0]
                const byteString = atob(base64Data)
                const ab = new ArrayBuffer(byteString.length)
                const ia = new Uint8Array(ab)
                for (let i = 0; i < byteString.length; i++) {
                  ia[i] = byteString.charCodeAt(i)
                }
                const blob = new Blob([ab], { type: mimeType })
                formData.append('photos', blob, `photo_${index}_${material.id}.jpg`)
              }
            } catch (photoErr) {
              console.error('Photo conversion error:', photoErr)
            }
          })
        } else if (material.photo) {
          try {
            const photoFile = base64ToFile(material.photo, `delivery_${material.id}.jpg`)
            formData.append('photos', photoFile)
          } catch (photoErr) {
            console.error('Photo conversion error:', photoErr)
          }
        }

        const result = await saveMaterial({
          project_name: material.project_name,
          material_name: material.material_name,
          supplier_name: material.supplier_name,
          specifications: material.specifications,
          quantity: material.quantity,
          unit: material.unit,
          arrival_time: material.arrival_time,
          ocr_text: material.ocr_text,
          photos: material.photos
        })

        if (result.success) {
          await markMaterialSynced(material.id, result.id)
          successCount++
        } else {
          await markMaterialSyncFailed(material.id)
        }
      } catch (error) {
        console.error('Sync error for material:', material.id, error)
        await markMaterialSyncFailed(material.id)
      }
    }

    setSyncing(false)
    const actualCount = pending.length - skippedCount
    if (skippedCount > 0) {
      showToast(`同步完成：${successCount}/${actualCount} 条记录（${skippedCount} 条已跳过）`)
    } else {
      showToast(`同步完成：${successCount}/${pending.length} 条记录`)
    }
    loadData()
  }

  const getSyncStatus = (material) => {
    if (material.syncStatus === 'pending' || material.syncStatus === 'local') {
      return { text: '本地', class: 'local' }
    }
    return { text: '已同步', class: 'synced' }
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div>
      <div className="page-header">
        <h1 onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>← 📋 材料列表</h1>
        <p>查看和管理所有材料记录</p>
      </div>

      <div className="page-content">
        <div className="filter-bar" style={{ flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8, width: '100%', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 140 }}>
              <AutocompleteInput
                value={selectedProject}
                onChange={setSelectedProject}
                options={projects.map(p => p.name).filter(Boolean).sort()}
                placeholder="输入或选择项目名称"
              />
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <AutocompleteInput
                value={selectedMaterial}
                onChange={setSelectedMaterial}
                options={[...new Set(materials.map(m => m.material_name).filter(Boolean))].sort()}
                placeholder="输入或选择材料名称"
              />
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <AutocompleteInput
                value={selectedSupplier}
                onChange={setSelectedSupplier}
                options={[...new Set(materials.map(m => m.supplier_name).filter(Boolean))].sort()}
                placeholder="输入或选择供应商"
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#999' }}>
              {materials.length} 条记录
            </span>
            <button
              className={`filter-chip ${showLocal ? 'active' : ''}`}
              onClick={() => setShowLocal(!showLocal)}
              style={{ 
                color: localMaterials.length > 0 ? '#fa8c16' : undefined,
                marginLeft: 'auto'
              }}
            >
              本地 ({localMaterials.length})
            </button>
          </div>
        </div>

        {localMaterials.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 14, color: '#fa8c16' }}>
              💾 有 {localMaterials.length} 条本地记录待同步
            </span>
            <button
              className="action-button primary"
              onClick={syncPendingMaterials}
              disabled={syncing}
              style={{ padding: '8px 16px', width: 'auto', fontSize: 13 }}
            >
              {syncing ? '同步中...' : '同步全部'}
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="empty-state">
            <div className="loading-spinner" style={{ margin: '0 auto' }} />
          </div>
        ) : (
          <>
            {(showLocal ? localMaterials : materials).length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📭</div>
                <div className="empty-state-text">
                  {showLocal ? '暂无本地记录' : '暂无材料记录'}
                </div>
                <button
                  className="action-button primary"
                  onClick={() => navigate('/add')}
                  style={{ marginTop: 16, width: 'auto', display: 'inline-flex' }}
                >
                  添加第一条记录
                </button>
              </div>
            ) : (
              (showLocal ? localMaterials : materials).map(material => {
                const syncStatus = getSyncStatus(material)
                return (
                  <div
                    key={material.id}
                    className="material-card"
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/detail/${material.id}?local=${showLocal}`)}
                  >
                    <div className="material-card-header">
                      <div className="material-name">{material.material_name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className={`sync-status ${syncStatus.class}`}>
                          {syncStatus.text}
                        </span>
                        <button
                          className="delete-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(material.id, showLocal)
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    {material.project_name && (
                      <div style={{ fontSize: 13, color: '#667eea', marginBottom: 8 }}>
                        📁 {material.project_name}
                      </div>
                    )}

                    <div className="material-info">
                      <div className="material-info-item">
                        <span className="material-info-label">供应商</span>
                        <span className="material-info-value">{material.supplier_name || '-'}</span>
                      </div>
                      <div className="material-info-item">
                        <span className="material-info-label">规格</span>
                        <span className="material-info-value">{material.specifications || '-'}</span>
                      </div>
                      <div className="material-info-item">
                        <span className="material-info-label">数量</span>
                        <span className="material-info-value">{material.quantity} {material.unit}</span>
                      </div>
                      <div className="material-info-item">
                        <span className="material-info-label">到货时间</span>
                        <span className="material-info-value">{formatDate(material.arrival_time)}</span>
                      </div>
                    </div>

                    {(() => {
              const photoUrls = getPhotoUrls(material)
              if (!photoUrls || photoUrls.length === 0) return null
              return (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>📷 照片 ({photoUrls.length}张)</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {photoUrls.map((photoUrl, index) => (
                      <div 
                        key={index}
                        style={{ 
                          width: 80, 
                          height: 80, 
                          borderRadius: 8, 
                          overflow: 'hidden',
                          border: '1px solid #ddd'
                        }}
                      >
                        <img
                          src={photoUrl}
                          alt={`照片 ${index + 1}`}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            display: 'block',
                            cursor: 'pointer'
                          }}
                          onClick={(e) => {
                            e.stopPropagation()
                            setPreviewPhotoUrl(photoUrl)
                            setShowPhotoPreview(true)
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}
                  </div>
                )
              })
            )}
          </>
        )}
      </div>

      <button
        className="floating-button"
        onClick={() => navigate('/add')}
        title="添加材料"
      >
        +
      </button>

      <div className="tab-bar">
        <a className="tab-item" onClick={() => navigate('/')}>
          <span className="tab-item-icon">🏠</span>
          <span className="tab-item-label">首页</span>
        </a>
        <a className="tab-item active" onClick={() => navigate('/list')}>
          <span className="tab-item-icon">📋</span>
          <span className="tab-item-label">列表</span>
        </a>
        <a className="tab-item" onClick={() => navigate('/export')}>
          <span className="tab-item-icon">📤</span>
          <span className="tab-item-label">导出</span>
        </a>
      </div>

      {toast && <div className="toast">{toast}</div>}

      {showPhotoPreview && previewPhotoUrl && (
        <div 
          className="photo-preview-modal"
          onClick={() => setShowPhotoPreview(false)}
        >
          <div className="photo-preview-modal-content">
            <button 
              className="photo-preview-close"
              onClick={(e) => {
                e.stopPropagation()
                setShowPhotoPreview(false)
              }}
            >
              ✕
            </button>
            <img 
              src={previewPhotoUrl} 
              alt="送货单大图"
              className="photo-preview-modal-image"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default MaterialListPage

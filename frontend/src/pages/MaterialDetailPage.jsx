import React, { useState, useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getMaterial, deleteMaterial } from '../utils/api'
import { getLocalMaterial, deleteLocalMaterial } from '../utils/db'
import { exportToExcel, downloadFile, shareViaWebShare } from '../utils/export'

function MaterialDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const isLocal = searchParams.get('local') === 'true'

  const [material, setMaterial] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [sharing, setSharing] = useState(false)
  const [showPhotoPreview, setShowPhotoPreview] = useState(false)

  useEffect(() => {
    loadMaterial()
  }, [id, isLocal])

  const loadMaterial = async () => {
    setIsLoading(true)
    try {
      let data
      if (isLocal) {
        data = await getLocalMaterial(id)
      } else {
        data = await getMaterial(id)
      }
      setMaterial(data)
    } catch (error) {
      console.error('Error loading material:', error)
      showToast('加载失败')
    } finally {
      setIsLoading(false)
    }
  }

  const showToast = (message) => {
    setToast(message)
    setTimeout(() => setToast(null), 3000)
  }

  const handleDelete = async () => {
    if (!confirm('确定要删除这条记录吗？')) return

    try {
      if (isLocal) {
        await deleteLocalMaterial(id)
      } else {
        await deleteMaterial(id)
      }
      showToast('删除成功')
      setTimeout(() => navigate('/list'), 1000)
    } catch (error) {
      console.error('Delete error:', error)
      showToast('删除失败')
    }
  }

  const handleExportSingle = () => {
    if (!material) return

    let csvContent = '\ufeff项目名称,材料名称,供应商,规格,数量,单位,到货时间\n'
    csvContent += `"${material.project_name || ''}","${material.material_name}","${material.supplier_name || ''}","${material.specifications || ''}","${material.quantity || ''}","${material.unit || ''}","${material.arrival_time || ''}"\n`

    downloadFile(csvContent, `材料_${material.material_name}_${Date.now()}.csv`, 'text/csv;charset=utf-8')
    showToast('导出成功')
  }

  const handleShare = async () => {
    if (!material) return

    setSharing(true)
    try {
      const result = await shareViaWebShare([material])
      if (result.success) {
        showToast('分享成功')
      } else {
        handleExportSingle()
      }
    } catch (error) {
      console.error('Share error:', error)
      handleExportSingle()
    } finally {
      setSharing(false)
    }
  }

  const getPhotoUrl = (material) => {
    if (!material) return null
    if (material.photo) {
      return material.photo
    }
    if (material.photo_path) {
      if (material.photo_path.startsWith('data:') || material.photo_path.startsWith('blob:')) {
        return material.photo_path
      }
      return `http://localhost:3001${material.photo_path}`
    }
    return null
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (isLoading) {
    return (
      <div>
        <div className="page-header">
          <h1 onClick={() => navigate('/list')} style={{ cursor: 'pointer' }}>← 返回</h1>
        </div>
        <div className="page-content">
          <div className="empty-state">
            <div className="loading-spinner" style={{ margin: '0 auto' }} />
          </div>
        </div>
      </div>
    )
  }

  if (!material) {
    return (
      <div>
        <div className="page-header">
          <h1 onClick={() => navigate('/list')} style={{ cursor: 'pointer' }}>← 返回</h1>
        </div>
        <div className="page-content">
          <div className="empty-state">
            <div className="empty-state-icon">❌</div>
            <div className="empty-state-text">记录不存在或已被删除</div>
            <button
              className="action-button primary"
              onClick={() => navigate('/list')}
              style={{ marginTop: 16, width: 'auto', display: 'inline-flex' }}
            >
              返回列表
            </button>
          </div>
        </div>
      </div>
    )
  }

  const photoUrl = getPhotoUrl(material)

  return (
    <div>
      <div className="page-header">
        <h1 onClick={() => navigate('/list')} style={{ cursor: 'pointer' }}>← 材料详情</h1>
        <p>{material.material_name}</p>
      </div>

      <div className="page-content">
        <div className="form-section">
          <div className="form-section-title">📦 材料信息</div>

          <div className="material-info" style={{ gap: 16 }}>
            <div className="material-info-item" style={{ gridColumn: '1 / -1' }}>
              <span className="material-info-label">材料名称</span>
              <span className="material-info-value" style={{ fontSize: 18, fontWeight: 600 }}>
                {material.material_name}
              </span>
            </div>

            {material.project_name && (
              <div className="material-info-item" style={{ gridColumn: '1 / -1' }}>
                <span className="material-info-label">所属项目</span>
                <span className="material-info-value" style={{ color: '#667eea' }}>
                  📁 {material.project_name}
                </span>
              </div>
            )}

            <div className="material-info-item">
              <span className="material-info-label">供应商</span>
              <span className="material-info-value">{material.supplier_name || '-'}</span>
            </div>

            <div className="material-info-item">
              <span className="material-info-label">规格型号</span>
              <span className="material-info-value">{material.specifications || '-'}</span>
            </div>

            <div className="material-info-item">
              <span className="material-info-label">数量</span>
              <span className="material-info-value" style={{ fontSize: 16 }}>
                {material.quantity || '-'} {material.unit}
              </span>
            </div>

            <div className="material-info-item">
              <span className="material-info-label">到货时间</span>
              <span className="material-info-value">{formatDate(material.arrival_time)}</span>
            </div>

            <div className="material-info-item" style={{ gridColumn: '1 / -1' }}>
              <span className="material-info-label">同步状态</span>
              <span className={`sync-status ${material.syncStatus === 'synced' ? 'synced' : 'local'}`}>
                {material.syncStatus === 'synced' ? '✓ 已同步' : '⏳ 本地保存'}
              </span>
            </div>

            <div className="material-info-item" style={{ gridColumn: '1 / -1' }}>
              <span className="material-info-label">创建时间</span>
              <span className="material-info-value">{formatDate(material.created_at)}</span>
            </div>
          </div>
        </div>

        {photoUrl && (
          <div className="form-section">
            <div className="form-section-title">📷 送货单照片</div>
            <img 
              src={photoUrl} 
              alt="送货单" 
              className="material-detail-photo"
              onClick={() => setShowPhotoPreview(true)}
              style={{ cursor: 'pointer' }}
            />
            <div style={{ fontSize: 12, color: '#999', marginTop: 8, textAlign: 'center' }}>
              点击图片放大查看
            </div>
          </div>
        )}

        {material.ocr_text && (
          <div className="form-section">
            <div className="form-section-title">📝 OCR识别文本</div>
            <div className="ocr-result" style={{ maxHeight: 200 }}>
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{material.ocr_text}</pre>
            </div>
          </div>
        )}

        <div className="form-section">
          <div className="form-section-title">📤 分享与导出</div>

          <div className="share-buttons">
            <button className="share-btn wechat" onClick={handleShare} disabled={sharing}>
              💬 微信/QQ
            </button>
            <button className="share-btn excel" onClick={handleExportSingle}>
              📊 Excel
            </button>
          </div>
        </div>

        <button
          className="action-button"
          onClick={handleDelete}
          style={{
            marginTop: 16,
            background: '#ff4d4f',
            color: 'white',
            border: 'none'
          }}
        >
          🗑️ 删除记录
        </button>

        <button
          className="action-button secondary"
          onClick={() => navigate('/list')}
          style={{ marginTop: 12 }}
        >
          返回列表
        </button>
      </div>

      {toast && <div className="toast">{toast}</div>}

      {showPhotoPreview && photoUrl && (
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
              src={photoUrl} 
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

export default MaterialDetailPage
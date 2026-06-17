import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPublicProjects, saveMaterial } from '../utils/api'
import { saveMaterialLocal } from '../utils/db'

export default function AddMaterialPage() {
  const navigate = useNavigate()

  const [materials, setMaterials] = useState([{
    projectName: '',
    materialName: '',
    supplierName: '',
    specifications: '',
    quantity: '',
    unit: '',
    arrivalTime: new Date().toISOString().slice(0, 16),
    photos: []
  }])
  
  const [projects, setProjects] = useState([])
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [toast, setToast] = useState('')
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [savingIndex, setSavingIndex] = useState(-1)
  const [savedCount, setSavedCount] = useState(0)

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = async () => {
    setLoadingProjects(true)
    try {
      const data = await getPublicProjects()
      setProjects(Array.isArray(data) ? data : [])
    } catch (e) {
      showToast('加载项目列表失败')
      setProjects([])
    } finally {
      setLoadingProjects(false)
    }
  }

  const handleChange = (index, field, value) => {
    setMaterials(prev => {
      const newList = [...prev]
      newList[index] = { ...newList[index], [field]: value }
      return newList
    })
  }

  const addMaterialRow = () => {
    if (materials.length >= 10) {
      showToast('最多支持同时添加10种材料')
      return
    }
    setMaterials(prev => [...prev, {
      projectName: materials[0]?.projectName || '',
      materialName: '',
      supplierName: '',
      specifications: '',
      quantity: '',
      unit: '',
      arrivalTime: new Date().toISOString().slice(0, 16),
      photos: []
    }])
  }

  const takePhoto = async (index) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.capture = 'environment'
    input.multiple = true
    
    input.onchange = async (e) => {
      const files = Array.from(e.target.files)
      if (files.length === 0) return
      
      const photos = []
      for (const file of files) {
        const base64 = await fileToBase64(file)
        photos.push({
          name: file.name,
          data: base64,
          type: file.type
        })
      }
      
      setMaterials(prev => {
        const newList = [...prev]
        newList[index] = {
          ...newList[index],
          photos: [...newList[index].photos, ...photos]
        }
        return newList
      })
      
      showToast(`成功添加 ${files.length} 张照片`)
    }
    
    input.click()
  }

  const removePhoto = (index, photoIndex) => {
    setMaterials(prev => {
      const newList = [...prev]
      newList[index] = {
        ...newList[index],
        photos: newList[index].photos.filter((_, i) => i !== photoIndex)
      }
      return newList
    })
  }

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const removeMaterialRow = (index) => {
    if (materials.length <= 1) {
      showToast('至少需要添加一种材料')
      return
    }
    setMaterials(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    
    const validMaterials = materials.filter(m => m.projectName && m.materialName)
    
    if (validMaterials.length === 0) {
      showToast('请至少填写一种材料信息（项目名称和材料名称为必填）')
      return
    }
    
    setShowConfirmModal(true)
  }

  const checkNetwork = async () => {
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

  const confirmSave = async () => {
    setShowConfirmModal(false)
    setSavedCount(0)
    const validMaterials = materials.filter(m => m.projectName && m.materialName)
    let successCount = 0
    let syncedCount = 0
    
    const isOnline = await checkNetwork()
    
    for (let i = 0; i < validMaterials.length; i++) {
      setSavingIndex(i)
      try {
        const materialData = {
          project_name: validMaterials[i].projectName,
          material_name: validMaterials[i].materialName,
          supplier_name: validMaterials[i].supplierName,
          specifications: validMaterials[i].specifications,
          quantity: validMaterials[i].quantity,
          unit: validMaterials[i].unit,
          arrival_time: validMaterials[i].arrivalTime,
          photos: validMaterials[i].photos || []
        }
        
        if (isOnline) {
          const savedMaterial = await saveMaterial(materialData)
          if (savedMaterial.success) {
            materialData.serverId = savedMaterial.id
            materialData.syncStatus = 'synced'
            await saveMaterialLocal(materialData)
            syncedCount++
          }
        } else {
          materialData.syncStatus = 'pending'
          await saveMaterialLocal(materialData)
        }
        successCount++
        setSavedCount(successCount)
      } catch (error) {
        console.error('Save error:', error)
        try {
          const materialData = {
            project_name: validMaterials[i].projectName,
            material_name: validMaterials[i].materialName,
            supplier_name: validMaterials[i].supplierName,
            specifications: validMaterials[i].specifications,
            quantity: validMaterials[i].quantity,
            unit: validMaterials[i].unit,
            arrival_time: validMaterials[i].arrivalTime,
            photos: validMaterials[i].photos || [],
            syncStatus: 'pending'
          }
          await saveMaterialLocal(materialData)
          successCount++
          setSavedCount(successCount)
        } catch (localError) {
          console.error('Local save error:', localError)
          showToast(`第${i + 1} 种材料保存失败`)
        }
      }
    }
    
    setSavingIndex(-1)
    if (isOnline) {
      if (syncedCount === successCount) {
        showToast(`成功保存并同步 ${successCount} 种材料！`)
      } else {
        showToast(`成功保存 ${successCount} 种材料，其中 ${syncedCount} 种已同步`)
      }
    } else {
      showToast(`成功保存 ${successCount} 种材料，待网络恢复后自动同步`)
    }
    setTimeout(() => navigate('/list'), 1500)
  }

  const getSelectedProject = (projectName) => {
    return projects.find(p => p.name === projectName)
  }

  const getTotalCount = () => {
    return materials.reduce((sum, m) => sum + (parseFloat(m.quantity) || 0), 0)
  }

  return (
    <div style={{ padding: 16, maxWidth: 500, margin: '0 auto' }}>
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={() => navigate('/')}
          style={{
            width: 40,
            height: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f5f5f5',
            border: 'none',
            borderRadius: 10,
            fontSize: 18,
            cursor: 'pointer'
          }}
        >
          ←
        </button>
        <div>
          <h1 style={{ margin: 0 }}>批量添加材料</h1>
          <p style={{ color: '#666', margin: 4, fontSize: 14 }}>支持同时添加多种材料</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {materials.map((material, index) => (
          <div key={index} style={{
            border: '1px solid #e8e8e8',
            borderRadius: 12,
            padding: 16,
            marginBottom: 16,
            position: 'relative'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12
            }}>
              <span style={{ fontSize: 14, fontWeight: 'bold', color: '#667eea' }}>
                📦 材料 {index + 1}
              </span>
              {materials.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeMaterialRow(index)}
                  style={{
                    padding: 4,
                    background: '#fff1f0',
                    border: 'none',
                    borderRadius: 6,
                    color: '#ff4d4f',
                    fontSize: 12,
                    cursor: 'pointer'
                  }}
                >
                  删除
                </button>
              )}
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 'bold', fontSize: 13 }}>📋 项目名称 *</label>
              {loadingProjects ? (
                <div style={{
                  width: '100%',
                  padding: 10,
                  borderRadius: 6,
                  border: '1px solid #ddd',
                  boxSizing: 'border-box',
                  backgroundColor: '#f9f9f9',
                  color: '#999',
                  textAlign: 'center',
                  fontSize: 13
                }}>
                  加载中...
                </div>
              ) : (
                <select
                  value={material.projectName}
                  onChange={(e) => handleChange(index, 'projectName', e.target.value)}
                  style={{
                    width: '100%',
                    padding: 10,
                    borderRadius: 6,
                    border: '1px solid #ddd',
                    boxSizing: 'border-box',
                    height: 40,
                    fontSize: 13,
                    cursor: 'pointer',
                    appearance: 'none',
                    backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23666\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'%3E%3C/polyline%3E%3C/svg%3E")',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 10px center',
                    backgroundSize: '14px'
                  }}
                >
                  <option value="">请选择项目名称</option>
                  {projects.map(project => (
                    <option key={project.id} value={project.name}>
                      {project.name}
                    </option>
                  ))}
                </select>
              )}
              {getSelectedProject(material.projectName)?.description && (
                <div style={{
                  marginTop: 6,
                  padding: 6,
                  background: '#f5f5f5',
                  borderRadius: 4,
                  fontSize: 11,
                  color: '#666'
                }}>
                  📝 {getSelectedProject(material.projectName).description}
                </div>
              )}
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 'bold', fontSize: 13 }}>📦 材料名称 *</label>
              <input
                type="text"
                value={material.materialName}
                onChange={(e) => handleChange(index, 'materialName', e.target.value)}
                placeholder="请输入材料名称"
                style={{
                  width: '100%',
                  padding: 10,
                  borderRadius: 6,
                  border: '1px solid #ddd',
                  boxSizing: 'border-box',
                  fontSize: 13
                }}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 'bold', fontSize: 13 }}>🏢 供应商名称</label>
              <input
                type="text"
                value={material.supplierName}
                onChange={(e) => handleChange(index, 'supplierName', e.target.value)}
                placeholder="请输入供应商名称"
                style={{
                  width: '100%',
                  padding: 10,
                  borderRadius: 6,
                  border: '1px solid #ddd',
                  boxSizing: 'border-box',
                  fontSize: 13
                }}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 'bold', fontSize: 13 }}>📐 规格型号</label>
              <input
                type="text"
                value={material.specifications}
                onChange={(e) => handleChange(index, 'specifications', e.target.value)}
                placeholder="请输入规格型号"
                style={{
                  width: '100%',
                  padding: 10,
                  borderRadius: 6,
                  border: '1px solid #ddd',
                  boxSizing: 'border-box',
                  fontSize: 13
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 'bold', fontSize: 13 }}>🔢 数量</label>
                <input
                  type="number"
                  value={material.quantity}
                  onChange={(e) => handleChange(index, 'quantity', e.target.value)}
                  placeholder="数量"
                  style={{
                    width: '100%',
                    padding: 10,
                    borderRadius: 6,
                    border: '1px solid #ddd',
                    boxSizing: 'border-box',
                    fontSize: 13
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 'bold', fontSize: 13 }}>📏 单位</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={material.unit}
                    onChange={(e) => handleChange(index, 'unit', e.target.value)}
                    list={`unit-options-${index}`}
                    placeholder="选择或输入单位"
                    style={{
                      width: '100%',
                      padding: 10,
                      borderRadius: 6,
                      border: '1px solid #ddd',
                      boxSizing: 'border-box',
                      fontSize: 13,
                      height: 40
                    }}
                  />
                  <datalist id={`unit-options-${index}`}>
                    <option value="个" />
                    <option value="件" />
                    <option value="箱" />
                    <option value="包" />
                    <option value="袋" />
                    <option value="桶" />
                    <option value="瓶" />
                    <option value="米" />
                    <option value="千克" />
                    <option value="克" />
                    <option value="吨" />
                    <option value="立方米" />
                    <option value="平方米" />
                    <option value="升" />
                    <option value="支" />
                    <option value="卷" />
                    <option value="块" />
                    <option value="片" />
                    <option value="根" />
                    <option value="套" />
                    <option value="组" />
                  </datalist>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 8 }}>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 'bold', fontSize: 13 }}>🕐 到货时间</label>
              <input
                type="datetime-local"
                value={material.arrivalTime}
                onChange={(e) => handleChange(index, 'arrivalTime', e.target.value)}
                style={{
                  width: '100%',
                  padding: 10,
                  borderRadius: 6,
                  border: '1px solid #ddd',
                  boxSizing: 'border-box',
                  fontSize: 13
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 'bold', fontSize: 13 }}>📸 照片（送货单/材料照片）</label>
              <button
                type="button"
                onClick={() => takePhoto(index)}
                style={{
                  width: '100%',
                  padding: 12,
                  background: '#fffbe6',
                  border: '2px dashed #faad14',
                  borderRadius: 8,
                  fontSize: 13,
                  color: '#fa8c16',
                  cursor: 'pointer',
                  marginBottom: 12
                }}
              >
                📷 拍照/上传图片（支持多选）
              </button>
              
              {material.photos && material.photos.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {material.photos.map((photo, photoIndex) => (
                    <div 
                      key={photoIndex}
                      style={{ 
                        position: 'relative', 
                        width: 100, 
                        height: 100, 
                        borderRadius: 8,
                        overflow: 'hidden',
                        border: '1px solid #ddd'
                      }}
                    >
                      <img 
                        src={photo.data} 
                        alt={`照片 ${photoIndex + 1}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(index, photoIndex)}
                        style={{
                          position: 'absolute',
                          top: 4,
                          right: 4,
                          width: 24,
                          height: 24,
                          background: 'rgba(0,0,0,0.6)',
                          border: 'none',
                          borderRadius: '50%',
                          color: 'white',
                          fontSize: 12,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={addMaterialRow}
          style={{
            width: '100%',
            padding: 12,
            background: '#f5f5f5',
            border: '2px dashed #ddd',
            borderRadius: 8,
            fontSize: 14,
            color: '#666',
            cursor: 'pointer',
            marginBottom: 16
          }}
        >
          + 添加另一种材料
        </button>

        <div style={{
          padding: 12,
          background: '#f5f9ff',
          borderRadius: 8,
          marginBottom: 16
        }}>
          <div style={{ fontSize: 13, color: '#666' }}>
            <span>📊 本次将添加 <strong style={{ color: '#667eea' }}>{materials.length}</strong> 种材料</span>
            {getTotalCount() > 0 && (
              <span style={{ marginLeft: 12 }}>| 总数量：<strong style={{ color: '#52c41a' }}>{getTotalCount()}</strong></span>
            )}
          </div>
        </div>

        <button
          type="submit"
          style={{
            width: '100%',
            padding: 16,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            fontSize: 16,
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          💾 批量保存材料
        </button>
      </form>

      {showConfirmModal && (
        <div style={{
          position: 'fixed',
          left: 0,
          top: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          zIndex: 1000
        }}
        onClick={() => setShowConfirmModal(false)}
        >
          <div style={{
            background: 'white',
            borderRadius: 12,
            padding: 24,
            width: '100%',
            maxWidth: 320
          }}
          onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' }}>
              ⚠️ 确认保存
            </div>
            <div style={{ fontSize: 14, color: '#666', marginBottom: 16, lineHeight: '1.5' }}>
              <p>您正在保存 <strong style={{ color: '#667eea' }}>{materials.length}</strong> 种材料信息</p>
              <p style={{ marginTop: 8 }}>项目名称：<strong>{materials[0]?.projectName || '多个项目'}</strong></p>
              <p style={{ marginTop: 8, fontSize: 12 }}>确认无误后请点击"确认保存"按钮</p>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setShowConfirmModal(false)}
                style={{
                  flex: 1,
                  padding: 12,
                  background: '#f5f5f5',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 14,
                  cursor: 'pointer'
                }}
              >
                返回修改
              </button>
              <button
                onClick={confirmSave}
                style={{
                  flex: 1,
                  padding: 12,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                确认保存
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed',
          bottom: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.8)',
          color: 'white',
          padding: 12,
          borderRadius: 8,
          zIndex: 1000
        }}>
          {toast}
        </div>
      )}
    </div>
  )
}
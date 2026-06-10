import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getAdminUsers, updateAdminUser, getAdminMaterials, updateAdminMaterial, getPublicProjects, createAdminProject, updateAdminProject, deleteAdminProject } from '../utils/api'
import api from '../utils/api'
import { useAuth } from '../context/AuthContext'

function AdminPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [tab, setTab] = useState('users')
  const [toast, setToast] = useState(null)
  const [loading, setLoading] = useState(false)

  const [users, setUsers] = useState([])
  const [materials, setMaterials] = useState([])
  const [projects, setProjects] = useState([])
  const [materialFilters, setMaterialFilters] = useState({
    project_name: '',
    material_name: '',
    supplier_name: '',
    user_name: ''
  })

  const [editingUser, setEditingUser] = useState(null)
  const [userForm, setUserForm] = useState({ username: '', display_name: '', phone: '', role: 'user', password: '' })
  const [selectedProjects, setSelectedProjects] = useState([])
  const [creatingUser, setCreatingUser] = useState(false)

  const [editingMaterial, setEditingMaterial] = useState(null)
  const [materialForm, setMaterialForm] = useState({
    project_name: '',
    material_name: '',
    supplier_name: '',
    specifications: '',
    quantity: '',
    unit: '',
    arrival_time: '',
    ocr_text: ''
  })

  const [editingProject, setEditingProject] = useState(null)
  const [showProjectModal, setShowProjectModal] = useState(false)
  const [projectForm, setProjectForm] = useState({ name: '', description: '' })
  
  const [deletedUsers, setDeletedUsers] = useState([])
  const [deletedMaterials, setDeletedMaterials] = useState([])
  const [deletedProjects, setDeletedProjects] = useState([])
  const [deletedTab, setDeletedTab] = useState('users')

  const showToast = (message) => {
    setToast(message)
    setTimeout(() => setToast(null), 3000)
  }

  const loadUsers = async () => {
    setLoading(true)
    try {
      const data = await getAdminUsers()
      setUsers(Array.isArray(data) ? data : [])
    } catch (e) {
      showToast(e.response?.data?.error || '加载用户失败')
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  const loadMaterials = async (filters = {}) => {
    setLoading(true)
    try {
      const params = {}
      if (filters.project_name) params.project_name = filters.project_name
      if (filters.material_name) params.material_name = filters.material_name
      if (filters.supplier_name) params.supplier_name = filters.supplier_name
      if (filters.user_name) params.user_name = filters.user_name
      
      const data = await getAdminMaterials(params)
      const serverMaterials = data?.materials || (Array.isArray(data) ? data : [])
      setMaterials(serverMaterials)
    } catch (e) {
      showToast(e.response?.data?.error || '加载材料失败')
      setMaterials([])
    } finally {
      setLoading(false)
    }
  }

  const loadProjects = async () => {
    setLoading(true)
    try {
      const data = await getPublicProjects()
      setProjects(Array.isArray(data) ? data : [])
    } catch (e) {
      showToast(e.response?.data?.error || '加载项目失败')
      setProjects([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (tab === 'users') {
      loadUsers()
      loadProjects()
    }
    if (tab === 'materials') loadMaterials()
    if (tab === 'projects') loadProjects()
  }, [tab])

  const handleMaterialFilterChange = (field, value) => {
    setMaterialFilters(prev => ({ ...prev, [field]: value }))
  }

  const applyMaterialFilters = () => {
    loadMaterials(materialFilters)
  }

  const resetMaterialFilters = () => {
    setMaterialFilters({
      project_name: '',
      material_name: '',
      supplier_name: '',
      user_name: ''
    })
    loadMaterials({})
  }

  const openUserEdit = async (u) => {
    setEditingUser(u)
    setCreatingUser(false)
    setUserForm({
      username: u.username || '',
      display_name: u.display_name || '',
      phone: u.phone || '',
      role: u.role === 'admin' ? 'admin' : 'user',
      password: ''
    })
    
    if (u.id) {
      try {
        const response = await api.get(`/user-projects/${u.id}`)
        const data = response.data || response
        const userProjects = Array.isArray(data) ? data : []
        console.log('用户项目数据:', userProjects)
        const projectIds = userProjects.map(p => p.id).filter(id => id)
        console.log('项目ID列表:', projectIds)
        setSelectedProjects(projectIds)
      } catch (e) {
        console.error('加载用户项目失败:', e)
        setSelectedProjects([])
      }
    } else {
      setSelectedProjects([])
    }
  }

  const openUserCreate = () => {
    setEditingUser(null)
    setCreatingUser(true)
    setUserForm({
      username: '',
      display_name: '',
      phone: '',
      role: 'user',
      password: ''
    })
    setSelectedProjects([])
  }

  const saveUser = async () => {
    setLoading(true)
    try {
      if (creatingUser) {
        // 创建新用户
        if (!userForm.username.trim() || !userForm.password.trim() || !userForm.display_name.trim() || !userForm.phone.trim()) {
          showToast('请填写完整的用户信息')
          setLoading(false)
          return
        }
        
        const payload = {
          username: userForm.username.trim(),
          password: userForm.password.trim(),
          display_name: userForm.display_name.trim(),
          phone: userForm.phone.trim(),
          role: userForm.role
        }
        
        const resp = await api.post('/admin/users', payload)
        if (resp.data.success) {
          // 如果是普通用户且选择了项目，保存项目关联
          if (userForm.role !== 'admin' && selectedProjects.length > 0) {
            await api.post('/user-projects', {
              userId: resp.data.userId,
              projectIds: selectedProjects
            })
          }
          
          showToast('用户创建成功')
          setEditingUser(null)
          setCreatingUser(false)
          setSelectedProjects([])
          await loadUsers()
        } else {
          showToast(resp.data.error || '创建失败')
        }
      } else {
        // 更新现有用户
        if (!editingUser) return
        
        const payload = {
          username: userForm.username.trim(),
          display_name: userForm.display_name.trim(),
          phone: userForm.phone.trim(),
          role: userForm.role
        }
        if (userForm.password) payload.password = userForm.password
        
        const resp = await updateAdminUser(editingUser.id, payload)
        if (resp.success) {
          if (userForm.role !== 'admin') {
            await api.post('/user-projects', {
              userId: editingUser.id,
              projectIds: selectedProjects
            })
          }
          showToast('用户已更新')
          setEditingUser(null)
          setSelectedProjects([])
          await loadUsers()
        } else {
          showToast(resp.error || '更新失败')
        }
      }
    } catch (e) {
      showToast(e.response?.data?.error || '操作失败')
    } finally {
      setLoading(false)
    }
  }

  const openMaterialEdit = (m) => {
    setEditingMaterial(m)
    setMaterialForm({
      project_name: m.project_name || '',
      material_name: m.material_name || '',
      supplier_name: m.supplier_name || '',
      specifications: m.specifications || '',
      quantity: m.quantity ?? '',
      unit: m.unit || '',
      arrival_time: m.arrival_time || '',
      ocr_text: m.ocr_text || ''
    })
  }

  const saveMaterial = async () => {
    if (!editingMaterial) return
    setLoading(true)
    try {
      const resp = await updateAdminMaterial(editingMaterial.id, materialForm)
      if (resp.success) {
        showToast('材料已更新')
        setEditingMaterial(null)
        await loadMaterials()
      } else {
        showToast(resp.error || '更新失败')
      }
    } catch (e) {
      showToast(e.response?.data?.error || '更新失败')
    } finally {
      setLoading(false)
    }
  }

  const confirmDeleteUser = (u) => {
    if (window.confirm(`确定要删除用户 "${u.display_name || u.username}" 吗？删除后可以在删除记录中恢复。`)) {
      deleteUser(u.id)
    }
  }

  const deleteUser = async (userId) => {
    setLoading(true)
    try {
      const resp = await api.delete(`/admin/users/${userId}`)
      if (resp.data.success) {
        showToast('用户删除成功')
        await loadUsers()
        await loadDeletedUsers()
      } else {
        showToast(resp.data.error || '删除失败')
      }
    } catch (e) {
      showToast(e.response?.data?.error || '删除失败')
    } finally {
      setLoading(false)
    }
  }

  const confirmDeleteMaterial = (m) => {
    if (window.confirm(`确定要删除材料 "${m.material_name}" 吗？删除后可以在删除记录中恢复。`)) {
      deleteMaterial(m.id)
    }
  }

  const deleteMaterial = async (materialId) => {
    setLoading(true)
    try {
      const resp = await api.delete(`/admin/materials/${materialId}`)
      if (resp.data.success) {
        showToast('材料删除成功')
        await loadMaterials()
        await loadDeletedMaterials()
      } else {
        showToast(resp.data.error || '删除失败')
      }
    } catch (e) {
      showToast(e.response?.data?.error || '删除失败')
    } finally {
      setLoading(false)
    }
  }

  const openProjectEdit = (p) => {
    setEditingProject(p)
    setProjectForm({
      name: p.name || '',
      description: p.description || ''
    })
    setShowProjectModal(true)
  }

  const openProjectCreate = () => {
    setEditingProject(null)
    setProjectForm({ name: '', description: '' })
    setShowProjectModal(true)
  }

  const saveProject = async () => {
    setLoading(true)
    try {
      if (!projectForm.name.trim()) {
        showToast('请输入项目名称')
        setLoading(false)
        return
      }

      let resp
      if (editingProject) {
        resp = await updateAdminProject(editingProject.id, {
          name: projectForm.name.trim(),
          description: projectForm.description.trim()
        })
      } else {
        resp = await createAdminProject({
          name: projectForm.name.trim(),
          description: projectForm.description.trim()
        })
      }

      if (resp.success) {
        showToast(editingProject ? '项目已更新' : '项目创建成功')
        setEditingProject(null)
        setShowProjectModal(false)
        setProjectForm({ name: '', description: '' })
        await loadProjects()
      } else {
        showToast(resp.error || '操作失败')
      }
    } catch (e) {
      showToast(e.response?.data?.error || '操作失败')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteProject = async (projectId, projectName) => {
    if (!window.confirm(`确定要删除项目「${projectName}」吗？此操作将同时删除该项目下的所有材料数据！`)) {
      return
    }

    setLoading(true)
    try {
      const resp = await deleteAdminProject(projectId)
      if (resp.success) {
        showToast('项目删除成功')
        await loadProjects()
        await loadDeletedProjects()
        await loadDeletedMaterials()
      } else {
        showToast(resp.error || '删除失败')
      }
    } catch (e) {
      showToast(e.response?.data?.error || '删除失败')
    } finally {
      setLoading(false)
    }
  }

  const loadDeletedUsers = async () => {
    try {
      const data = await api.get('/admin/deleted/users')
      const list = data.data?.data || data.data || []
      setDeletedUsers(Array.isArray(list) ? list : [])
    } catch (e) {
      console.error('加载删除用户记录失败:', e)
      setDeletedUsers([])
    }
  }

  const loadDeletedMaterials = async () => {
    try {
      const data = await api.get('/admin/deleted/materials')
      const list = data.data?.data || data.data || []
      setDeletedMaterials(Array.isArray(list) ? list : [])
    } catch (e) {
      console.error('加载删除材料记录失败:', e)
      setDeletedMaterials([])
    }
  }

  const loadDeletedProjects = async () => {
    try {
      const data = await api.get('/admin/deleted/projects')
      const list = data.data?.data || data.data || []
      setDeletedProjects(Array.isArray(list) ? list : [])
    } catch (e) {
      console.error('加载删除项目记录失败:', e)
      setDeletedProjects([])
    }
  }

  const restoreUser = async (userId) => {
    setLoading(true)
    try {
      const resp = await api.post(`/admin/deleted/users/${userId}/restore`)
      if (resp.data.success) {
        showToast('用户恢复成功')
        await loadDeletedUsers()
        await loadUsers()
      } else {
        showToast(resp.data.error || '恢复失败')
      }
    } catch (e) {
      showToast(e.response?.data?.error || '恢复失败')
    } finally {
      setLoading(false)
    }
  }

  const restoreMaterial = async (materialId) => {
    setLoading(true)
    try {
      const resp = await api.post(`/admin/deleted/materials/${materialId}/restore`)
      if (resp.data.success) {
        showToast('材料恢复成功')
        await loadDeletedMaterials()
        await loadMaterials()
      } else {
        showToast(resp.data.error || '恢复失败')
      }
    } catch (e) {
      showToast(e.response?.data?.error || '恢复失败')
    } finally {
      setLoading(false)
    }
  }

  const restoreProject = async (projectId) => {
    setLoading(true)
    try {
      const resp = await api.post(`/admin/deleted/projects/${projectId}/restore`)
      if (resp.data.success) {
        showToast('项目恢复成功')
        await loadDeletedProjects()
        await loadProjects()
      } else {
        showToast(resp.data.error || '恢复失败')
      }
    } catch (e) {
      showToast(e.response?.data?.error || '恢复失败')
    } finally {
      setLoading(false)
    }
  }

  const clearDeletedProject = async (projectId) => {
    if (window.confirm('确定要彻底清除此删除记录吗？此操作不可恢复！')) {
      setLoading(true)
      try {
        const resp = await api.delete(`/admin/deleted/projects/${projectId}`)
        if (resp.data.success) {
          showToast('删除记录已清除')
          await loadDeletedProjects()
        } else {
          showToast(resp.data.error || '清除失败')
        }
      } catch (e) {
        showToast(e.response?.data?.error || '清除失败')
      } finally {
        setLoading(false)
      }
    }
  }

  const clearDeletedUser = async (userId) => {
    if (window.confirm('确定要彻底清除此删除记录吗？此操作不可恢复！')) {
      setLoading(true)
      try {
        const resp = await api.delete(`/admin/deleted/users/${userId}`)
        if (resp.data.success) {
          showToast('删除记录已清除')
          await loadDeletedUsers()
        } else {
          showToast(resp.data.error || '清除失败')
        }
      } catch (e) {
        showToast(e.response?.data?.error || '清除失败')
      } finally {
        setLoading(false)
      }
    }
  }

  const clearDeletedMaterial = async (materialId) => {
    if (window.confirm('确定要彻底清除此删除记录吗？此操作不可恢复！')) {
      setLoading(true)
      try {
        const resp = await api.delete(`/admin/deleted/materials/${materialId}`)
        if (resp.data.success) {
          showToast('删除记录已清除')
          await loadDeletedMaterials()
        } else {
          showToast(resp.data.error || '清除失败')
        }
      } catch (e) {
        showToast(e.response?.data?.error || '清除失败')
      } finally {
        setLoading(false)
      }
    }
  }

  return (
    <div>
      <div className="page-header" style={{ paddingBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: 20, cursor: 'pointer' }} onClick={() => navigate('/')}>🛠 后台管理</h1>
            <p style={{ fontSize: 12, opacity: 0.9 }}>仅管理员可访问</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 13, color: 'white', marginBottom: 4 }}>
              👤 {user?.display_name || user?.username}
            </div>
            <button
              onClick={() => navigate('/')}
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
              返回
            </button>
          </div>
        </div>
      </div>

      <div className="page-content">
        <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <button
            className={`filter-chip ${tab === 'users' ? 'active' : ''}`}
            onClick={() => setTab('users')}
          >
            用户管理
          </button>
          <button
            className={`filter-chip ${tab === 'materials' ? 'active' : ''}`}
            onClick={() => setTab('materials')}
          >
            材料管理
          </button>
          <button
            className={`filter-chip ${tab === 'projects' ? 'active' : ''}`}
            onClick={() => setTab('projects')}
          >
            项目管理
          </button>
          <button
            className={`filter-chip ${tab === 'deleted' ? 'active' : ''}`}
            onClick={() => { setTab('deleted'); loadDeletedUsers(); loadDeletedMaterials(); }}
          >
            🗑 删除记录
          </button>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="loading-spinner" style={{ margin: '0 auto' }} />
          </div>
        ) : tab === 'users' ? (
          <div className="form-section">
            <div className="form-section-title">👥 用户列表</div>
            <button 
              className="action-button primary" 
              type="button" 
              onClick={openUserCreate}
              style={{ marginBottom: 16 }}
            >
              + 新建用户
            </button>
            {users.length === 0 ? (
              <div style={{ fontSize: 13, color: '#999', textAlign: 'center', padding: '12px 0' }}>暂无用户</div>
            ) : (
              users.map(u => (
                <div key={u.id} className="material-card" style={{ marginBottom: 10 }}>
                  <div className="material-card-header">
                    <div className="material-name">{u.display_name || u.username}</div>
                    <span className={`sync-status ${u.role === 'admin' ? 'synced' : 'local'}`}>{u.role === 'admin' ? '管理员' : '普通用户'}</span>
                  </div>
                  <div className="material-info" style={{ marginBottom: 10 }}>
                    <div className="material-info-item">
                      <span className="material-info-label">用户名</span>
                      <span className="material-info-value">{u.username}</span>
                    </div>
                    <div className="material-info-item">
                      <span className="material-info-label">创建时间</span>
                      <span className="material-info-value">{u.created_at || '-'}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="action-button secondary" type="button" onClick={() => openUserEdit(u)} style={{ flex: 1 }}>
                      编辑用户
                    </button>
                    <button 
                      className="action-button secondary" 
                      type="button" 
                      onClick={() => confirmDeleteUser(u)}
                      style={{ flex: 1, background: '#ff4444', color: 'white' }}
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : tab === 'materials' ? (
          <div className="form-section">
            <div className="form-section-title">📦 材料列表</div>
            
            <div style={{ marginTop: 8, padding: 12, background: '#f5f5f5', borderRadius: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 'bold', marginBottom: 12, color: '#666' }}>筛选条件</div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div className="form-row" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: 12 }}>项目名称</label>
                  <input
                    type="text"
                    className="form-input"
                    value={materialFilters.project_name}
                    onChange={(e) => handleMaterialFilterChange('project_name', e.target.value)}
                    placeholder="输入项目名称"
                  />
                </div>
                <div className="form-row" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: 12 }}>材料名称</label>
                  <input
                    type="text"
                    className="form-input"
                    value={materialFilters.material_name}
                    onChange={(e) => handleMaterialFilterChange('material_name', e.target.value)}
                    placeholder="输入材料名称"
                  />
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div className="form-row" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: 12 }}>供应商</label>
                  <input
                    type="text"
                    className="form-input"
                    value={materialFilters.supplier_name}
                    onChange={(e) => handleMaterialFilterChange('supplier_name', e.target.value)}
                    placeholder="输入供应商名称"
                  />
                </div>
                <div className="form-row" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: 12 }}>录入人</label>
                  <input
                    type="text"
                    className="form-input"
                    value={materialFilters.user_name}
                    onChange={(e) => handleMaterialFilterChange('user_name', e.target.value)}
                    placeholder="输入真实姓名或用户名"
                  />
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: 10 }}>
                <button 
                  className="action-button secondary" 
                  type="button" 
                  onClick={applyMaterialFilters}
                  style={{ flex: 1 }}
                >
                  🔍 筛选
                </button>
                <button 
                  className="action-button secondary" 
                  type="button" 
                  onClick={resetMaterialFilters}
                  style={{ flex: 1, background: '#f0f0f0', color: '#666' }}
                >
                  ↺ 重置
                </button>
              </div>
            </div>
            
            {materials.length === 0 ? (
              <div style={{ fontSize: 13, color: '#999', textAlign: 'center', padding: '12px 0' }}>暂无材料</div>
            ) : (
              materials.slice(0, 100).map(m => (
                <div key={m.id} className="material-card" style={{ marginBottom: 10 }}>
                  <div className="material-card-header">
                    <div className="material-name">{m.material_name}</div>
                    <span className="sync-status synced">云端</span>
                  </div>
                  <div className="material-info" style={{ marginBottom: 10 }}>
                    <div className="material-info-item">
                      <span className="material-info-label">项目</span>
                      <span className="material-info-value">{m.project_name || '-'}</span>
                    </div>
                    <div className="material-info-item">
                      <span className="material-info-label">供应商</span>
                      <span className="material-info-value">{m.supplier_name || '-'}</span>
                    </div>
                    <div className="material-info-item">
                      <span className="material-info-label">录入人</span>
                      <span className="material-info-value">{m.user_display_name || m.user_username || '-'}</span>
                    </div>
                    <div className="material-info-item">
                      <span className="material-info-label">数量</span>
                      <span className="material-info-value">{m.quantity || ''} {m.unit || ''}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="action-button secondary" type="button" onClick={() => openMaterialEdit(m)} style={{ flex: 1 }}>
                      编辑材料
                    </button>
                    <button 
                      className="action-button secondary" 
                      type="button" 
                      onClick={() => confirmDeleteMaterial(m)}
                      style={{ flex: 1, background: '#ff4444', color: 'white' }}
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))
            )}
            {materials.length > 100 && (
              <div style={{ fontSize: 12, color: '#999', textAlign: 'center', paddingTop: 6 }}>
                仅展示前 100 条，可用搜索缩小范围
              </div>
            )}
          </div>
        ) : tab === 'projects' ? (
          <div className="form-section">
            <div className="form-section-title">📋 项目列表</div>
            <button 
              className="action-button primary" 
              type="button" 
              onClick={openProjectCreate}
              style={{ marginBottom: 16 }}
            >
              + 新建项目
            </button>
            {projects.length === 0 ? (
              <div style={{ fontSize: 13, color: '#999', textAlign: 'center', padding: '12px 0' }}>暂无项目，请先创建项目</div>
            ) : (
              projects.map(p => (
                <div key={p.id} className="material-card" style={{ marginBottom: 10 }}>
                  <div className="material-card-header">
                    <div className="material-name">{p.name}</div>
                    <span className="sync-status synced">已发布</span>
                  </div>
                  {p.description && (
                    <div className="material-info" style={{ marginBottom: 10 }}>
                      <div className="material-info-item">
                        <span className="material-info-label">描述</span>
                        <span className="material-info-value">{p.description}</span>
                      </div>
                    </div>
                  )}
                  <div className="material-info" style={{ marginBottom: 10 }}>
                    <div className="material-info-item">
                      <span className="material-info-label">创建时间</span>
                      <span className="material-info-value">{p.created_at || '-'}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="action-button secondary" type="button" onClick={() => openProjectEdit(p)} style={{ flex: 1 }}>
                      编辑
                    </button>
                    <button 
                      className="action-button secondary" 
                      type="button" 
                      onClick={() => handleDeleteProject(p.id, p.name)} 
                      style={{ flex: 1, background: '#ff4d4f' }}
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : tab === 'deleted' ? (
          <div className="form-section">
            <div className="form-section-title">🗑 删除记录</div>
            
            <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
              <button
                className={`filter-chip ${deletedTab === 'users' ? 'active' : ''}`}
                onClick={() => { setDeletedTab('users'); loadDeletedUsers(); }}
              >
                删除用户 ({deletedUsers.length})
              </button>
              <button
                className={`filter-chip ${deletedTab === 'materials' ? 'active' : ''}`}
                onClick={() => { setDeletedTab('materials'); loadDeletedMaterials(); }}
              >
                删除材料 ({deletedMaterials.length})
              </button>
              <button
                className={`filter-chip ${deletedTab === 'projects' ? 'active' : ''}`}
                onClick={() => { setDeletedTab('projects'); loadDeletedProjects(); }}
              >
                删除项目 ({deletedProjects.length})
              </button>
            </div>

            {deletedTab === 'users' ? (
              <div>
                {deletedUsers.length === 0 ? (
                  <div style={{ fontSize: 13, color: '#999', textAlign: 'center', padding: '12px 0' }}>暂无删除的用户</div>
                ) : (
                  deletedUsers.map(u => (
                    <div key={u.id} className="material-card" style={{ marginBottom: 10, borderLeft: '4px solid #ff4444' }}>
                      <div className="material-card-header">
                        <div className="material-name">{u.display_name || u.username}</div>
                        <span className="sync-status local" style={{ background: '#ff4444' }}>已删除</span>
                      </div>
                      <div className="material-info" style={{ marginBottom: 10 }}>
                        <div className="material-info-item">
                          <span className="material-info-label">用户名</span>
                          <span className="material-info-value">{u.username}</span>
                        </div>
                        <div className="material-info-item">
                          <span className="material-info-label">删除时间</span>
                          <span className="material-info-value">{u.deleted_at || '-'}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button 
                          className="action-button secondary" 
                          type="button" 
                          onClick={() => restoreUser(u.id)}
                          style={{ flex: 1, background: '#52c41a', color: 'white' }}
                        >
                          🔄 恢复
                        </button>
                        <button 
                          className="action-button secondary" 
                          type="button" 
                          onClick={() => clearDeletedUser(u.id)}
                          style={{ flex: 1, background: '#ff4444', color: 'white' }}
                        >
                          彻底清除
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : deletedTab === 'materials' ? (
              <div>
                {deletedMaterials.length === 0 ? (
                  <div style={{ fontSize: 13, color: '#999', textAlign: 'center', padding: '12px 0' }}>暂无删除的材料</div>
                ) : (
                  deletedMaterials.map(m => (
                    <div key={m.id} className="material-card" style={{ marginBottom: 10, borderLeft: '4px solid #ff4444' }}>
                      <div className="material-card-header">
                        <div className="material-name">{m.material_name}</div>
                        <span className="sync-status local" style={{ background: '#ff4444' }}>已删除</span>
                      </div>
                      <div className="material-info" style={{ marginBottom: 10 }}>
                        <div className="material-info-item">
                          <span className="material-info-label">项目</span>
                          <span className="material-info-value">{m.project_name || '-'}</span>
                        </div>
                        <div className="material-info-item">
                          <span className="material-info-label">数量</span>
                          <span className="material-info-value">{m.quantity || ''} {m.unit || ''}</span>
                        </div>
                        <div className="material-info-item">
                          <span className="material-info-label">删除时间</span>
                          <span className="material-info-value">{m.deleted_at || '-'}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button 
                          className="action-button secondary" 
                          type="button" 
                          onClick={() => restoreMaterial(m.id)}
                          style={{ flex: 1, background: '#52c41a', color: 'white' }}
                        >
                          🔄 恢复
                        </button>
                        <button 
                          className="action-button secondary" 
                          type="button" 
                          onClick={() => clearDeletedMaterial(m.id)}
                          style={{ flex: 1, background: '#ff4444', color: 'white' }}
                        >
                          彻底清除
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div>
                {deletedProjects.length === 0 ? (
                  <div style={{ fontSize: 13, color: '#999', textAlign: 'center', padding: '12px 0' }}>暂无删除的项目</div>
                ) : (
                  deletedProjects.map(p => (
                    <div key={p.id} className="material-card" style={{ marginBottom: 10, borderLeft: '4px solid #ff4444' }}>
                      <div className="material-card-header">
                        <div className="material-name">{p.name}</div>
                        <span className="sync-status local" style={{ background: '#ff4444' }}>已删除</span>
                      </div>
                      <div className="material-info" style={{ marginBottom: 10 }}>
                        <div className="material-info-item">
                          <span className="material-info-label">描述</span>
                          <span className="material-info-value">{p.description || '-'}</span>
                        </div>
                        <div className="material-info-item">
                          <span className="material-info-label">删除时间</span>
                          <span className="material-info-value">{p.deleted_at || '-'}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button 
                          className="action-button secondary" 
                          type="button" 
                          onClick={() => restoreProject(p.id)}
                          style={{ flex: 1, background: '#52c41a', color: 'white' }}
                        >
                          🔄 恢复
                        </button>
                        <button 
                          className="action-button secondary" 
                          type="button" 
                          onClick={() => clearDeletedProject(p.id)}
                          style={{ flex: 1, background: '#ff4444', color: 'white' }}
                        >
                          彻底清除
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ) : null}

        {(editingUser || creatingUser || editingMaterial || editingProject !== null || showProjectModal) && (
          <div
            style={{
              position: 'fixed',
              left: 0,
              top: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.35)',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              padding: 16,
              zIndex: 999
            }}
            onClick={() => {
              setEditingUser(null)
              setEditingMaterial(null)
              setEditingProject(null)
              setShowProjectModal(false)
            }}
          >
            <div
              className="form-section"
              style={{ width: '100%', maxWidth: 520, margin: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              {editingUser || creatingUser ? (
                <>
                  <div className="form-section-title">{creatingUser ? '新建用户' : '编辑用户'}</div>
                  <div className="form-row">
                    <label className="form-label">用户名 *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={userForm.username}
                      onChange={(e) => setUserForm(prev => ({ ...prev, username: e.target.value }))}
                    />
                  </div>
                  <div className="form-row">
                    <label className="form-label">真实姓名 *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={userForm.display_name}
                      onChange={(e) => setUserForm(prev => ({ ...prev, display_name: e.target.value }))}
                    />
                  </div>
                  <div className="form-row">
                    <label className="form-label">注册手机号 *</label>
                    <input
                      type="tel"
                      className="form-input"
                      value={userForm.phone}
                      onChange={(e) => setUserForm(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="请输入注册手机号"
                    />
                  </div>
                  <div className="form-row">
                    <label className="form-label">密码 {creatingUser ? '*' : ''}</label>
                    <input
                      type="password"
                      className="form-input"
                      value={userForm.password}
                      onChange={(e) => setUserForm(prev => ({ ...prev, password: e.target.value }))}
                      placeholder={creatingUser ? '请输入密码' : '不修改则留空'}
                    />
                  </div>
                  <div className="form-row">
                    <label className="form-label">角色</label>
                    <select
                      className="form-input"
                      value={userForm.role}
                      onChange={(e) => setUserForm(prev => ({ ...prev, role: e.target.value }))}
                      style={{ height: 44 }}
                    >
                      <option value="user">普通用户</option>
                      <option value="admin">管理员</option>
                    </select>
                  </div>
                  {creatingUser && userForm.role !== 'admin' && (
                    <div className="form-row">
                      <label className="form-label">匹配项目</label>
                      <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #ddd', borderRadius: 8, padding: 8 }}>
                        {projects.length === 0 ? (
                          <div style={{ fontSize: 13, color: '#999', textAlign: 'center' }}>暂无项目</div>
                        ) : (
                          projects.map(project => (
                            <label key={project.id} style={{ display: 'flex', alignItems: 'center', marginBottom: 8, cursor: 'pointer' }}>
                              <input
                                type="checkbox"
                                checked={selectedProjects.includes(project.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedProjects(prev => [...prev, project.id])
                                  } else {
                                    setSelectedProjects(prev => prev.filter(id => id !== project.id))
                                  }
                                }}
                                style={{ marginRight: 8 }}
                              />
                              <span>{project.name}</span>
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                  {!creatingUser && userForm.role !== 'admin' && (
                    <div className="form-row">
                      <label className="form-label">匹配项目</label>
                      <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid #ddd', borderRadius: 8, padding: 8 }}>
                        {projects.map(project => (
                          <label key={project.id} style={{ display: 'flex', alignItems: 'center', marginBottom: 8, cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={selectedProjects.includes(project.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedProjects(prev => [...prev, project.id])
                                } else {
                                  setSelectedProjects(prev => prev.filter(id => id !== project.id))
                                }
                              }}
                              style={{ marginRight: 8 }}
                            />
                            <span>{project.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button type="button" className="action-button secondary" onClick={() => { setEditingUser(null); setCreatingUser(false); }} style={{ flex: 1 }}>
                      取消
                    </button>
                    <button type="button" className="action-button primary" onClick={saveUser} disabled={loading} style={{ flex: 1 }}>
                      {creatingUser ? '创建' : '保存'}
                    </button>
                  </div>
                </>
              ) : null}

              {editingMaterial && (
                <>
                  <div className="form-section-title">编辑材料</div>
                  <div className="form-row">
                    <label className="form-label">项目名称</label>
                    <input
                      type="text"
                      className="form-input"
                      value={materialForm.project_name}
                      onChange={(e) => setMaterialForm(prev => ({ ...prev, project_name: e.target.value }))}
                    />
                  </div>
                  <div className="form-row">
                    <label className="form-label">材料名称</label>
                    <input
                      type="text"
                      className="form-input"
                      value={materialForm.material_name}
                      onChange={(e) => setMaterialForm(prev => ({ ...prev, material_name: e.target.value }))}
                    />
                  </div>
                  <div className="form-row">
                    <label className="form-label">供应商</label>
                    <input
                      type="text"
                      className="form-input"
                      value={materialForm.supplier_name}
                      onChange={(e) => setMaterialForm(prev => ({ ...prev, supplier_name: e.target.value }))}
                    />
                  </div>
                  <div className="form-row">
                    <label className="form-label">规格型号</label>
                    <input
                      type="text"
                      className="form-input"
                      value={materialForm.specifications}
                      onChange={(e) => setMaterialForm(prev => ({ ...prev, specifications: e.target.value }))}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-row">
                      <label className="form-label">数量</label>
                      <input
                        type="number"
                        className="form-input"
                        value={materialForm.quantity}
                        onChange={(e) => setMaterialForm(prev => ({ ...prev, quantity: e.target.value }))}
                        step="0.01"
                      />
                    </div>
                    <div className="form-row">
                      <label className="form-label">单位</label>
                      <select
                        className="form-input"
                        value={materialForm.unit}
                        onChange={(e) => setMaterialForm(prev => ({ ...prev, unit: e.target.value }))}
                      >
                        <option value="">请选择单位</option>
                        <option value="个">个</option>
                        <option value="件">件</option>
                        <option value="箱">箱</option>
                        <option value="包">包</option>
                        <option value="米">米</option>
                        <option value="千克">千克</option>
                        <option value="吨">吨</option>
                        <option value="卷">卷</option>
                        <option value="平方米">平方米</option>
                        <option value="立方米">立方米</option>
                        <option value="桶">桶</option>
                        <option value="瓶">瓶</option>
                        <option value="支">支</option>
                        <option value="其他">其他</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-row">
                    <label className="form-label">到货时间</label>
                    <input
                      type="datetime-local"
                      className="form-input"
                      value={materialForm.arrival_time}
                      onChange={(e) => setMaterialForm(prev => ({ ...prev, arrival_time: e.target.value }))}
                    />
                  </div>
                  <div className="form-row">
                    <label className="form-label">OCR 文本</label>
                    <textarea
                      className="form-input"
                      value={materialForm.ocr_text}
                      onChange={(e) => setMaterialForm(prev => ({ ...prev, ocr_text: e.target.value }))}
                      style={{ minHeight: 110, paddingTop: 10, paddingBottom: 10 }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button type="button" className="action-button secondary" onClick={() => setEditingMaterial(null)} style={{ flex: 1 }}>
                      取消
                    </button>
                    <button type="button" className="action-button primary" onClick={saveMaterial} disabled={loading} style={{ flex: 1 }}>
                      保存
                    </button>
                  </div>
                </>
              )}

              {showProjectModal && (
                <div>
                  <div className="form-section-title">{editingProject ? '编辑项目' : '新建项目'}</div>
                  <div className="form-row">
                    <label className="form-label">项目名称 *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={projectForm.name}
                      onChange={(e) => setProjectForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="请输入项目名称"
                    />
                  </div>
                  <div className="form-row">
                    <label className="form-label">项目描述</label>
                    <textarea
                      className="form-input"
                      value={projectForm.description}
                      onChange={(e) => setProjectForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="请输入项目描述（可选）"
                      style={{ minHeight: 80, paddingTop: 10, paddingBottom: 10 }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button type="button" className="action-button secondary" onClick={() => {
                      setEditingProject(null)
                      setShowProjectModal(false)
                    }} style={{ flex: 1 }}>
                      取消
                    </button>
                    <button type="button" className="action-button primary" onClick={saveProject} disabled={loading} style={{ flex: 1 }}>
                      {editingProject ? '保存修改' : '创建项目'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AdminPage

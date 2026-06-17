import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

api.interceptors.request.use(
  config => {
    const token = localStorage.getItem('auth_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  error => {
    return Promise.reject(error)
  }
)

api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      console.warn('认证失败，保留本地状态')
    }
    return Promise.reject(error)
  }
)

export const saveMaterial = async (materialData) => {
  const token = localStorage.getItem('auth_token')
  
  const formData = new FormData()
  formData.append('project_name', materialData.project_name || '')
  formData.append('material_name', materialData.material_name || '')
  formData.append('supplier_name', materialData.supplier_name || '')
  formData.append('specifications', materialData.specifications || '')
  formData.append('quantity', materialData.quantity || '')
  formData.append('unit', materialData.unit || '')
  formData.append('arrival_time', materialData.arrival_time || '')
  formData.append('ocr_text', materialData.ocr_text || '')
  
  if (materialData.photos && materialData.photos.length > 0) {
    materialData.photos.forEach((photo, index) => {
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
        formData.append('photos', blob, `photo_${index}_${Date.now()}.jpg`)
      }
    })
  }
  
  const response = await axios.post('/api/materials', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
      Authorization: token ? `Bearer ${token}` : undefined
    }
  })
  return response.data
}

export const getMaterials = async (params = {}) => {
  const response = await api.get('/materials', { params })
  return response.data
}

export const getMaterial = async (id) => {
  const response = await api.get('/materials/' + id)
  return response.data
}

export const updateMaterial = async (id, materialData) => {
  const formData = new FormData()

  Object.keys(materialData).forEach(key => {
    if (materialData[key] !== null && materialData[key] !== undefined) {
      if (key === 'photo' && materialData[key] instanceof File) {
        formData.append('photo', materialData[key])
      } else if (key !== 'photo') {
        formData.append(key, materialData[key])
      }
    }
  })

  const response = await api.put('/materials/' + id, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
  return response.data
}

export const deleteMaterial = async (id) => {
  const response = await api.delete('/materials/' + id)
  return response.data
}

export const getProjects = async () => {
  const response = await api.get('/projects')
  return response.data.data || response.data || []
}

export const getPublicProjects = async () => {
  const response = await api.get('/public/projects')
  return response.data
}

export const createProject = async (projectData) => {
  const response = await api.post('/projects', projectData)
  return response.data
}

export const createAdminProject = async (projectData) => {
  const response = await api.post('/admin/projects', projectData)
  return response.data
}

export const deleteProject = async (id) => {
  const response = await api.delete('/projects/' + id)
  return response.data
}

export const updateAdminProject = async (id, projectData) => {
  const response = await api.put('/admin/projects/' + id, projectData)
  return response.data
}

export const deleteAdminProject = async (id) => {
  const response = await api.delete('/admin/projects/' + id)
  return response.data
}

export const exportMaterials = async (params = {}) => {
  const response = await api.get('/export/materials', {
    params: { ...params, format: 'csv' },
    responseType: 'blob'
  })
  return response.data
}

export const getAdminUsers = async () => {
  const response = await api.get('/admin/users')
  return response.data
}

export const updateAdminUser = async (id, userData) => {
  const response = await api.put('/admin/users/' + id, userData)
  return response.data
}

export const getAdminMaterials = async (params = {}) => {
  const response = await api.get('/admin/materials', { params })
  return response.data
}

export const updateAdminMaterial = async (id, materialData) => {
  const formData = new FormData()

  Object.keys(materialData).forEach(key => {
    if (materialData[key] !== null && materialData[key] !== undefined) {
      if (key === 'photo' && materialData[key] instanceof File) {
        formData.append('photo', materialData[key])
      } else if (key !== 'photo') {
        formData.append(key, materialData[key])
      }
    }
  })

  const response = await api.put('/admin/materials/' + id, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
  return response.data
}

export const getStats = async () => {
  const response = await api.get('/stats')
  return response.data
}

export const getAuditLogs = async (params = {}) => {
  const response = await api.get('/admin/audit-logs', { params })
  return response.data
}

export const checkServerHealth = async () => {
  try {
    const response = await api.get('/health', { timeout: 5000 })
    return response.data.status === 'ok'
  } catch {
    return false
  }
}

export default api

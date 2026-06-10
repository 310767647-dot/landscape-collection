import { openDB } from 'idb'
import { fileToBase64, base64ToFile } from './image'

const DB_NAME = 'LandscapeCollectionDB'
const DB_VERSION = 2

export const initDB = async () => {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (!db.objectStoreNames.contains('materials')) {
        const materialStore = db.createObjectStore('materials', { keyPath: 'id' })
        materialStore.createIndex('syncStatus', 'syncStatus')
        materialStore.createIndex('createdAt', 'createdAt')
      } else if (oldVersion < 2) {
        const materialStore = db.transaction('materials').objectStore('materials')
        if (!materialStore.indexNames.contains('syncStatus')) {
          materialStore.createIndex('syncStatus', 'syncStatus')
        }
        if (!materialStore.indexNames.contains('createdAt')) {
          materialStore.createIndex('createdAt', 'createdAt')
        }
      }
      if (!db.objectStoreNames.contains('projects')) {
        db.createObjectStore('projects', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' })
      }
    }
  })
}

export const saveMaterialLocal = async (material) => {
  const photos = []
  
  if (material.photos && Array.isArray(material.photos)) {
    for (const photo of material.photos) {
      if (photo.data) {
        let photoBase64 = photo.data
        if (photo.data instanceof Blob) {
          photoBase64 = await fileToBase64(photo.data)
        }
        photos.push({
          name: photo.name || `photo_${Date.now()}`,
          data: photoBase64,
          type: photo.type || 'image/jpeg'
        })
      }
    }
  }

  const materialWithMeta = {
    ...material,
    photos: photos,
    id: material.id || `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    syncStatus: material.syncStatus || 'pending',
    createdAt: material.createdAt || new Date().toISOString()
  }
  try {
    const db = await initDB()
    await db.put('materials', materialWithMeta)
    return materialWithMeta
  } catch (error) {
    const message = String(error?.message || error)
    if (message.includes('Blob') || message.includes('File') || message.includes('object store')) {
      throw new Error('本地保存失败：当前浏览器环境不支持保存照片到离线存储（建议关闭无痕模式或更换浏览器）')
    }
    throw error
  }
}

export const getLocalMaterials = async () => {
  const db = await initDB()
  return db.getAll('materials')
}

export const getLocalMaterial = async (id) => {
  const db = await initDB()
  return db.get('materials', id)
}

export const updateLocalMaterial = async (material) => {
  const db = await initDB()
  await db.put('materials', { ...material, updatedAt: new Date().toISOString() })
}

export const deleteLocalMaterial = async (id) => {
  const db = await initDB()
  await db.delete('materials', id)
}

export const getPendingMaterials = async () => {
  const db = await initDB()
  return db.getAllFromIndex('materials', 'syncStatus', 'pending')
}

export const markMaterialSyncing = async (id) => {
  const db = await initDB()
  const material = await db.get('materials', id)
  if (material) {
    await db.put('materials', {
      ...material,
      syncStatus: 'syncing'
    })
  }
}

export const markMaterialSynced = async (id, serverId) => {
  const db = await initDB()
  const material = await db.get('materials', id)
  if (material) {
    await db.put('materials', {
      ...material,
      syncStatus: 'synced',
      serverId
    })
  }
}

export const markMaterialSyncFailed = async (id) => {
  const db = await initDB()
  const material = await db.get('materials', id)
  if (material) {
    await db.put('materials', {
      ...material,
      syncStatus: 'pending'
    })
  }
}

export const saveProjectLocal = async (project) => {
  const db = await initDB()
  const projectWithMeta = {
    ...project,
    id: project.id || `proj_${Date.now()}`,
    createdAt: new Date().toISOString()
  }
  await db.put('projects', projectWithMeta)
  return projectWithMeta
}

export const getLocalProjects = async () => {
  const db = await initDB()
  return db.getAll('projects')
}

export const getSetting = async (key) => {
  const db = await initDB()
  const setting = await db.get('settings', key)
  return setting?.value
}

export const setSetting = async (key, value) => {
  const db = await initDB()
  await db.put('settings', { key, value })
}

import { getPendingMaterials, markMaterialSyncing, markMaterialSynced, markMaterialSyncFailed, deleteLocalMaterial, getLocalMaterials } from './db'
import { saveMaterial, getMaterials } from './api'

// 同步状态
let syncInProgress = false
let lastSyncTime = 0
const SYNC_INTERVAL = 30000 // 30秒内不重复同步

// 检查网络状态
export const isOnline = () => {
  return navigator.onLine
}

// 检查服务器是否可用
export const checkServerAvailable = async () => {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    const resp = await fetch('/api/health', { signal: controller.signal })
    clearTimeout(timeoutId)
    return resp.ok
  } catch {
    return false
  }
}

// 比对材料是否已存在于服务器
const checkMaterialExistsOnServer = async (localMaterial, serverMaterials) => {
  // 如果已经有serverId，说明已同步
  if (localMaterial.serverId) {
    return true
  }
  
  // 比对关键字段：项目名称、材料名称、供应商名称、数量、录入时间
  for (const serverMaterial of serverMaterials) {
    if (
      serverMaterial.project_name === localMaterial.project_name &&
      serverMaterial.material_name === localMaterial.material_name &&
      serverMaterial.supplier_name === localMaterial.supplier_name &&
      serverMaterial.quantity === localMaterial.quantity &&
      serverMaterial.arrival_time === localMaterial.arrival_time
    ) {
      return serverMaterial.id // 返回服务器ID，用于标记已同步
    }
  }
  
  return false
}

// 同步单个材料
const syncSingleMaterial = async (material) => {
  try {
    // 标记为正在同步
    await markMaterialSyncing(material.id)
    
    const result = await saveMaterial({
      project_name: material.project_name,
      material_name: material.material_name,
      supplier_name: material.supplier_name,
      specifications: material.specifications,
      quantity: material.quantity,
      unit: material.unit,
      arrival_time: material.arrival_time,
      ocr_text: material.ocr_text,
      photos: material.photos || []
    })
    
    if (result.success) {
      // 标记为已同步，保存服务器ID
      await markMaterialSynced(material.id, result.id || result.material?.id)
      return { success: true, id: material.id }
    } else {
      await markMaterialSyncFailed(material.id)
      return { success: false, id: material.id, error: result.error }
    }
  } catch (error) {
    await markMaterialSyncFailed(material.id)
    return { success: false, id: material.id, error: error.message }
  }
}

// 执行同步
export const performSync = async (options = {}) => {
  const { force = false, silent = false } = options
  
  // 检查是否可以同步
  if (!isOnline()) {
    return { success: false, reason: 'offline', message: '网络不可用' }
  }
  
  // 防止重复同步
  if (!force && syncInProgress) {
    return { success: false, reason: 'in_progress', message: '同步正在进行中' }
  }
  
  if (!force && Date.now() - lastSyncTime < SYNC_INTERVAL) {
    return { success: false, reason: 'too_frequent', message: '同步间隔太短' }
  }
  
  syncInProgress = true
  
  try {
    // 获取待同步材料
    const pendingMaterials = await getPendingMaterials()
    
    if (pendingMaterials.length === 0) {
      syncInProgress = false
      lastSyncTime = Date.now()
      return { success: true, synced: 0, message: '没有待同步的记录' }
    }
    
    // 获取服务器材料列表用于比对
    let serverMaterials = []
    try {
      const serverData = await getMaterials()
      serverMaterials = serverData?.materials || []
    } catch (e) {
      console.warn('获取服务器材料列表失败，将直接同步:', e)
    }
    
    const results = {
      synced: 0,
      skipped: 0,
      failed: 0,
      details: []
    }
    
    for (const material of pendingMaterials) {
      // 检查是否已同步（比对）
      const existsResult = await checkMaterialExistsOnServer(material, serverMaterials)
      
      if (existsResult === true || typeof existsResult === 'string') {
        // 已存在于服务器，标记为已同步
        const serverId = typeof existsResult === 'string' ? existsResult : material.serverId
        await markMaterialSynced(material.id, serverId)
        results.skipped++
        results.details.push({ id: material.id, status: 'skipped', reason: 'already_exists' })
        continue
      }
      
      // 执行同步
      const syncResult = await syncSingleMaterial(material)
      
      if (syncResult.success) {
        results.synced++
        results.details.push({ id: material.id, status: 'synced' })
      } else {
        results.failed++
        results.details.push({ id: material.id, status: 'failed', error: syncResult.error })
      }
    }
    
    syncInProgress = false
    lastSyncTime = Date.now()
    
    return {
      success: true,
      ...results,
      message: `同步完成：成功 ${results.synced} 条，跳过 ${results.skipped} 条，失败 ${results.failed} 条`
    }
  } catch (error) {
    syncInProgress = false
    return { success: false, reason: 'error', message: error.message }
  }
}

// 获取待同步数量
export const getPendingCount = async () => {
  try {
    const pending = await getPendingMaterials()
    return pending.length
  } catch {
    return 0
  }
}

// 监听网络恢复事件
export const setupNetworkListener = (onSyncCallback) => {
  const handleOnline = async () => {
    console.log('网络已恢复，检查是否需要同步...')
    const count = await getPendingCount()
    if (count > 0) {
      console.log(`发现 ${count} 条待同步记录，开始自动同步`)
      const result = await performSync({ silent: true })
      if (onSyncCallback && result.success) {
        onSyncCallback(result)
      }
    }
  }
  
  window.addEventListener('online', handleOnline)
  
  return () => {
    window.removeEventListener('online', handleOnline)
  }
}

// 清理已同步的本地记录（可选，保留一段时间后清理）
export const cleanupSyncedMaterials = async (daysToKeep = 7) => {
  try {
    const allMaterials = await getLocalMaterials()
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
    
    for (const material of allMaterials) {
      if (material.syncStatus === 'synced' && material.serverId) {
        const syncedAt = new Date(material.updatedAt || material.createdAt)
        if (syncedAt < cutoffDate) {
          await deleteLocalMaterial(material.id)
          console.log(`清理已同步记录: ${material.id}`)
        }
      }
    }
  } catch (error) {
    console.error('清理同步记录失败:', error)
  }
}

export default {
  isOnline,
  checkServerAvailable,
  performSync,
  getPendingCount,
  setupNetworkListener,
  cleanupSyncedMaterials
}
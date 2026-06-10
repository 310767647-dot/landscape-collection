import Tesseract from 'tesseract.js'

const preprocessImage = (imageFile) => {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const targetWidth = Math.min(img.width, 1000)
        const targetHeight = Math.min(img.height, 1500)
        const scale = Math.min(targetWidth / img.width, targetHeight / img.height)
        
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(new File([blob], imageFile.name, { type: 'image/png' }))
          } else {
            resolve(imageFile)
          }
        }, 'image/png', 0.95)
      }
      img.onerror = () => resolve(imageFile)
      img.src = e.target.result
    }
    reader.onerror = () => resolve(imageFile)
    reader.readAsDataURL(imageFile)
  })
}

const cleanText = (text) => {
  if (!text) return ''
  
  let cleaned = text
  
  cleaned = cleaned.replace(/[\u0000-\u001F\uFFFD]/g, '')
  
  const garbagePatterns = [
    /[BikH|EE|MM|囯|辣|民|读|區|站|焉|馬|卞|掐|癌|轴|阎|葵|Es|IEEE|ED|隨|zl|ey|Ook|Tebw]/g,
    /\b[eE][oO][lL]\b/g,
    /\b[zZ][wW][gG][xX][kK][kK]\b/g,
    /\b[wW][lL][eE]\b/g,
  ]
  
  for (const pattern of garbagePatterns) {
    cleaned = cleaned.replace(pattern, '')
  }
  
  cleaned = cleaned.replace(/[^\u4e00-\u9fa5a-zA-Z0-9.\s×xX一二三四五六七八九十百千万亿零/:：;；,，。、\-_()【】（）]/g, '')
  
  const lines = cleaned.split('\n')
  const filteredLines = lines.filter(line => {
    const trimmed = line.trim()
    if (trimmed.length === 0) return false
    if (trimmed.length <= 1) return false
    
    const hasChinese = /[\u4e00-\u9fa5]/.test(trimmed)
    const hasNumber = /[0-9]/.test(trimmed)
    const hasLetter = /[a-zA-Z]/.test(trimmed)
    
    if (hasLetter && !hasChinese && !hasNumber) {
      const validWords = ['Qty', 'NO', 'ID', 'kg', 'KG', 'm', 'cm', 'mm', 'm2', 'M2', 'm³', 'PCS', 'pcs', 'PC', 'pc', '个', '件', '批', '套', '箱', '袋', '米', '千克', '吨']
      const lineLower = trimmed.toLowerCase()
      const hasValidWord = validWords.some(w => lineLower.includes(w.toLowerCase()))
      return hasValidWord
    }
    
    return hasChinese || hasNumber || trimmed.length >= 6
  })
  
  return filteredLines.join('\n')
}

const extractDeliveryInfo = (text) => {
  const info = {
    supplierName: '',
    orderNo: '',
    date: '',
    projectName: ''
  }
  
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  
  const supplierPatterns = [
    /供应商[\s：:]+(.+)/,
    /供货单位[\s：:]+(.+)/,
    /公司名称[\s：:]+(.+)/,
    /单位[\s：:]+(.+)/,
    /(.+公司)/,
    /(.+有限公司)/
  ]
  
  const orderPatterns = [
    /编号[\s：:]+(.+)/,
    /单号[\s：:]+(.+)/,
    /订单号[\s：:]+(.+)/,
    /送货单号[\s：:]+(.+)/,
    /NO[\s：:]+(.+)/i
  ]
  
  const datePatterns = [
    /日期[\s：:]+(.+)/,
    /到货日期[\s：:]+(.+)/,
    /送货日期[\s：:]+(.+)/,
    /(\d{4}[\-/年]\d{1,2}[\-/月]\d{1,2}[日号]?)/,
    /(\d{2}[\-/年]\d{1,2}[\-/月]\d{1,2}[日号]?)/
  ]
  
  const projectPatterns = [
    /工程名称[\s：:]+(.+)/,
    /项目名称[\s：:]+(.+)/,
    /工地[\s：:]+(.+)/,
    /施工[\s：:]+(.+)/
  ]
  
  for (const line of lines) {
    for (const pattern of supplierPatterns) {
      const match = line.match(pattern)
      if (match && match[1] && !info.supplierName) {
        info.supplierName = match[1].trim().replace(/[,，。、]$/, '')
        break
      }
    }
    
    for (const pattern of orderPatterns) {
      const match = line.match(pattern)
      if (match && match[1] && !info.orderNo) {
        info.orderNo = match[1].trim().replace(/[,，。、]$/, '')
        break
      }
    }
    
    for (const pattern of datePatterns) {
      const match = line.match(pattern)
      if (match && match[1] && !info.date) {
        info.date = match[1].trim().replace(/[,，。、]$/, '')
        break
      }
    }
    
    for (const pattern of projectPatterns) {
      const match = line.match(pattern)
      if (match && match[1] && !info.projectName) {
        info.projectName = match[1].trim().replace(/[,，。、]$/, '')
        break
      }
    }
  }
  
  return info
}

const extractMaterialsFromText = (text) => {
  const materials = []
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  
  const unitKeywords = ['个', '件', '批', '套', '箱', '袋', '米', '千克', 'kg', 'KG', 'm', 'cm', 'mm', 'm2', 'M2', 'm³', 'PCS', 'pcs', 'PC', 'pc', '吨', '支', '根', '卷', '块', '片', '瓶', '桶', '包']
  const ignoreKeywords = ['合计', '总计', '金额', '大写', '小写', '备注', '签名', '审核', '批准', '收货人']
  
  let currentMaterial = null
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    
    const hasIgnoreKeyword = ignoreKeywords.some(k => line.includes(k))
    if (hasIgnoreKeyword) {
      if (currentMaterial && currentMaterial.materialName) {
        materials.push(currentMaterial)
      }
      currentMaterial = null
      continue
    }
    
    const numberMatch = line.match(/(\d+(?:\.\d+)?)\s*([a-zA-Z\u4e00-\u9fa5]*)$/)
    const hasNumber = /\d+/.test(line)
    const hasChinese = /[\u4e00-\u9fa5]/.test(line)
    
    if (hasChinese || hasNumber) {
      if (!currentMaterial) {
        currentMaterial = {
          materialName: '',
          specifications: '',
          quantity: '',
          unit: ''
        }
      }
      
      if (numberMatch && numberMatch[1]) {
        currentMaterial.quantity = numberMatch[1]
        if (numberMatch[2]) {
          const potentialUnit = numberMatch[2].trim()
          if (potentialUnit && unitKeywords.some(u => potentialUnit.includes(u))) {
            currentMaterial.unit = potentialUnit
          }
        }
      }
      
      const cleanedLine = line.replace(/\d+(?:\.\d+)?\s*[a-zA-Z\u4e00-\u9fa5]*$/, '').trim()
      if (cleanedLine && cleanedLine.length > 0) {
        if (!currentMaterial.materialName) {
          currentMaterial.materialName = cleanedLine
        } else {
          currentMaterial.specifications += (currentMaterial.specifications ? ' ' : '') + cleanedLine
        }
      }
      
      const nextLine = lines[i + 1] || ''
      if (!nextLine.includes(' ') && nextLine.length < 20 && /\d+/.test(nextLine)) {
        currentMaterial.specifications += (currentMaterial.specifications ? ' ' : '') + nextLine.trim()
        i++
      }
    } else if (currentMaterial && currentMaterial.materialName) {
      materials.push(currentMaterial)
      currentMaterial = null
    }
  }
  
  if (currentMaterial && currentMaterial.materialName) {
    materials.push(currentMaterial)
  }
  
  return materials.filter(m => m.materialName && m.materialName.length >= 2)
}

export const recognizeText = async (imageFile, onProgress) => {
  try {
    console.log('Starting OCR with image:', imageFile.name, imageFile.size)
    
    const preprocessedImage = await preprocessImage(imageFile)
    console.log('Preprocessing completed')
    
    if (onProgress) onProgress(10)
    
    const result = await Tesseract.recognize(preprocessedImage, 'chi_sim', {
      logger: m => {
        if (m.status === 'recognizing text' && onProgress) {
          onProgress(Math.round(m.progress * 80) + 10)
        } else if (m.status === 'loading tesseract core') {
          if (onProgress) onProgress(15)
        } else if (m.status === 'loading language traineddata') {
          if (onProgress) onProgress(25)
        } else if (m.status === 'initializing api') {
          if (onProgress) onProgress(30)
        }
      },
      preserve_interword_spaces: '2',
      tessedit_char_whitelist: '0123456789.×xX一二三四五六七八九十百千万亿零壹贰叁肆伍陆柒捌玖拾佰仟\u4e00-\u9fa5ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz/:：;；,，。、\-_()【】（） ',
      load_system_dawg: 0,
      load_freq_dawg: 0,
      load_unambig_dawg: 0,
      load_punc_dawg: 0,
      load_number_dawg: 0,
      load_fixed_length_dawgs: 0,
      page_seg_mode: 6,
      tessedit_pageseg_mode: 6,
    })
    
    if (onProgress) onProgress(100)
    
    const rawText = result.data.text || ''
    const cleanedText = cleanText(rawText)
    const confidence = result.data.confidence || 0
    
    console.log('OCR completed, text length:', cleanedText.length, 'confidence:', confidence)
    
    if (!cleanedText.trim() || cleanedText.trim().length < 5) {
      return {
        success: false,
        text: '',
        rawText: rawText,
        confidence: 0,
        error: '未能识别到文本'
      }
    }
    
    const deliveryInfo = extractDeliveryInfo(cleanedText)
    const materials = extractMaterialsFromText(cleanedText)
    
    return {
      success: true,
      text: cleanedText,
      rawText: rawText,
      confidence: confidence,
      deliveryInfo: deliveryInfo,
      materials: materials
    }
  } catch (error) {
    console.error('OCR Error:', error)
    let errorMessage = error.message || '识别失败'
    
    if (error.message && error.message.includes('Timeout')) {
      errorMessage = '识别超时，请重试'
    } else if (error.message && error.message.includes('fetch')) {
      errorMessage = '网络请求失败'
    } else if (error.message && error.message.includes('load')) {
      errorMessage = '识别引擎加载失败'
    }
    
    return {
      success: false,
      text: '',
      rawText: '',
      confidence: 0,
      error: errorMessage
    }
  }
}

export const parseDeliveryNote = (text) => {
  const cleanedText = cleanText(text)
  const deliveryInfo = extractDeliveryInfo(cleanedText)
  const materials = extractMaterialsFromText(cleanedText)
  
  return {
    materials: materials.map(m => ({
      materialName: m.materialName,
      specifications: m.specifications,
      quantity: m.quantity,
      unit: m.unit,
      supplierName: deliveryInfo.supplierName
    })),
    supplierName: deliveryInfo.supplierName,
    orderNo: deliveryInfo.orderNo,
    date: deliveryInfo.date,
    projectName: deliveryInfo.projectName
  }
}

export const generateMockMaterials = () => {
  const mockData = [
    { materialName: '水泥', specifications: 'PO42.5', quantity: '50', unit: '吨' },
    { materialName: '钢筋', specifications: 'HRB400 16mm', quantity: '12', unit: '吨' },
    { materialName: '砂石', specifications: '中砂', quantity: '80', unit: '立方米' },
    { materialName: '砖块', specifications: 'MU10 240×115×53', quantity: '10000', unit: '块' },
    { materialName: '防水涂料', specifications: 'JS聚合物', quantity: '20', unit: '桶' },
  ]
  
  return {
    materials: mockData,
    supplierName: '示例供应商',
    orderNo: 'PO-2024001',
    date: '2024-01-15',
    projectName: '示例工程项目'
  }
}

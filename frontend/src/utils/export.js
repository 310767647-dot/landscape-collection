import * as XLSX from 'xlsx'

const getPhotoCount = (m) => {
  if (m.photos && Array.isArray(m.photos)) {
    return m.photos.length
  }
  if (m.photo) {
    return 1
  }
  if (m.photo_path) {
    return m.photo_path.split(',').filter(p => p.trim()).length
  }
  return 0
}

const getPhotoInfo = (m) => {
  const count = getPhotoCount(m)
  if (count === 0) return ''
  if (count === 1) return '1张照片'
  return `${count}张照片`
}

export const exportToExcel = (materials, filename = 'materials.xlsx') => {
  const data = materials.map(m => ({
    '项目名称': m.project_name || '',
    '材料名称': m.material_name,
    '供应商': m.supplier_name || '',
    '规格': m.specifications || '',
    '数量': m.quantity || '',
    '单位': m.unit || '',
    '到货时间': m.arrival_time || '',
    '照片': getPhotoInfo(m),
    '创建时间': m.created_at || ''
  }))

  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '材料数据')

  const colWidths = [
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
    { wch: 20 },
    { wch: 10 },
    { wch: 10 },
    { wch: 20 },
    { wch: 12 },
    { wch: 20 }
  ]
  ws['!cols'] = colWidths

  XLSX.writeFile(wb, filename)
}

export const exportToCSV = (materials) => {
  const headers = ['项目名称', '材料名称', '供应商', '规格', '数量', '单位', '到货时间', '照片', '创建时间']
  const rows = materials.map(m => [
    m.project_name || '',
    m.material_name,
    m.supplier_name || '',
    m.specifications || '',
    m.quantity || '',
    m.unit || '',
    m.arrival_time || '',
    getPhotoInfo(m),
    m.created_at || ''
  ])

  let csvContent = '\ufeff'
  csvContent += headers.join(',') + '\n'

  rows.forEach(row => {
    csvContent += row.map(cell => {
      const str = String(cell)
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }).join(',') + '\n'
  })

  return csvContent
}

export const downloadFile = (content, filename, mimeType) => {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export const shareViaWebShare = async (materials) => {
  const csvContent = exportToCSV(materials)
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' })
  const file = new File([blob], 'materials.csv', { type: 'text/csv;charset=utf-8' })

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title: '市政景观材料数据',
        text: '现场材料采集数据',
        files: [file]
      })
      return { success: true, method: 'web-share' }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Web Share failed:', error)
      }
      return { success: false, error: error.message }
    }
  }

  return { success: false, error: 'Web Share not supported' }
}

export const getShareUrl = (materials) => {
  const csvContent = exportToCSV(materials)
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' })
  return URL.createObjectURL(blob)
}
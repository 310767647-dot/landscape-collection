import React from 'react'

function ConfirmModal({ show, title, message, onConfirm, onCancel }) {
  if (!show) return null

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 24,
        margin: '0 20px',
        maxWidth: 320,
        width: '100%',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)'
      }}>
        <h3 style={{
          fontSize: 18,
          fontWeight: 600,
          marginBottom: 12,
          textAlign: 'center',
          color: '#333'
        }}>
          {title}
        </h3>
        <p style={{
          fontSize: 14,
          color: '#666',
          marginBottom: 20,
          textAlign: 'center'
        }}>
          {message}
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: 8,
              backgroundColor: 'white',
              color: '#666',
              fontSize: 14,
              cursor: 'pointer'
            }}
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: '10px',
              border: 'none',
              borderRadius: 8,
              backgroundColor: '#667eea',
              color: 'white',
              fontSize: 14,
              cursor: 'pointer'
            }}
          >
            确定
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmModal

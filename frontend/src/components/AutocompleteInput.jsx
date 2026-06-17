import React, { useState, useRef, useEffect } from 'react'

function AutocompleteInput({ value, onChange, options, placeholder, style }) {
  const [inputValue, setInputValue] = useState(value || '')
  const [showDropdown, setShowDropdown] = useState(false)
  const [filteredOptions, setFilteredOptions] = useState(options)
  const containerRef = useRef(null)

  useEffect(() => {
    setInputValue(value || '')
  }, [value])

  useEffect(() => {
    if (!inputValue) {
      setFilteredOptions(options)
    } else {
      const lower = inputValue.toLowerCase()
      setFilteredOptions(
        options.filter(opt => opt.toLowerCase().includes(lower))
      )
    }
  }, [inputValue, options])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleInputChange = (e) => {
    const val = e.target.value
    setInputValue(val)
    onChange(val)
    setShowDropdown(true)
  }

  const handleSelect = (opt) => {
    setInputValue(opt)
    onChange(opt)
    setShowDropdown(false)
  }

  const handleFocus = () => {
    if (options.length > 0) setShowDropdown(true)
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', ...style }}>
      <input
        type="text"
        className="form-input"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        placeholder={placeholder}
        style={{ paddingRight: 30, boxSizing: 'border-box', width: '100%' }}
      />
      <span
        style={{
          position: 'absolute',
          right: 10,
          top: '50%',
          transform: 'translateY(-50%)',
          color: '#999',
          fontSize: 11,
          pointerEvents: 'none'
        }}
      >
        ▼
      </span>
      {showDropdown && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: 'white',
            border: '1px solid #ddd',
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            zIndex: 200,
            maxHeight: 200,
            overflowY: 'auto',
            marginTop: 2
          }}
        >
          {filteredOptions.length === 0 ? (
            <div style={{ padding: 10, textAlign: 'center', color: '#999', fontSize: 13 }}>
              无匹配选项
            </div>
          ) : (
            filteredOptions.map((opt, idx) => (
              <div
                key={idx}
                onClick={() => handleSelect(opt)}
                style={{
                  padding: '10px 12px',
                  cursor: 'pointer',
                  fontSize: 13,
                  borderBottom: idx < filteredOptions.length - 1 ? '1px solid #f0f0f0' : 'none',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.background = '#f5f5f5'}
                onMouseLeave={(e) => e.target.style.background = 'white'}
              >
                {opt}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default AutocompleteInput

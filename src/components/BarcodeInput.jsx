import { useState, useRef, useEffect } from 'react'
import { ScanBarcode } from 'lucide-react'

/**
 * Input visible para ingresar código de barras manualmente o al recibir escáner.
 *
 * Usa data-barcode-input para que el listener global NO lo ignore
 * (el hook useBarcodeScanner revisa este atributo).
 *
 * Props:
 * - onSubmit(codigo): se dispara al presionar Enter o al recibir escaneo
 * - autoFocus: boolean (por defecto true)
 * - placeholder: string
 */
export default function BarcodeInput({
  onSubmit,
  autoFocus = true,
  placeholder = 'Escanea o escribe código de barras...',
  className = '',
}) {
  const [value, setValue] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus()
    }
  }, [autoFocus])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const codigo = value.trim()
      if (codigo.length >= 4) {
        onSubmit(codigo)
        setValue('')
      }
    }
  }

  return (
    <div className={`relative ${className}`}>
      <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-primary-600" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        data-barcode-input="true"
        className="input pl-10 pr-4 py-3 text-base font-mono border-2 border-primary-200 focus:border-primary-500"
        autoComplete="off"
        inputMode="text"
      />
    </div>
  )
}

import { useEffect, useRef } from 'react'

/**
 * Hook que detecta escaneos de código de barras de lectores HID.
 *
 * Un escáner HID emula un teclado: envía caracteres muy rápido (< 100ms)
 * y termina con Enter. Este hook distingue escáner (ráfaga) de humano (lento)
 * y llama a onScan(codigo) cuando detecta una ráfaga completa.
 *
 * Comportamiento:
 * - Ignora caracteres cuando hay <input>, <textarea> o <select> con foco,
 *   EXCEPTO si tiene el atributo data-barcode-input="true".
 * - Si las teclas están separadas por más de maxInterval ms, reinicia el buffer
 *   (asume entrada humana).
 *
 * Firma flexible:
 *   useBarcodeScanner(callback)
 *   useBarcodeScanner(callback, enabledBoolean)
 *   useBarcodeScanner(callback, { enabled, minLength, maxInterval })
 */
export function useBarcodeScanner(onScan, optionsOrEnabled = true) {
  // Normalizar argumentos
  const options = typeof optionsOrEnabled === 'boolean'
    ? { enabled: optionsOrEnabled }
    : optionsOrEnabled

  const {
    enabled = true,
    minLength = 4,
    maxInterval = 100,
  } = options

  const bufferRef = useRef('')
  const lastKeyTimeRef = useRef(0)

  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e) => {
      // Si hay un campo editable enfocado, no interceptar…
      const tag = document.activeElement?.tagName
      const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
      if (isEditable) {
        // …excepto si el input opta-in con data-barcode-input
        if (!document.activeElement.hasAttribute('data-barcode-input')) {
          return
        }
      }

      const now = Date.now()
      const delta = now - lastKeyTimeRef.current

      // Pausa larga → reiniciar buffer (era humano tipeando)
      if (delta > maxInterval && bufferRef.current.length > 0) {
        bufferRef.current = ''
      }

      if (e.key === 'Enter') {
        const codigo = bufferRef.current.trim()
        bufferRef.current = ''
        if (codigo.length >= minLength) {
          e.preventDefault()
          onScan(codigo)
        }
        return
      }

      // Solo caracteres imprimibles de 1 char
      if (e.key.length === 1) {
        bufferRef.current += e.key
        lastKeyTimeRef.current = now
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onScan, enabled, minLength, maxInterval])
}

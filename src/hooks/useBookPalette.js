import { useEffect, useState } from 'react'

function extractColor(imgEl) {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 8
    canvas.height = 8
    const ctx = canvas.getContext('2d')
    ctx.drawImage(imgEl, 0, 0, 8, 8)
    const data = ctx.getImageData(0, 0, 8, 8).data
    let r = 0, g = 0, b = 0
    const n = data.length / 4
    for (let i = 0; i < data.length; i += 4) {
      r += data[i]; g += data[i + 1]; b += data[i + 2]
    }
    const result = { r: r / n | 0, g: g / n | 0, b: b / n | 0 }
    console.log('extracted color:', result)
    return result
  } catch (err) {
    console.error('extractColor failed:', err)
    return { r: 245, g: 197, b: 24 }
  }
}

export function useBookPalette(coverSrc) {
  const [rgb, setRgb] = useState({ r: 245, g: 197, b: 24 })

  useEffect(() => {
    if (!coverSrc) return
    let cancelled = false

    const img = new Image()

    const handleLoad = () => {
      if (!cancelled) setRgb(extractColor(img))
    }

    img.onload = handleLoad
    img.onerror = () => {
      if (!cancelled) setRgb({ r: 245, g: 197, b: 24 })
    }

    img.src = coverSrc

    if (img.complete && img.naturalWidth > 0) {
      handleLoad()
    }

    return () => { cancelled = true }
  }, [coverSrc])

  return rgb
}
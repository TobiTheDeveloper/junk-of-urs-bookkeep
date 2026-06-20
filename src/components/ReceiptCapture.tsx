import { useRef } from 'react'
import { Camera, ImagePlus, X } from 'lucide-react'

interface ReceiptCaptureProps {
  preview?: string | null
  onCapture: (dataUrl: string, mimeType: string, fileName: string) => void
  onClear: () => void
}

export function ReceiptCapture({ preview, onCapture, onClear }: ReceiptCaptureProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const handleFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onCapture(reader.result, file.type || 'image/jpeg', file.name)
      }
    }
    reader.onerror = () => {
      console.error('Could not read receipt image')
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="space-y-3">
      {preview ? (
        <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-800">
          <img src={preview} alt="Receipt preview" className="w-full max-h-48 object-contain" />
          <button
            type="button"
            onClick={onClear}
            className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-600 bg-slate-800/50 p-4 hover:border-brand-500 hover:bg-slate-800 transition-colors"
          >
            <Camera size={24} className="text-brand-400" />
            <span className="text-sm text-slate-300">Take Photo</span>
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-600 bg-slate-800/50 p-4 hover:border-brand-500 hover:bg-slate-800 transition-colors"
          >
            <ImagePlus size={24} className="text-brand-400" />
            <span className="text-sm text-slate-300">Upload</span>
          </button>
        </div>
      )}

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
          e.target.value = ''
        }}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}

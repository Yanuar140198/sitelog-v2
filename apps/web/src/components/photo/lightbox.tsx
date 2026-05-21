'use client';
import { useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

export interface LightboxPhoto {
  url: string | null;
  caption?: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
  takenAt?: Date | string | null;
}

export function Lightbox({
  photos, startIndex = 0, onClose,
}: { photos: LightboxPhoto[]; startIndex?: number; onClose: () => void }) {
  const [i, setI] = useState(startIndex);
  const cur = photos[i];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') setI(x => Math.min(photos.length - 1, x + 1));
      else if (e.key === 'ArrowLeft') setI(x => Math.max(0, x - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [photos.length, onClose]);

  if (!cur) return null;

  return (
    <div className="fixed inset-0 bg-black/95 z-[100] flex flex-col" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <header className="flex justify-between items-center p-4 text-white font-mono text-xs">
        <div>{i + 1} / {photos.length}</div>
        <button onClick={onClose} className="p-2 hover:bg-white/20"><X size={20} /></button>
      </header>
      <div className="flex-1 flex items-center justify-center relative">
        {i > 0 && (
          <button onClick={() => setI(i - 1)} className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-[var(--color-brand)] text-white p-3">
            <ChevronLeft size={24} />
          </button>
        )}
        {cur.url ? (
          <img src={cur.url} alt={cur.caption ?? ''} className="max-h-full max-w-full object-contain" />
        ) : (
          <div className="text-white/50 font-mono text-sm">Image not available</div>
        )}
        {i < photos.length - 1 && (
          <button onClick={() => setI(i + 1)} className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-[var(--color-brand)] text-white p-3">
            <ChevronRight size={24} />
          </button>
        )}
      </div>
      {(cur.caption || cur.lat) && (
        <footer className="p-4 text-white font-mono text-xs text-center">
          {cur.caption && <div className="mb-1">{cur.caption}</div>}
          {cur.lat && <div className="text-white/60">{cur.lat}, {cur.lng}</div>}
        </footer>
      )}
    </div>
  );
}

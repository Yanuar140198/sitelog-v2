'use client';
/**
 * Tiny i18n — namespace dict + React hook + locale switcher.
 * No external dep. Two languages: en, id.
 */
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export type Locale = 'en' | 'id';

const DICT: Record<Locale, Record<string, string>> = {
  en: {
    'nav.dashboard': 'Dashboard',
    'nav.projects': 'Projects',
    'nav.boq': 'BOQ Editor',
    'nav.fleet': 'Fleet',
    'nav.entries': 'Daily Entries',
    'nav.analytics': 'Analytics',
    'nav.ai': 'AI Assistant',
    'nav.audit': 'Audit Log',
    'nav.settings': 'Settings',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.create': 'Create',
    'common.loading': 'Loading...',
    'common.empty': 'No data',
    'landing.eyebrow': 'CONSTRUCTION SAAS · v2',
    'landing.heroTitle': 'Build BOQ. Track production. Hit your numbers.',
    'landing.heroSub': 'End-to-end SaaS for civil construction: AHSP-based detailed BOQ engine, field daily reporting via mobile, live SPI/CPI dashboards across portfolio.',
    'landing.cta.trial': 'START 14-DAY FREE TRIAL',
    'landing.cta.pricing': 'VIEW PRICING',
    'auth.signin': 'Sign In',
    'auth.signup': 'Create Account',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'boq.subtotal': 'Subtotal',
    'boq.grandTotal': 'Grand Total',
    'boq.markup': 'Markup',
    'boq.contingency': 'Contingency',
    'boq.ppn': 'PPN',
  },
  id: {
    'nav.dashboard': 'Dashboard',
    'nav.projects': 'Proyek',
    'nav.boq': 'Editor BOQ',
    'nav.fleet': 'Alat Berat',
    'nav.entries': 'Laporan Harian',
    'nav.analytics': 'Analitik',
    'nav.ai': 'Asisten AI',
    'nav.audit': 'Log Audit',
    'nav.settings': 'Pengaturan',
    'common.save': 'Simpan',
    'common.cancel': 'Batal',
    'common.delete': 'Hapus',
    'common.create': 'Buat',
    'common.loading': 'Memuat...',
    'common.empty': 'Tidak ada data',
    'landing.eyebrow': 'SAAS KONSTRUKSI · v2',
    'landing.heroTitle': 'Buat BOQ. Pantau produksi. Capai target.',
    'landing.heroSub': 'SaaS end-to-end untuk konstruksi sipil: engine BOQ detail berbasis AHSP, laporan harian via mobile, dashboard SPI/CPI live cross-project.',
    'landing.cta.trial': 'COBA GRATIS 14 HARI',
    'landing.cta.pricing': 'LIHAT HARGA',
    'auth.signin': 'Masuk',
    'auth.signup': 'Buat Akun',
    'auth.email': 'Email',
    'auth.password': 'Kata Sandi',
    'boq.subtotal': 'Subtotal',
    'boq.grandTotal': 'Total Akhir',
    'boq.markup': 'Markup',
    'boq.contingency': 'Kontingensi',
    'boq.ppn': 'PPN',
  },
};

const Ctx = createContext<{ locale: Locale; setLocale: (l: Locale) => void; t: (k: string) => string }>({
  locale: 'id', setLocale: () => {}, t: (k) => k,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('id');
  useEffect(() => {
    const saved = localStorage.getItem('sl_locale') as Locale | null;
    if (saved === 'en' || saved === 'id') setLocaleState(saved);
  }, []);
  function setLocale(l: Locale) {
    setLocaleState(l);
    if (typeof window !== 'undefined') localStorage.setItem('sl_locale', l);
  }
  const t = (key: string) => DICT[locale][key] ?? DICT.en[key] ?? key;
  return <Ctx.Provider value={{ locale, setLocale, t }}>{children}</Ctx.Provider>;
}

export function useI18n() { return useContext(Ctx); }

export function LocaleSwitcher() {
  const { locale, setLocale } = useI18n();
  return (
    <div className="inline-flex border-2 border-[var(--color-ink)] font-mono text-[10px] tracking-wider">
      {(['id', 'en'] as Locale[]).map(l => (
        <button key={l} onClick={() => setLocale(l)}
          className={`px-2 py-1 ${locale === l ? 'bg-[var(--color-ink)] text-white' : 'hover:bg-neutral-100'}`}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

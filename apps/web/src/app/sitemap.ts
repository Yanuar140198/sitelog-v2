import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_WEB_URL ?? 'https://sitelog.app';
  return [
    { url: `${base}/`,        changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${base}/pricing`, changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${base}/login`,   changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/signup`,  changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/status`,  changeFrequency: 'daily',   priority: 0.6 },
  ];
}

import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Transactions Dashboard',
    short_name: 'Gastos',
    description: 'Private household spending dashboard',
    start_url: '/',
    display: 'standalone',
    background_color: '#f3f5f7',
    theme_color: '#137fec',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any'
      }
    ]
  };
}

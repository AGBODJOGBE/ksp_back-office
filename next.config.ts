import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV !== 'production';
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

/**
 * Politique de sécurité du contenu : le navigateur ne parle qu'au site lui-même et à la gateway.
 * À durcir (nonce sur les scripts) quand les pages définitives seront en place.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${apiUrl}${isDev ? ' ws:' : ''}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  // Outil interne : jamais indexé, même si une adresse fuite.
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
  ...(isDev ? [] : [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]),
];

const nextConfig: NextConfig = {
  // Image Docker minimale : seul le serveur autonome et ses dépendances sont copiés.
  output: 'standalone',
  poweredByHeader: false,
  // Empêche `next dev` d'ajouter des blocs générés aux fichiers de documentation locaux.
  agentRules: false,
  reactStrictMode: true,
  images: {
    // Images servies par le stockage S3 (service file) et le CMS : domaines à compléter au déploiement.
    remotePatterns: [{ protocol: 'https', hostname: '**.ksp.bj' }],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;

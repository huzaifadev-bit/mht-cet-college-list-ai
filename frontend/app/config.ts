// Production backend hosted on Railway (always online, no PC needed)
const RAILWAY_BACKEND_URL = 'https://mhtcet-backend-production.up.railway.app';

// Use env var if set (from Vercel dashboard), otherwise fall back to hardcoded Railway URL
const PROD_BACKEND = process.env.NEXT_PUBLIC_API_URL || RAILWAY_BACKEND_URL;

export const API_BASE_URL = typeof window !== 'undefined'
  ? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:8000'
      : PROD_BACKEND)
  : PROD_BACKEND;

// Production backend hosted on Render (24/7 online)
const RENDER_BACKEND_URL = 'https://mhtcet-backend-j8wq.onrender.com';

// Use env var if set (from Vercel dashboard), otherwise fall back to hardcoded Render URL
const PROD_BACKEND = process.env.NEXT_PUBLIC_API_URL || RENDER_BACKEND_URL;

export const API_BASE_URL = typeof window !== 'undefined'
  ? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:8000'
      : PROD_BACKEND)
  : PROD_BACKEND;

'use strict';

// Return only the browser-safe Supabase configuration. Never use a secret key.
module.exports = function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    || process.env.SUPABASE_PUBLISHABLE_KEY
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    || process.env.SUPABASE_ANON_KEY
    || process.env.VITE_SUPABASE_PUBLISHABLE_KEY
    || process.env.VITE_SUPABASE_ANON_KEY;

  let safeKey = Boolean(publishableKey?.startsWith('sb_publishable_'));
  if (publishableKey?.startsWith('eyJ')) {
    try {
      safeKey = JSON.parse(Buffer.from(publishableKey.split('.')[1], 'base64url').toString()).role === 'anon';
    } catch { safeKey = false; }
  }
  let safeUrl = false;
  try { safeUrl = new URL(url).protocol === 'https:'; } catch { /* Missing or invalid configuration. */ }
  if (!safeUrl || !safeKey) {
    return res.status(503).json({ error: 'Supabase public configuration is missing or invalid' });
  }
  return res.status(200).json({ url, publishableKey });
};

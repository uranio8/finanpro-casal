const SUPABASE_CONFIG_KEY = 'finanpro_supabase_config_v1';

export const SUPABASE_SQL_SETUP = `-- Execute este script no SQL Editor do seu projeto gratuito no Supabase:
CREATE TABLE IF NOT EXISTS public.couple_sync (
  couple_code TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.couple_sync ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow couple_sync public access" ON public.couple_sync;
CREATE POLICY "Allow couple_sync public access"
  ON public.couple_sync
  FOR ALL
  USING (true)
  WITH CHECK (true);`;

export function getSupabaseConfig() {
  try {
    const raw = localStorage.getItem(SUPABASE_CONFIG_KEY);
    if (!raw) {
      return {
        url: '',
        anonKey: '',
        coupleCode: 'wesley-beatriz-2026',
        autoSync: true,
        lastSyncAt: null
      };
    }
    const parsed = JSON.parse(raw);
    return {
      url: (parsed.url || '').trim(),
      anonKey: (parsed.anonKey || '').trim(),
      coupleCode: (parsed.coupleCode || 'wesley-beatriz-2026').trim(),
      autoSync: parsed.autoSync !== false,
      lastSyncAt: parsed.lastSyncAt || null
    };
  } catch (e) {
    return {
      url: '',
      anonKey: '',
      coupleCode: 'wesley-beatriz-2026',
      autoSync: true,
      lastSyncAt: null
    };
  }
}

export function saveSupabaseConfig(config) {
  const clean = {
    url: (config.url || '').trim().replace(/\/+$/, ''),
    anonKey: (config.anonKey || '').trim(),
    coupleCode: (config.coupleCode || 'wesley-beatriz-2026').trim(),
    autoSync: config.autoSync !== false,
    lastSyncAt: config.lastSyncAt || null
  };
  try {
    localStorage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify(clean));
  } catch (e) {
    console.warn('Falha ao salvar configuração Supabase localmente:', e);
  }
  return clean;
}

export function isSupabaseConfigured(cfg = getSupabaseConfig()) {
  return Boolean(
    cfg &&
      cfg.url &&
      cfg.url.startsWith('http') &&
      cfg.anonKey &&
      cfg.coupleCode
  );
}

export async function pushStateToSupabase(state, customCfg) {
  const cfg = customCfg || getSupabaseConfig();
  if (!isSupabaseConfigured(cfg)) {
    return { ok: false, reason: 'not_configured' };
  }

  const endpoint = `${cfg.url.replace(/\/+$/, '')}/rest/v1/couple_sync`;
  const nowIso = new Date().toISOString();

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        apikey: cfg.anonKey,
        Authorization: `Bearer ${cfg.anonKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify({
        couple_code: cfg.coupleCode,
        payload: state,
        updated_at: nowIso
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, status: res.status, error: errText };
    }

    saveSupabaseConfig({ ...cfg, lastSyncAt: nowIso });
    return { ok: true, syncedAt: nowIso };
  } catch (err) {
    return { ok: false, error: err?.message || 'Erro de conexão com o Supabase' };
  }
}

export async function pullStateFromSupabase(customCfg) {
  const cfg = customCfg || getSupabaseConfig();
  if (!isSupabaseConfigured(cfg)) {
    return { ok: false, reason: 'not_configured' };
  }

  const endpoint = `${cfg.url.replace(
    /\/+$/,
    ''
  )}/rest/v1/couple_sync?couple_code=eq.${encodeURIComponent(
    cfg.coupleCode
  )}&select=payload,updated_at&limit=1`;

  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        apikey: cfg.anonKey,
        Authorization: `Bearer ${cfg.anonKey}`,
        Accept: 'application/json'
      }
    });

    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, status: res.status, error: errText };
    }

    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0 || !rows[0].payload) {
      return { ok: true, empty: true };
    }

    const nowIso = rows[0].updated_at || new Date().toISOString();
    saveSupabaseConfig({ ...cfg, lastSyncAt: nowIso });
    return {
      ok: true,
      payload: rows[0].payload,
      updatedAt: rows[0].updated_at
    };
  } catch (err) {
    return { ok: false, error: err?.message || 'Erro de rede ao consultar Supabase' };
  }
}


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

export async function checkRemoteUpdatedAt(customCfg) {
  const cfg = customCfg || getSupabaseConfig();
  if (!isSupabaseConfigured(cfg)) {
    return { ok: false, reason: 'not_configured' };
  }

  const endpoint = `${cfg.url.replace(
    /\/+$/,
    ''
  )}/rest/v1/couple_sync?couple_code=eq.${encodeURIComponent(
    cfg.coupleCode
  )}&select=updated_at&limit=1`;

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
      return { ok: false, status: res.status };
    }
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return { ok: true, empty: true };
    }
    return { ok: true, updatedAt: rows[0].updated_at || null };
  } catch (err) {
    return { ok: false, error: err?.message || 'Erro de rede' };
  }
}

function mergeArrayById(localArr = [], remoteArr = [], deletedIds = {}) {
  const map = new Map();
  const isDeleted = (item) => {
    const delAt = deletedIds?.[item?.id];
    if (!delAt) return false;
    const itemTs = item?.updatedAt ? new Date(item.updatedAt).getTime() : 0;
    return new Date(delAt).getTime() >= itemTs;
  };

  (remoteArr || []).forEach((item) => {
    if (item && item.id && !isDeleted(item)) {
      map.set(item.id, item);
    }
  });

  (localArr || []).forEach((item) => {
    if (!item || !item.id || isDeleted(item)) return;
    const existing = map.get(item.id);
    if (!existing) {
      map.set(item.id, item);
    } else {
      const localTs = item.updatedAt ? new Date(item.updatedAt).getTime() : 0;
      const remoteTs = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
      if (localTs > remoteTs) {
        map.set(item.id, item);
      }
    }
  });

  return Array.from(map.values());
}

export function mergeCloudAndLocalState(localState, remoteState) {
  if (!remoteState || typeof remoteState !== 'object') return localState;
  if (!localState || typeof localState !== 'object') return remoteState;

  const localClearedTs = localState.clearedAt ? new Date(localState.clearedAt).getTime() : 0;
  const remoteClearedTs = remoteState.clearedAt ? new Date(remoteState.clearedAt).getTime() : 0;

  // Se o remoto foi zerado mais recentemente que qualquer alteração local, respeita o estado zerado remoto
  if (remoteClearedTs > localClearedTs) {
    return remoteState;
  }

  const mergedDeletedIds = {
    ...(localState.deletedIds || {}),
    ...(remoteState.deletedIds || {})
  };

  const mergedWeeklyFuel = { ...(remoteState.weeklyExtraFuelCosts || {}) };
  Object.entries(localState.weeklyExtraFuelCosts || {}).forEach(([ym, weeks]) => {
    mergedWeeklyFuel[ym] = { ...(mergedWeeklyFuel[ym] || {}), ...(weeks || {}) };
  });

  return {
    ...localState,
    ...remoteState,
    couple: {
      ...(localState.couple || {}),
      ...(remoteState.couple || {})
    },
    monthlyIncomes: {
      ...(localState.monthlyIncomes || {}),
      ...(remoteState.monthlyIncomes || {})
    },
    monthlySettlements: {
      ...(localState.monthlySettlements || {}),
      ...(remoteState.monthlySettlements || {})
    },
    weeklyExtraFuelCosts: mergedWeeklyFuel,
    deletedIds: mergedDeletedIds,
    cards: mergeArrayById(localState.cards, remoteState.cards, mergedDeletedIds),
    transactions: mergeArrayById(localState.transactions, remoteState.transactions, mergedDeletedIds),
    commitments: mergeArrayById(localState.commitments, remoteState.commitments, mergedDeletedIds),
    extraIncomes: mergeArrayById(localState.extraIncomes, remoteState.extraIncomes, mergedDeletedIds),
    goals: mergeArrayById(localState.goals, remoteState.goals, mergedDeletedIds),
    checklist: mergeArrayById(localState.checklist, remoteState.checklist, mergedDeletedIds),
    savedStudents: mergeArrayById(localState.savedStudents, remoteState.savedStudents, mergedDeletedIds)
  };
}


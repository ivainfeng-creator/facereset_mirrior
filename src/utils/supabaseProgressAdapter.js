import {
  buildDailyProgressPayload,
  enqueueSessionForSync,
  getDisplayName,
  getSessionSyncQueue,
  loadHabit,
  mergeHabitWithCloud,
  removeSessionFromSyncQueue,
  toCloudSessionResult,
} from './storage.js';
import { isSupabaseConfigured, supabase } from './supabaseClient.js';

let syncInFlight = null;

export function initializeSupabaseProgress({ onMerged } = {}) {
  if (!isSupabaseConfigured) {
    console.warn('[Face Reset][Supabase] Sync skipped: VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY is missing.');
    return Promise.resolve(null);
  }
  console.info('[Face Reset][Supabase] Starting background sync.');
  return synchronizeSupabaseProgress({ onMerged });
}

export function queueSupabaseSession(session, { onMerged } = {}) {
  enqueueSessionForSync(session);
  if (!isSupabaseConfigured) return Promise.resolve(null);
  return synchronizeSupabaseProgress({ onMerged });
}

export async function fetchProgramDayLeaderboard(programDay, { limit = 10 } = {}) {
  if (!isSupabaseConfigured || !supabase || !Number.isInteger(Number(programDay)) || Number(programDay) < 1) {
    return [];
  }

  const { data, error } = await supabase
    .from('daily_leaderboard')
    .select('program_day, display_name, total_score, completed_sessions, is_complete, rank')
    .eq('program_day', Number(programDay))
    .order('rank', { ascending: true })
    .limit(limit);

  if (error) {
    console.warn('[Face Reset][Supabase] Program Day leaderboard could not load.', {
      programDay: Number(programDay),
      message: error.message,
      code: error.code || null,
    });
    return [];
  }

  return data || [];
}

export async function getSupabaseDisplayName() {
  if (!isSupabaseConfigured || !supabase) return '';

  try {
    const session = await ensureAnonymousSession();
    if (!session?.user?.id) return '';
    const { data, error } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (error) throw error;
    return getDisplayName({ displayName: data?.display_name });
  } catch (error) {
    console.warn('[Face Reset][Supabase] Profile name could not load.', {
      message: error?.message || String(error),
      code: error?.code || null,
    });
    return '';
  }
}

export async function saveSupabaseDisplayName(displayName) {
  const normalizedName = getDisplayName({ displayName });
  if (!normalizedName || !isSupabaseConfigured || !supabase) {
    return { ok: false, displayName: normalizedName, reason: 'unavailable' };
  }

  try {
    const session = await ensureAnonymousSession();
    if (!session?.user?.id) throw new Error('No authenticated Supabase user is available.');
    const profile = await upsertProfile(session.user.id, { displayName: normalizedName, select: true });
    return { ok: true, displayName: getDisplayName({ displayName: profile?.display_name || normalizedName }) };
  } catch (error) {
    console.warn('[Face Reset][Supabase] Profile name could not save.', {
      message: error?.message || String(error),
      code: error?.code || null,
    });
    return { ok: false, displayName: normalizedName, error };
  }
}

export async function synchronizeSupabaseProgress({ onMerged } = {}) {
  if (!isSupabaseConfigured || !supabase) return null;
  if (syncInFlight) return syncInFlight;

  syncInFlight = (async () => {
    try {
      const session = await ensureAnonymousSession();
      if (!session?.user?.id) return null;

      await upsertProfile(session.user.id);
      const beforeUpload = await hydrateFromCloud(session.user.id, onMerged);
      const syncedDates = await flushSessionQueue(session.user.id);
      await syncDailyProgress(session.user.id, syncedDates);
      return hydrateFromCloud(session.user.id, onMerged) || beforeUpload;
    } catch (error) {
      // The local result remains available and will retry on the next app start or completion.
      console.error('[Face Reset][Supabase] Background sync failed.', {
        message: error?.message || String(error),
        code: error?.code || null,
        status: error?.status || null,
      });
      return null;
    } finally {
      syncInFlight = null;
    }
  })();

  return syncInFlight;
}

async function ensureAnonymousSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (data.session?.user) {
    console.info('[Face Reset][Supabase] Reusing persisted auth session.', {
      isAnonymous: data.session.user.is_anonymous === true,
    });
    return data.session;
  }

  console.info('[Face Reset][Supabase] No persisted session. Creating anonymous session.');
  const { data: signedIn, error: signInError } = await supabase.auth.signInAnonymously();
  const signedInUser = signedIn?.user || signedIn?.session?.user || null;
  console.info('[Face Reset][Supabase] Anonymous sign-in response.', {
    errorIsNull: signInError === null,
    hasUser: Boolean(signedInUser),
    hasUserId: Boolean(signedInUser?.id),
    isAnonymous: signedInUser?.is_anonymous === true,
  });
  if (signInError) throw signInError;

  const { data: verifiedData, error: verifiedError } = await supabase.auth.getUser();
  console.info('[Face Reset][Supabase] Anonymous user verification.', {
    errorIsNull: verifiedError === null,
    hasUser: Boolean(verifiedData?.user),
    sameUser: Boolean(verifiedData?.user?.id && verifiedData.user.id === signedInUser?.id),
    isAnonymous: verifiedData?.user?.is_anonymous === true,
  });
  if (verifiedError) throw verifiedError;
  if (!signedInUser?.id || !verifiedData?.user?.id) {
    throw new Error('Anonymous sign-in returned no authenticated user.');
  }
  return signedIn.session;
}

async function upsertProfile(userId, { displayName, select = false } = {}) {
  const habit = loadHabit();
  const payload = {
    user_id: userId,
    device_id: habit.deviceId || null,
  };
  const resolvedDisplayName = getDisplayName({ displayName: displayName || getDisplayName(habit) });
  if (resolvedDisplayName) payload.display_name = resolvedDisplayName;
  let request = supabase.from('profiles').upsert(payload, { onConflict: 'user_id' });
  if (select) request = request.select('user_id, display_name').single();
  const { data, error } = await request;
  if (error) throw error;
  return data || null;
}

async function hydrateFromCloud(userId, onMerged) {
  const [progressResponse, sessionsResponse] = await Promise.all([
    supabase.from('daily_progress').select('*').eq('user_id', userId),
    supabase.from('session_results').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(250),
  ]);
  if (progressResponse.error) throw progressResponse.error;
  if (sessionsResponse.error) throw sessionsResponse.error;

  const mergedHabit = mergeHabitWithCloud({
    habit: loadHabit(),
    progressRows: progressResponse.data || [],
    sessionRows: sessionsResponse.data || [],
  });
  onMerged?.(mergedHabit);
  return mergedHabit;
}

async function flushSessionQueue(userId) {
  const syncedDates = new Set();
  for (const entry of getSessionSyncQueue()) {
    const sessionPayload = toCloudSessionResult(entry);
    if (!sessionPayload) {
      throw new Error(`Session ${entry?.id || 'unknown'} is missing a canonical program_day.`);
    }

    const { error } = await supabase.from('session_results').insert({
      ...sessionPayload,
      user_id: userId,
    });

    if (!error || error.code === '23505') {
      removeSessionFromSyncQueue(entry.id);
      syncedDates.add(entry.date);
      continue;
    }
    throw error;
  }
  return syncedDates;
}

async function syncDailyProgress(userId, recentlySyncedDates) {
  const queueDates = getSessionSyncQueue().map((entry) => entry.date);
  const dates = new Set([...recentlySyncedDates, ...queueDates]);
  if (!dates.size) {
    const habit = loadHabit();
    if (habit.latestDate) dates.add(habit.latestDate);
  }

  const rows = [...dates]
    .filter(Boolean)
    .map((date) => {
      const payload = buildDailyProgressPayload(loadHabit(), date);
      if (!Number.isInteger(Number(payload.program_day)) || Number(payload.program_day) < 1) {
        throw new Error(`Daily progress for ${date} is missing a canonical program_day.`);
      }
      return {
        ...payload,
        program_day: Number(payload.program_day),
        user_id: userId,
      };
    });
  if (!rows.length) return;

  const { error } = await supabase
    .from('daily_progress')
    .upsert(rows, { onConflict: 'user_id,progress_date' });
  if (error) throw error;
}

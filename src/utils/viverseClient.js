const VIVERSE_SDK_URL = 'https://www.viverse.com/static-assets/viverse-sdk/1.3.3/index.umd.cjs';
const VIVERSE_SDK_ELEMENT_ID = 'viverse-sdk';
const VIVERSE_APP_ID = 'yvyxchbtvt';
const VIVERSE_ACCOUNT_DOMAIN = 'account.htcvive.com';
const SDK_LOAD_TIMEOUT_MS = 5000;
const AUTH_CHECK_TIMEOUT_MS = 7000;

const emptySnapshot = Object.freeze({
  sdkAvailable: false,
  authChecked: false,
  authenticated: false,
  accountIdExists: false,
  accountId: null,
});

let authSnapshot = emptySnapshot;
let sdkLoadPromise = null;
let initializationPromise = null;

function isBrowser() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function getSdk() {
  return globalThis.viverse?.client ? globalThis.viverse : null;
}

function waitForPageLoad() {
  if (!isBrowser() || document.readyState === 'complete') {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    window.addEventListener('load', resolve, { once: true });
  });
}

async function checkAuthWithTimeout(client) {
  let timeoutId;

  try {
    return await Promise.race([
      client.checkAuth(),
      new Promise((resolve) => {
        timeoutId = window.setTimeout(() => resolve(undefined), AUTH_CHECK_TIMEOUT_MS);
      }),
    ]);
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function publishDiagnostics(nextSnapshot) {
  if (!import.meta.env.DEV) return;

  console.info('[Face Reset][VIVERSE] Diagnostics', {
    'SDK available': nextSnapshot.sdkAvailable,
    'VIVERSE auth checked': nextSnapshot.authChecked,
    authenticated: nextSnapshot.authenticated,
    'account ID exists': nextSnapshot.accountIdExists,
  });
}

function updateSnapshot(nextSnapshot) {
  authSnapshot = Object.freeze({ ...emptySnapshot, ...nextSnapshot });
  publishDiagnostics(authSnapshot);
  return authSnapshot;
}

function waitForSdkScript(script) {
  return new Promise((resolve) => {
    const finish = () => {
      window.clearTimeout(timeoutId);
      script.removeEventListener('load', onLoad);
      script.removeEventListener('error', onError);
      resolve(Boolean(getSdk()));
    };
    const onLoad = finish;
    const onError = finish;
    const timeoutId = window.setTimeout(finish, SDK_LOAD_TIMEOUT_MS);

    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener('error', onError, { once: true });
  });
}

export function loadViverseSdk() {
  if (!isBrowser()) return Promise.resolve(false);
  if (getSdk()) return Promise.resolve(true);
  if (sdkLoadPromise) return sdkLoadPromise;

  sdkLoadPromise = (async () => {
    let script = document.getElementById(VIVERSE_SDK_ELEMENT_ID);

    if (!script) {
      script = document.createElement('script');
      script.id = VIVERSE_SDK_ELEMENT_ID;
      script.async = true;
      script.src = VIVERSE_SDK_URL;
      document.head.appendChild(script);
    }

    return waitForSdkScript(script);
  })().then((available) => {
    if (!available) {
      sdkLoadPromise = null;
    }

    return available;
  });

  return sdkLoadPromise;
}

function createViverseClient() {
  const sdk = getSdk();
  if (!sdk) return null;

  if (!globalThis.viverseClient) {
    globalThis.viverseClient = new sdk.client({
      clientId: VIVERSE_APP_ID,
      domain: VIVERSE_ACCOUNT_DOMAIN,
    });
  }

  return globalThis.viverseClient;
}

export function getViverseAuthSnapshot() {
  return authSnapshot;
}

export async function initializeViverseAuth() {
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    const sdkAvailable = await loadViverseSdk();
    if (!sdkAvailable) return updateSnapshot({ sdkAvailable: false });

    try {
      // The official VIVERSE example initializes the client after window load.
      await waitForPageLoad();
      const client = createViverseClient();
      const auth = client ? await checkAuthWithTimeout(client) : undefined;
      const accountIdExists = Boolean(auth?.account_id);

      if (!auth && import.meta.env.DEV) {
        console.info('[Face Reset][VIVERSE] checkAuth completed without an authenticated account.');
      }

      return updateSnapshot({
        sdkAvailable: true,
        authChecked: true,
        authenticated: accountIdExists,
        accountIdExists,
        accountId: auth?.account_id ?? null,
      });
    } catch {
      return updateSnapshot({
        sdkAvailable: true,
        authChecked: true,
      });
    }
  })().then((snapshot) => {
    if (!snapshot.sdkAvailable) {
      initializationPromise = null;
    }

    return snapshot;
  });

  return initializationPromise;
}

export async function loginWithWorlds(options) {
  await initializeViverseAuth();
  const client = createViverseClient();
  if (!client) return false;

  try {
    await client.loginWithWorlds(options);
    return true;
  } catch {
    return false;
  }
}

export const viverseConfig = Object.freeze({
  appId: VIVERSE_APP_ID,
  sdkUrl: VIVERSE_SDK_URL,
});

import { createContext, useContext } from 'react';

// The context and its hook live apart from <LocaleProvider> so that
// LocaleProvider.jsx exports a component and nothing else -- React Fast Refresh
// bails out on any module that mixes component and non-component exports.
export const LocaleContext = createContext(null);

export function useI18n() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error('useI18n must be used inside <LocaleProvider>.');
  return context;
}

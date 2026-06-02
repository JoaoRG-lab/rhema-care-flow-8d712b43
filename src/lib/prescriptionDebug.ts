export function isPrescriptionDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('debug') === '1') return true;
    return window.localStorage.getItem('rxDebug') === '1';
  } catch {
    return false;
  }
}

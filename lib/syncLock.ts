// Extension pages share an origin. Hold the lock through both the network read and
// the storage commit so a later sync, edit, deletion or disconnect runs afterward.
export async function withSyncLock<T>(operation: () => Promise<T>): Promise<T> {
  if (!navigator.locks?.request) {
    throw new Error('このブラウザでは安全な同期を利用できません。ブラウザを更新してください。');
  }
  return await navigator.locks.request('lookup-box-cache-update', operation);
}

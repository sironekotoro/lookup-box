import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { DatasetBundle } from '../../lib/types';
import { activeLookupBundles } from '../../lib/lists';
import { InvalidLookupSettingsError, loadCache, loadSettings, saveCache } from '../../lib/storage';
import { cellValue, searchDatasets } from '../../lib/search';
import { MockProvider } from '../../lib/providers/mockProvider';
import { syncLists, syncResultMessage } from '../../lib/syncLists';
import { withSyncLock } from '../../lib/syncLock';
import './style.css';

type CacheState = { bundles: DatasetBundle[]; syncedAt?: string };
const DEMO_ENABLED = import.meta.env.DEV || import.meta.env.WXT_ENABLE_DEMO === 'true';

async function refreshLists(): Promise<{ cache: CacheState; message: string; failed: boolean }> {
  const settings = await loadSettings();
  if (settings.lists.length > 0) {
    const result = await syncLists(settings.lists);
    const stored = await loadCache();
    return { cache: { ...stored, bundles: activeLookupBundles(stored.bundles, settings.lists) },
      message: syncResultMessage(result), failed: result.failed.length > 0 };
  }

  if (DEMO_ENABLED && settings.useMock) {
    await saveCache(await new MockProvider().load());
    return { cache: await loadCache(), message: '✓ デモデータを同期しました。', failed: false };
  }
  throw new Error('設定画面でGoogle Sheetを登録してください。');
}

function formatSyncedAt(value?: string): string {
  if (!value) return '未同期';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '不明';
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).format(date);
}

function errorStatus(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (error instanceof InvalidLookupSettingsError) {
    return `${message} 設定を開いて復旧してください。`;
  }
  return message.includes('再認証')
    ? `${message} 設定を開いてGoogleに接続してください。`
    : message;
}

function App() {
  const [cache, setCache] = useState<CacheState>({ bundles: [] });
  const [query, setQuery] = useState('');
  const [datasetId, setDatasetId] = useState('');
  const [copied, setCopied] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState('');
  const [statusError, setStatusError] = useState(false);

  useEffect(() => {
    const onStorageChange = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area === 'local' && changes['lookup.cache.v2'] && !changes['lookup.cache.v2'].newValue) {
        setCache({ bundles: [] });
      }
    };
    browser.storage.onChanged.addListener(onStorageChange);
    let cancelled = false;
    withSyncLock(async () => {
      const settings = await loadSettings();
      const stored = await loadCache();
      const active = activeLookupBundles(stored.bundles, settings.lists, DEMO_ENABLED && settings.useMock);
      if (settings.lists.length === 0 || active.length === settings.lists.length) {
        return { cache: { ...stored, bundles: active }, message: '', failed: false };
      }
      if (!cancelled) {
        setSyncing(true);
        setStatus('登録済みのGoogle Sheetを復旧しています...');
      }
      return refreshLists();
    })
      .then(({ cache: stored, message, failed }) => {
        if (!cancelled) { setCache(stored); if (message) setStatus(message); setStatusError(failed); }
      })
      .catch((error) => {
        if (cancelled) return;
        setStatus(errorStatus(error));
        setStatusError(true);
      })
      .finally(() => {
        if (!cancelled) setSyncing(false);
      });
    return () => { cancelled = true; browser.storage.onChanged.removeListener(onStorageChange); };
  }, []);

  useEffect(() => {
    if (datasetId && !cache.bundles.some((bundle) => bundle.definition.dataset_id === datasetId)) {
      setDatasetId('');
    }
  }, [cache.bundles, datasetId]);

  const hits = useMemo(
    () => searchDatasets(cache.bundles, query, datasetId || undefined),
    [cache.bundles, query, datasetId]
  );

  async function copy(value: string, key: string) {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(''), 900);
  }

  async function resync() {
    setSyncing(true);
    setStatus('同期中...');
    setStatusError(false);
    try {
      const result = await withSyncLock(refreshLists);
      setCache(result.cache);
      setStatus(result.message);
      setStatusError(result.failed);
    } catch (error) {
      setStatus(errorStatus(error));
      setStatusError(true);
    } finally {
      setSyncing(false);
    }
  }

  const count = cache.bundles.reduce((n, bundle) => n + bundle.rows.length, 0);

  return (
    <main>
      <header>
        <h1>LookupBox</h1>
        <div className="header-actions">
          <button disabled={syncing} onClick={resync}>↻ 再同期</button>
          <button onClick={() => browser.runtime.openOptionsPage()}>設定</button>
        </div>
      </header>

      <div className="meta">{cache.bundles.length}リスト / {count}件 / 最終同期 {formatSyncedAt(cache.syncedAt)}</div>
      {cache.bundles.length > 1 && <div className="meta">検索対象: {datasetId ? cache.bundles.find((bundle) => bundle.definition.dataset_id === datasetId)?.definition.display_name : 'すべてのリスト'}</div>}
      {status && <div className="status" role="status" style={statusError ? {color:'#a00000'} : undefined}>{status}</div>}

      {cache.bundles.length > 1 && (
        <select value={datasetId} onChange={(e) => setDatasetId(e.target.value)}>
          <option value="">すべてのリスト</option>
          {cache.bundles.map((bundle) => (
            <option key={bundle.definition.dataset_id} value={bundle.definition.dataset_id}>
              {bundle.definition.display_name}
            </option>
          ))}
        </select>
      )}

      <input autoFocus placeholder="検索..." value={query} onChange={(e) => setQuery(e.target.value)} />

      {cache.bundles.length === 0 && <p className="empty">設定画面からGoogle Sheetを登録・同期してください。</p>}
      <section className="results">
        {query && hits.length === 0 && cache.bundles.length > 0 && <p className="empty">該当なし</p>}
        {hits.map((hit, index) => {
          const bundle = cache.bundles.find((candidate) => candidate.definition.dataset_id === hit.datasetId)!;
          return (
            <article key={`${hit.datasetId}-${index}`}>
              {cache.bundles.length > 1 && <div className="dataset">{hit.datasetName}</div>}
              {bundle.definition.display_columns.map((column) => (
                <div className="field" key={column}>
                  <span className="label">{column}</span>
                  <span className="value">{cellValue(hit.row, column)}</span>
                  {bundle.definition.copy_columns.includes(column) && (
                    <button onClick={() => copy(cellValue(hit.row, column), `${index}-${column}`)}>
                      {copied === `${index}-${column}` ? '✓' : 'コピー'}
                    </button>
                  )}
                </div>
              ))}
            </article>
          );
        })}
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);

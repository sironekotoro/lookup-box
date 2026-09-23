import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { DatasetBundle } from '../../lib/types';
import { activeLookupBundles, mapBundleToLookupList } from '../../lib/lists';
import { loadCache, loadSettings, saveCache } from '../../lib/storage';
import { searchDatasets } from '../../lib/search';
import { listLoadOptions, makeGoogleSourceProvider } from '../../lib/providers/googleSource';
import { MockProvider } from '../../lib/providers/mockProvider';
import './style.css';

type CacheState = { bundles: DatasetBundle[]; syncedAt?: string };

function formatSyncedAt(value?: string): string {
  if (!value) return '未同期';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '不明';
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).format(date);
}

function App() {
  const [cache, setCache] = useState<CacheState>({ bundles: [] });
  const [query, setQuery] = useState('');
  const [datasetId, setDatasetId] = useState('');
  const [copied, setCopied] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    Promise.all([loadSettings(), loadCache()]).then(([settings, stored]) => {
      setCache({ ...stored, bundles: activeLookupBundles(stored.bundles, settings.lists, settings.useMock) });
    });
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
    try {
      const settings = await loadSettings();
      let bundles: DatasetBundle[];

      if (settings.useMock) {
        bundles = await new MockProvider().load();
      } else {
        if (settings.lists.length === 0) {
          throw new Error('設定画面でGoogle Sheetを登録してください。');
        }

        bundles = [];
        for (const list of settings.lists) {
          const provider = makeGoogleSourceProvider(listLoadOptions(list));
          const loaded = await provider.load();
          const source = loaded[0];
          if (!source) throw new Error(`${list.spreadsheetTitle} / ${list.sheetName} を読み込めませんでした。`);
          bundles.push(mapBundleToLookupList(source, list, settings.lists));
        }
      }

      await saveCache(bundles);
      const next = await loadCache();
      setCache(next);
      const rows = bundles.reduce((n, bundle) => n + bundle.rows.length, 0);
      setStatus(`✓ ${bundles.length}リスト / ${rows}件を同期`);
      setTimeout(() => setStatus(''), 1800);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(message.includes('再認証')
        ? `${message} 設定を開いてGoogleに接続してください。`
        : message);
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
      {status && <div className="status">{status}</div>}

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
                  <span className="value">{hit.row[column] ?? ''}</span>
                  {bundle.definition.copy_columns.includes(column) && (
                    <button onClick={() => copy(hit.row[column] ?? '', `${index}-${column}`)}>
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

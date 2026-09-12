import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { DatasetBundle } from '../../lib/types';
import { loadCache, loadSettings, saveCache } from '../../lib/storage';
import { searchDatasets } from '../../lib/search';
import { GoogleSheetsProvider } from '../../lib/providers/googleSheetsProvider';
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

  useEffect(() => { loadCache().then(setCache); }, []);

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
        if (!settings.spreadsheetUrl || !settings.sheetName) {
          throw new Error('設定画面でGoogle Sheetを選択してください。');
        }
        const current = cache.bundles.find((b) => b.definition.sheet_name === settings.sheetName)
          ?? cache.bundles[0];
        const headers = current?.definition.search_columns ?? [];
        const provider = new GoogleSheetsProvider(
          settings.gasUrl ?? '',
          settings.apiToken ?? '',
          {
            spreadsheetUrl: settings.spreadsheetUrl,
            sheetName: settings.sheetName,
            searchColumns: current?.definition.search_columns ?? headers,
            displayColumns: current?.definition.display_columns ?? headers,
            copyColumns: current?.definition.copy_columns ?? headers
          }
        );
        bundles = await provider.load();
      }

      await saveCache(bundles);
      const next = await loadCache();
      setCache(next);
      setStatus(`✓ ${bundles.reduce((n, b) => n + b.rows.length, 0)}件を同期`);
      setTimeout(() => setStatus(''), 1800);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setSyncing(false);
    }
  }

  const count = cache.bundles.reduce((n, b) => n + b.rows.length, 0);

  return (
    <main>
      <header>
        <h1>LookupBox</h1>
        <div className="header-actions">
          <button disabled={syncing} onClick={resync}>↻ 再同期</button>
          <button onClick={() => browser.runtime.openOptionsPage()}>設定</button>
        </div>
      </header>

      <div className="meta">{count}件 / 最終同期 {formatSyncedAt(cache.syncedAt)}</div>
      {status && <div className="status">{status}</div>}

      {cache.bundles.length > 1 && (
        <select value={datasetId} onChange={(e) => setDatasetId(e.target.value)}>
          <option value="">すべて</option>
          {cache.bundles.map((b) => <option key={b.definition.dataset_id} value={b.definition.dataset_id}>{b.definition.display_name}</option>)}
        </select>
      )}

      <input autoFocus placeholder="名前またはコードを検索..." value={query} onChange={(e) => setQuery(e.target.value)} />

      {cache.bundles.length === 0 && <p className="empty">設定画面からGoogle Sheetを同期してください。</p>}
      <section className="results">
        {query && hits.length === 0 && cache.bundles.length > 0 && <p className="empty">該当なし</p>}
        {hits.map((hit, index) => {
          const bundle = cache.bundles.find((b) => b.definition.dataset_id === hit.datasetId)!;
          return (
            <article key={`${hit.datasetId}-${index}`}>
              {cache.bundles.length > 1 && <div className="dataset">{hit.datasetName}</div>}
              {bundle.definition.display_columns.map((col) => (
                <div className="field" key={col}>
                  <span className="label">{col}</span>
                  <span className="value">{hit.row[col] ?? ''}</span>
                  {bundle.definition.copy_columns.includes(col) && (
                    <button onClick={() => copy(hit.row[col] ?? '', `${index}-${col}`)}>{copied === `${index}-${col}` ? '✓' : 'コピー'}</button>
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

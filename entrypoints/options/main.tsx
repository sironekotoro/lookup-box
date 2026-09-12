import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { LookupList, SheetInspection, SpreadsheetInspection } from '../../lib/types';
import {
  applyLookupListDisplayNames,
  createLookupList,
  getLookupListDisplayName,
  mapBundleToLookupList
} from '../../lib/lists';
import {
  loadCache,
  loadSettings,
  saveCache,
  saveSettings,
  type LookupSettings
} from '../../lib/storage';
import { GoogleSheetsProvider } from '../../lib/providers/googleSheetsProvider';
import { MockProvider } from '../../lib/providers/mockProvider';

function initialSettings(): LookupSettings {
  return { lists: [] };
}

function App() {
  const [settings, setSettings] = useState<LookupSettings>(initialSettings());
  const [draftUrl, setDraftUrl] = useState('');
  const [inspection, setInspection] = useState<SpreadsheetInspection | null>(null);
  const [sheetName, setSheetName] = useState('');
  const [keyColumn, setKeyColumn] = useState('');
  const [valueColumn, setValueColumn] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadSettings().then((loaded) => {
      setSettings(loaded);
      setDraftUrl(loaded.legacySpreadsheetUrl ?? '');
    });
  }, []);

  const selectedSheet = useMemo(
    () => inspection?.sheets.find((sheet) => sheet.name === sheetName) ?? null,
    [inspection, sheetName]
  );

  function chooseSheet(nextSheetName: string, currentInspection = inspection) {
    setSheetName(nextSheetName);
    const sheet = currentInspection?.sheets.find((candidate) => candidate.name === nextSheetName);
    const headers = sheet?.headers.filter(Boolean) ?? [];
    setKeyColumn(headers[0] ?? '');
    setValueColumn(headers[1] ?? headers[0] ?? '');
  }

  async function persistConnection() {
    await saveSettings(settings);
    setMessage('✓ 接続設定を保存しました。');
  }

  async function useDemo() {
    setBusy(true);
    try {
      const bundles = await new MockProvider().load();
      await saveCache(bundles);
      const next = { ...settings, useMock: true };
      await saveSettings(next);
      setSettings(next);
      setMessage('デモデータを読み込みました。Popupで Apple / Microsoft / AAPL / MSFT を検索できます。');
    } finally {
      setBusy(false);
    }
  }

  async function inspectSheet() {
    setBusy(true);
    setMessage('Google Sheetを確認しています...');
    try {
      const provider = new GoogleSheetsProvider(settings.gasUrl ?? '', settings.apiToken ?? '');
      const result = await provider.inspect(draftUrl);
      if (result.sheets.length === 0) throw new Error('検索できる表示タブが見つかりませんでした。');

      setInspection(result);
      const preferred = result.sheets.find((sheet) => sheet.name === settings.legacySheetName)
        ?? result.sheets[0]!;
      chooseSheet(preferred.name, result);
      setMessage(`「${result.title}」を読み込みました。タブと列を確認してください。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function loadListBundle(list: LookupList, lists: LookupList[]) {
    const provider = new GoogleSheetsProvider(
      settings.gasUrl ?? '',
      settings.apiToken ?? '',
      {
        spreadsheetUrl: list.spreadsheetUrl,
        sheetName: list.sheetName,
        searchColumns: [list.keyColumn, list.valueColumn],
        displayColumns: [list.keyColumn, list.valueColumn],
        copyColumns: [list.keyColumn, list.valueColumn]
      }
    );
    const bundles = await provider.load();
    const source = bundles[0];
    if (!source) throw new Error(`${getLookupListDisplayName(list, lists)} を読み込めませんでした。`);
    return mapBundleToLookupList(source, list, lists);
  }

  async function addList() {
    if (!inspection || !selectedSheet) {
      setMessage('先にGoogle Sheetを確認してください。');
      return;
    }
    if (!keyColumn || !valueColumn) {
      setMessage('Key列とValue列を選択してください。');
      return;
    }

    setBusy(true);
    try {
      const list = createLookupList(inspection, draftUrl, selectedSheet.name, keyColumn, valueColumn);
      const nextLists = [...settings.lists.filter((candidate) => candidate.id !== list.id), list];
      const bundle = await loadListBundle(list, nextLists);
      const cache = await loadCache();
      const retained = cache.bundles.filter((candidate) => candidate.definition.dataset_id !== list.id);
      await saveCache(applyLookupListDisplayNames([...retained, bundle], nextLists));

      const next: LookupSettings = {
        ...settings,
        lists: nextLists,
        useMock: false,
        legacySpreadsheetUrl: undefined,
        legacySheetName: undefined
      };
      await saveSettings(next);
      setSettings(next);
      setMessage(`✓ ${getLookupListDisplayName(list, nextLists)} を登録・同期しました。`);
      setInspection(null);
      setSheetName('');
      setKeyColumn('');
      setValueColumn('');
      setDraftUrl('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function syncList(list: LookupList) {
    setBusy(true);
    try {
      const bundle = await loadListBundle(list, settings.lists);
      const cache = await loadCache();
      const retained = cache.bundles.filter((candidate) => candidate.definition.dataset_id !== list.id);
      await saveCache(applyLookupListDisplayNames([...retained, bundle], settings.lists));
      const next = { ...settings, useMock: false };
      await saveSettings(next);
      setSettings(next);
      setMessage(`✓ ${getLookupListDisplayName(list, settings.lists)} を再同期しました。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function removeList(listId: string) {
    const nextLists = settings.lists.filter((list) => list.id !== listId);
    const next = { ...settings, lists: nextLists, useMock: false };
    const cache = await loadCache();
    await saveCache(applyLookupListDisplayNames(
      cache.bundles.filter((bundle) => bundle.definition.dataset_id !== listId),
      nextLists
    ));
    await saveSettings(next);
    setSettings(next);
    setMessage('リストを削除しました。');
  }

  const headers = selectedSheet?.headers.filter(Boolean) ?? [];

  return (
    <main style={{maxWidth:760, margin:'30px auto', fontFamily:'system-ui', lineHeight:1.55, padding:'0 18px'}}>
      <h1>LookupBox 設定</h1>
      <p>Google Sheetを複数登録できます。リスト名は入力不要で、Spreadsheet名から自動で決まります。</p>

      <details>
        <summary>接続設定（GAS版では初回だけ）</summary>
        <p><label>GAS Web App URL<br/><input style={{width:'100%'}} value={settings.gasUrl ?? ''} onChange={(e)=>setSettings({...settings,gasUrl:e.target.value})}/></label></p>
        <p><label>API Token<br/><input type="password" style={{width:'100%'}} value={settings.apiToken ?? ''} onChange={(e)=>setSettings({...settings,apiToken:e.target.value})}/></label></p>
        <button disabled={busy} onClick={persistConnection}>接続設定を保存</button>
      </details>

      <h2>登録済みリスト</h2>
      {settings.lists.length === 0 ? (
        <p style={{color:'#666'}}>まだ登録されていません。</p>
      ) : (
        <div style={{display:'grid', gap:10}}>
          {settings.lists.map((list) => (
            <div key={list.id} style={{border:'1px solid #ddd', borderRadius:8, padding:12}}>
              <strong>{getLookupListDisplayName(list, settings.lists)}</strong>
              <div style={{color:'#666', fontSize:14}}>{list.sheetName} / {list.keyColumn} → {list.valueColumn}</div>
              <div style={{marginTop:8}}>
                <button disabled={busy} onClick={()=>syncList(list)}>再同期</button>{' '}
                <button disabled={busy} onClick={()=>removeList(list.id)}>削除</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2>Google Sheetを追加</h2>
      <p><label>Google Sheet URL<br/><input placeholder="https://docs.google.com/spreadsheets/d/..." style={{width:'100%', padding:8}} value={draftUrl} onChange={(e)=>setDraftUrl(e.target.value)}/></label></p>
      <button disabled={busy || !draftUrl} onClick={inspectSheet}>{busy ? '処理中...' : 'Sheetを確認'}</button>{' '}
      <button disabled={busy} onClick={useDemo}>デモで試す</button>

      {inspection && (
        <section style={{marginTop:20, padding:14, border:'1px solid #ddd', borderRadius:8}}>
          <strong>{inspection.title}</strong>
          <p>
            <label>検索するタブ<br/>
              <select value={sheetName} onChange={(e)=>chooseSheet(e.target.value)}>
                {inspection.sheets.map((sheet)=><option key={sheet.name} value={sheet.name}>{sheet.name} ({sheet.rowCount}件)</option>)}
              </select>
            </label>
          </p>
          <p>
            <label>Key列<br/>
              <select value={keyColumn} onChange={(e)=>setKeyColumn(e.target.value)}>
                {headers.map((header)=><option key={header} value={header}>{header}</option>)}
              </select>
            </label>{' '}
            <label>Value列<br/>
              <select value={valueColumn} onChange={(e)=>setValueColumn(e.target.value)}>
                {headers.map((header)=><option key={header} value={header}>{header}</option>)}
              </select>
            </label>
          </p>
          <button disabled={busy || !keyColumn || !valueColumn} onClick={addList}>登録して同期</button>
        </section>
      )}

      <p style={{minHeight:24}}>{message}</p>
      <hr/>
      <p style={{color:'#666'}}>1行目を列名として扱います。2列の表ならKey/Valueは自動選択され、名前・コードのどちらからでも検索できます。</p>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);

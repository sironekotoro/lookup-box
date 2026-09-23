import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { LookupList, SpreadsheetInspection } from '../../lib/types';
import {
  activeLookupBundles,
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
import {
  clearGoogleAuth,
  getGoogleAccessToken,
  getGoogleAuthRuntimeInfo,
  isGoogleOAuthConfigured
} from '../../lib/auth/googleAuth';
import {
  listLoadOptions,
  makeGoogleSourceProvider
} from '../../lib/providers/googleSource';
import { MockProvider } from '../../lib/providers/mockProvider';

function initialSettings(): LookupSettings {
  return { lists: [] };
}

function sheetLabel(sheet: SpreadsheetInspection['sheets'][number]): string {
  return typeof sheet.rowCount === 'number'
    ? `${sheet.name} (${sheet.rowCount}件)`
    : sheet.name;
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
  const [connected, setConnected] = useState(false);
  const authInfo = getGoogleAuthRuntimeInfo();

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

  async function connectGoogle() {
    if (!isGoogleOAuthConfigured()) {
      setMessage('このビルドにはGoogle OAuth Client IDが設定されていません。');
      return;
    }

    setBusy(true);
    setMessage('Googleに接続しています...');
    try {
      await getGoogleAccessToken(true);
      const next: LookupSettings = { ...settings, useMock: false };
      await saveSettings(next);
      setSettings(next);
      setConnected(true);
      setMessage('✓ Googleに接続しました。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function disconnectGoogle() {
    setBusy(true);
    try {
      await clearGoogleAuth();
      setConnected(false);
      setMessage('Google接続を解除しました。');
    } finally {
      setBusy(false);
    }
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
      const provider = makeGoogleSourceProvider();
      const result = await provider.inspect(draftUrl);
      if (result.sheets.length === 0) throw new Error('検索できる表示タブが見つかりませんでした。');

      setInspection(result);
      const preferred = result.sheets.find((sheet) => sheet.name === settings.legacySheetName)
        ?? result.sheets[0]!;
      chooseSheet(preferred.name, result);
      setConnected(true);
      setMessage(`「${result.title}」を読み込みました。タブと列を確認してください。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function loadListBundle(list: LookupList, lists: LookupList[]) {
    const provider = makeGoogleSourceProvider(listLoadOptions(list));
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
      const retained = activeLookupBundles(cache.bundles, settings.lists)
        .filter((candidate) => candidate.definition.dataset_id !== list.id);
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
      setConnected(true);
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
      const retained = activeLookupBundles(cache.bundles, settings.lists)
        .filter((candidate) => candidate.definition.dataset_id !== list.id);
      await saveCache(applyLookupListDisplayNames([...retained, bundle], settings.lists));
      const next = { ...settings, useMock: false };
      await saveSettings(next);
      setSettings(next);
      setConnected(true);
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
      activeLookupBundles(cache.bundles, nextLists),
      nextLists
    ));
    await saveSettings(next);
    setSettings(next);
    setMessage('リストを削除しました。');
  }

  const headers = selectedSheet?.headers.filter(Boolean) ?? [];
  const fieldStyle: React.CSSProperties = {
    display: 'grid',
    gap: 6,
    maxWidth: 360
  };
  const selectStyle: React.CSSProperties = {
    width: '100%',
    minWidth: 0,
    padding: '6px 8px',
    boxSizing: 'border-box'
  };

  return (
    <main style={{maxWidth:760, margin:'30px auto', fontFamily:'system-ui', lineHeight:1.55, padding:'0 18px'}}>
      <h1>LookupBox 設定</h1>
      <p>Googleに接続して、Google Sheetを検索リストとして登録します。</p>

      <section style={{border:'1px solid #ddd', borderRadius:10, padding:16, marginBottom:22}}>
        <h2 style={{marginTop:0}}>Google接続</h2>
        <p>現在: <strong>{connected ? '接続済み' : '未接続'}</strong></p>
        {authInfo.configured ? (
          <div>
            <button disabled={busy} onClick={connectGoogle}>Googleに接続</button>{' '}
            <button disabled={busy} onClick={disconnectGoogle}>接続解除</button>
          </div>
        ) : (
          <p style={{color:'#8a5a00'}}>
            このビルドにはGoogle OAuth Client IDが設定されていません。
          </p>
        )}
        <details style={{marginTop:12}}>
          <summary>開発情報</summary>
          <div style={{fontSize:13, color:'#666', wordBreak:'break-all'}}>
            <div>browser: {authInfo.browser}</div>
            <div>extension id: {authInfo.extensionId ?? '-'}</div>
            <div>redirect URL: {authInfo.redirectUrl ?? '-'}</div>
          </div>
        </details>
      </section>

      <h2>登録済みリスト</h2>
      <p>登録済みの全リストが検索対象です。不要なサンプルのリストはここで削除してください。</p>
      {settings.lists.length === 0 ? (
        <p style={{color:'#666'}}>まだ登録されていません。</p>
      ) : (
        <div style={{display:'grid', gap:10}}>
          {settings.lists.map((list) => (
            <div key={list.id} style={{border:'1px solid #ddd', borderRadius:8, padding:12}}>
              <strong>{getLookupListDisplayName(list, settings.lists)}</strong>
              <div style={{color:'#666', fontSize:14}}>{list.sheetName} / {list.keyColumn} → {list.valueColumn}</div>
              <div style={{color:'#666', fontSize:12, overflowWrap:'anywhere'}}>{list.spreadsheetUrl}</div>
              <div style={{marginTop:8}}>
                <button disabled={busy} onClick={()=>syncList(list)}>再同期</button>{' '}
                <button disabled={busy} onClick={()=>removeList(list.id)}>削除</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2>Google Sheetを追加</h2>
      <p><label>Google Sheet URL<br/><input placeholder="https://docs.google.com/spreadsheets/d/..." style={{width:'100%', padding:8}} value={draftUrl} onChange={(e)=>{
        setDraftUrl(e.target.value);
        setInspection(null);
        setSheetName('');
        setKeyColumn('');
        setValueColumn('');
      }}/></label></p>
      <button disabled={busy || !draftUrl} onClick={inspectSheet}>{busy ? '処理中...' : 'Sheetを確認'}</button>{' '}
      <button disabled={busy} onClick={useDemo}>デモで試す</button>

      {inspection && (
        <section style={{marginTop:20, padding:14, border:'1px solid #ddd', borderRadius:8}}>
          <strong>{inspection.title}</strong>
          <div style={{display:'grid', gap:14, marginTop:18}}>
            <label style={fieldStyle}>
              <span>検索するタブ</span>
              <select style={selectStyle} value={sheetName} onChange={(e)=>chooseSheet(e.target.value)}>
                {inspection.sheets.map((sheet)=><option key={sheet.name} value={sheet.name}>{sheetLabel(sheet)}</option>)}
              </select>
            </label>
            <label style={fieldStyle}>
              <span>Key列</span>
              <select style={selectStyle} value={keyColumn} onChange={(e)=>setKeyColumn(e.target.value)}>
                {headers.map((header)=><option key={header} value={header}>{header}</option>)}
              </select>
            </label>
            <label style={fieldStyle}>
              <span>Value列</span>
              <select style={selectStyle} value={valueColumn} onChange={(e)=>setValueColumn(e.target.value)}>
                {headers.map((header)=><option key={header} value={header}>{header}</option>)}
              </select>
            </label>
          </div>
          <button style={{marginTop:18}} disabled={busy || !keyColumn || !valueColumn} onClick={addList}>登録して同期</button>
        </section>
      )}

      <p style={{minHeight:24}}>{message}</p>
      <hr/>
      <p style={{color:'#666'}}>1行目を列名として扱います。表示済みの文字列を取得するため、Sheet側で設定した先頭ゼロなどの表示形式も保持します。</p>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);

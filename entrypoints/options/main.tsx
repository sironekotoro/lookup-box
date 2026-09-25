import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { LookupList, SpreadsheetInspection } from '../../lib/types';
import { selectableHeaders } from '../../lib/sheetHeaders';
import {
  activeLookupBundles,
  applyLookupListDisplayNames,
  createLookupList,
  getLookupListDisplayName,
  mapBundleToLookupList
} from '../../lib/lists';
import {
  clearCache,
  InvalidLookupSettingsError,
  isGoogleDisconnected,
  loadCache,
  loadInvalidSettingsBackup,
  loadSettings,
  recoverInvalidSettings,
  saveCache,
  saveListSettingsAndCache,
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
import { withSyncLock } from '../../lib/syncLock';

const DEMO_ENABLED = import.meta.env.DEV || import.meta.env.WXT_ENABLE_DEMO === 'true';

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
  const [settingsReady, setSettingsReady] = useState(false);
  const [settingsError, setSettingsError] = useState<Error | null>(null);
  const [draftUrl, setDraftUrl] = useState('');
  const [inspection, setInspection] = useState<SpreadsheetInspection | null>(null);
  const [sheetName, setSheetName] = useState('');
  const [searchColumns, setSearchColumns] = useState<string[]>([]);
  const [displayColumns, setDisplayColumns] = useState<string[]>([]);
  const [copyColumns, setCopyColumns] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState<boolean | null>(null);
  const authInfo = getGoogleAuthRuntimeInfo();

  useEffect(() => {
    withSyncLock(loadSettings).then((loaded) => {
      setSettings(loaded);
      setDraftUrl(loaded.legacySpreadsheetUrl ?? '');
      setSettingsReady(true);
    }).catch((error) => setSettingsError(error instanceof Error ? error : new Error(String(error))));
    isGoogleDisconnected().then((disconnected) => {
      if (disconnected) setConnected(false);
      else getGoogleAccessToken(false).then(() => setConnected(true)).catch(() => setConnected(false));
    }).catch(() => setConnected(false));
  }, []);

  const selectedSheet = useMemo(
    () => inspection?.sheets.find((sheet) => sheet.name === sheetName) ?? null,
    [inspection, sheetName]
  );

  function chooseSheet(nextSheetName: string, currentInspection = inspection) {
    setSheetName(nextSheetName);
    const sheet = currentInspection?.sheets.find((candidate) => candidate.name === nextSheetName);
    const headers = selectableHeaders(sheet);
    const defaults = headers.slice(0, 2);
    setSearchColumns(defaults);
    setDisplayColumns(defaults);
    setCopyColumns(defaults);
  }

  function toggleColumn(column: string, group: 'search' | 'display' | 'copy') {
    if (group === 'search') {
      setSearchColumns((current) => current.includes(column)
        ? current.filter((item) => item !== column) : [...current, column]);
    } else if (group === 'display') {
      setDisplayColumns((current) => current.includes(column)
        ? current.filter((item) => item !== column) : [...current, column]);
      setCopyColumns((current) => current.filter((item) => item !== column));
    } else {
      setCopyColumns((current) => current.includes(column)
        ? current.filter((item) => item !== column) : [...current, column]);
    }
  }

  function moveDisplayColumn(column: string, direction: -1 | 1) {
    setDisplayColumns((current) => {
      const index = current.indexOf(column);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex]!, next[index]!];
      return next;
    });
  }

  async function editList(list: LookupList) {
    setBusy(true);
    setMessage('登録済みリストの列を確認しています...');
    try {
      const result = await makeGoogleSourceProvider().inspect(list.spreadsheetUrl);
      const sheet = result.sheets.find((candidate) => candidate.name === list.sheetName);
      if (!sheet) throw new Error(`タブ「${list.sheetName}」が見つかりません。`);
      const available = new Set(selectableHeaders(sheet));
      const unavailableSelected = [...list.searchColumns, ...list.displayColumns, ...list.copyColumns]
        .some((column) => !available.has(column));
      setDraftUrl(list.spreadsheetUrl);
      setInspection(result);
      setSheetName(list.sheetName);
      setSearchColumns(list.searchColumns.filter((column) => available.has(column)));
      setDisplayColumns(list.displayColumns.filter((column) => available.has(column)));
      setCopyColumns(list.copyColumns.filter((column) => available.has(column)));
      setEditingId(list.id);
      setMessage(unavailableSelected
        ? '使用中の列に重複または削除された見出しがあります。別の列を選び、設定を保存して同期してください。元の設定は保存するまで変更されません。'
        : '列を変更して「設定を保存して同期」を押してください。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
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
      const next = await withSyncLock(async () => {
        const latest = await loadSettings();
        const updated: LookupSettings = { ...latest, useMock: false };
        await saveSettings(updated);
        return updated;
      });
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
      const revoked = await withSyncLock(async () => {
        const result = await clearGoogleAuth();
        await clearCache();
        return result;
      });
      setConnected(false);
      setMessage(revoked
        ? 'Googleの許可を取り消し、保存済みの検索データを削除しました。'
        : 'この端末の接続と検索データを削除しました。Google側の許可を取り消せなかったため、Googleアカウントの「サードパーティとの接続」からLookupBoxを削除してください。');
    } catch (error) {
      await withSyncLock(clearCache);
      setConnected(false);
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function useDemo() {
    if (!DEMO_ENABLED) return;
    if (settings.lists.length > 0) {
      setMessage('登録済みのGoogle Sheetがあるため、デモデータには切り替えません。');
      return;
    }
    setBusy(true);
    try {
      const next = await withSyncLock(async () => {
        const latest = await loadSettings();
        if (latest.lists.length > 0) throw new Error('登録済みのリストがあります。');
        const next = { ...latest, useMock: true };
        await saveListSettingsAndCache(next, await new MockProvider().load());
        return next;
      });
      setSettings(next);
      setMessage('デモデータを読み込みました。Popupで Apple / Microsoft / AAPL / MSFT を検索できます。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
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
    if (searchColumns.length === 0 || displayColumns.length === 0) {
      setMessage('検索対象列と表示列をそれぞれ1つ以上選択してください。');
      return;
    }

    const headers = selectableHeaders(selectedSheet);
    if ([...searchColumns, ...displayColumns, ...copyColumns].some((column) => !headers.includes(column))) {
      setMessage('選択した列がSheetにありません。列を確認してください。');
      return;
    }

    setBusy(true);
    try {
      const { next, list } = await withSyncLock(async () => {
        const latest = await loadSettings();
        const candidate = createLookupList(
          inspection, draftUrl, selectedSheet.name, searchColumns, displayColumns, copyColumns
        );
        const matching = latest.lists.find((current) => current.spreadsheetId === candidate.spreadsheetId
          && current.sheetName === candidate.sheetName
          && JSON.stringify([current.searchColumns, current.displayColumns, current.copyColumns])
            === JSON.stringify([searchColumns, displayColumns, copyColumns]));
        if (matching && matching.id !== editingId) {
          if (editingId) throw new Error('同じ列設定のリストが既に登録されています。');
          throw new Error('この列設定のリストは既に登録されています。編集から変更してください。');
        }
        const list = { ...candidate, id: editingId ?? candidate.id };
        if (editingId && !latest.lists.some((current) => current.id === editingId)) {
          throw new Error('編集中のリストが変更されました。設定を開き直してください。');
        }
        if (editingId && JSON.stringify(latest.lists.find((current) => current.id === editingId))
            !== JSON.stringify(settings.lists.find((current) => current.id === editingId))) {
          throw new Error('編集中のリストが変更されました。設定画面を開き直してください。');
        }
        const nextLists = [...latest.lists.filter((current) => current.id !== list.id), list];
        const bundle = await loadListBundle(list, nextLists);
        const cache = await loadCache();
        const retained = activeLookupBundles(cache.bundles, latest.lists)
          .filter((current) => current.definition.dataset_id !== list.id);

        const next: LookupSettings = {
          ...latest,
          lists: nextLists,
          useMock: false,
          legacySpreadsheetUrl: undefined,
          legacySheetName: undefined
        };
        await saveListSettingsAndCache(next, applyLookupListDisplayNames([...retained, bundle], nextLists));
        return { next, list };
      });
      setSettings(next);
      setConnected(true);
      setMessage(`✓ ${getLookupListDisplayName(list, next.lists)} を${editingId ? '更新' : '登録'}・同期しました。`);
      setInspection(null);
      setSheetName('');
      setSearchColumns([]);
      setDisplayColumns([]);
      setCopyColumns([]);
      setEditingId(null);
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
      await withSyncLock(async () => {
        const latest = await loadSettings();
        const current = latest.lists.find((item) => item.id === list.id);
        if (!current || JSON.stringify(current) !== JSON.stringify(list)) {
          throw new Error('リストの設定が変更されました。設定画面を開き直してください。');
        }
        const bundle = await loadListBundle(current, latest.lists);
        const cache = await loadCache();
        const retained = activeLookupBundles(cache.bundles, latest.lists)
          .filter((candidate) => candidate.definition.dataset_id !== current.id);
        await saveCache(applyLookupListDisplayNames([...retained, bundle], latest.lists));
      });
      setConnected(true);
      setMessage(`✓ ${getLookupListDisplayName(list, settings.lists)} を再同期しました。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function removeList(listId: string) {
    setBusy(true);
    try {
      const next = await withSyncLock(async () => {
        const latest = await loadSettings();
        const nextLists = latest.lists.filter((list) => list.id !== listId);
        const next = { ...latest, lists: nextLists, useMock: false };
        const cache = await loadCache();
        await saveListSettingsAndCache(next, applyLookupListDisplayNames(
          activeLookupBundles(cache.bundles, nextLists), nextLists
        ));
        return next;
      });
      setSettings(next);
      setMessage('リストを削除しました。');
      if (editingId === listId) {
        setEditingId(null);
        setInspection(null);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  const headers = selectableHeaders(selectedSheet);
  const fieldStyle: React.CSSProperties = { display: 'grid', gap: 6, maxWidth: 360 };
  const selectStyle: React.CSSProperties = { width: '100%', minWidth: 0, padding: '6px 8px', boxSizing: 'border-box' };

  if (!settingsReady) {
    return <main style={{maxWidth:760, margin:'30px auto', fontFamily:'system-ui', padding:'0 18px'}}>
      <h1>LookupBox 設定</h1>
      {settingsError ? <section role="alert">
        <p>{settingsError.message} 設定を読み込めない間は、上書きを防ぐため操作を停止しています。</p>
        {settingsError instanceof InvalidLookupSettingsError && <>
          <p>元の設定をJSONで保存できます。読み取れないリストを除いて続行すると、元の設定もブラウザ内にバックアップします。除いたリストは必要に応じて再登録してください。</p>
          <button disabled={busy} onClick={async () => {
            try {
              const backup = await loadInvalidSettingsBackup();
              const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
              const link = document.createElement('a');
              link.href = url;
              link.download = 'lookup-box-settings-backup.json';
              document.body.appendChild(link);
              link.click();
              link.remove();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
          }}>元の設定JSONを保存</button>{' '}
          <button disabled={busy} onClick={async () => {
            setBusy(true);
            try {
              const recovered = await withSyncLock(recoverInvalidSettings);
              setSettings(recovered);
              setSettingsError(null);
              setSettingsReady(true);
              setMessage('読み取れるリストで復旧しました。元の設定はブラウザ内にもバックアップされています。');
            } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
            finally { setBusy(false); }
          }}>読み取れないリストを除いて続行</button>
        </>}
        <p>{message}</p>
      </section> : <p>設定を読み込んでいます...</p>}
    </main>;
  }

  return (
    <main style={{maxWidth:760, margin:'30px auto', fontFamily:'system-ui', lineHeight:1.55, padding:'0 18px'}}>
      <h1>LookupBox 設定</h1>
      <p>Googleに接続して、Google Sheetを検索リストとして登録します。</p>

      <section style={{border:'1px solid #ddd', borderRadius:10, padding:16, marginBottom:22}}>
        <h2 style={{marginTop:0}}>Google接続</h2>
        <p>現在: <strong>{connected === null ? '確認中' : connected ? '接続済み' : '未接続'}</strong></p>
        <p>Googleの許可画面では、アクセスできるすべてのGoogleスプレッドシートの読み取り権限を求めます。LookupBoxは、入力したURLのシートを確認し、登録したリストのデータを同期・保存します。スプレッドシートを変更する権限は求めません。</p>
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
              <div style={{color:'#666', fontSize:14}}>{list.sheetName} / 表示: {list.displayColumns.join(' → ')}</div>
              <div style={{color:'#666', fontSize:13}}>検索: {list.searchColumns.join('、')} / コピー: {list.copyColumns.join('、') || 'なし'}</div>
              <div style={{color:'#666', fontSize:12, overflowWrap:'anywhere'}}>{list.spreadsheetUrl}</div>
              <div style={{marginTop:8}}>
                <button disabled={busy} onClick={()=>syncList(list)}>再同期</button>{' '}
                <button disabled={busy} onClick={()=>editList(list)}>列を編集</button>{' '}
                <button disabled={busy} onClick={()=>removeList(list.id)}>削除</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2>{editingId ? 'リストの列を編集' : 'Google Sheetを追加'}</h2>
      {editingId && <button disabled={busy} onClick={() => {
        setEditingId(null); setInspection(null); setDraftUrl(''); setSheetName('');
      }}>編集をやめる</button>}
      <p><label>Google Sheet URL<br/><input placeholder="https://docs.google.com/spreadsheets/d/..." style={{width:'100%', padding:8}} value={draftUrl} onChange={(e)=>{
        setDraftUrl(e.target.value);
        setInspection(null);
        setSheetName('');
        setSearchColumns([]);
        setDisplayColumns([]);
        setCopyColumns([]);
        setEditingId(null);
      }}/></label></p>
      <button disabled={busy || !draftUrl} onClick={inspectSheet}>{busy ? '処理中...' : 'Sheetを確認'}</button>{' '}
      {DEMO_ENABLED && settings.lists.length === 0 && <button disabled={busy} onClick={useDemo}>デモで試す</button>}

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
          </div>
          <p>列ごとに検索・表示・コピーを選択してください。表示は上下ボタンで並べ替えられます。</p>
          {!!selectedSheet?.duplicateHeaders?.length && <p role="status" style={{color:'#8a5a00'}}>
            見出しが重複している列は選択できません: {selectedSheet.duplicateHeaders.join('、')}。使う場合はSheetの1行目で名前を変更してください。
          </p>}
          {headers.length === 0 && <p>選べる列がありません。Sheetの1行目の見出しを確認してください。</p>}
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%', borderCollapse:'collapse'}}>
              <thead><tr><th style={{textAlign:'left'}}>列名</th><th>検索</th><th>表示</th><th>コピー</th><th>表示順</th></tr></thead>
              <tbody>{headers.map((header) => {
                const position = displayColumns.indexOf(header);
                return <tr key={header} style={{borderTop:'1px solid #ddd'}}>
                  <th scope="row" style={{textAlign:'left', overflowWrap:'anywhere'}}>{header}</th>
                  <td style={{textAlign:'center'}}><input aria-label={`${header}を検索`} type="checkbox" checked={searchColumns.includes(header)} onChange={()=>toggleColumn(header, 'search')} /></td>
                  <td style={{textAlign:'center'}}><input aria-label={`${header}を表示`} type="checkbox" checked={position >= 0} onChange={()=>toggleColumn(header, 'display')} /></td>
                  <td style={{textAlign:'center'}}><input aria-label={`${header}をコピー`} type="checkbox" disabled={position < 0} checked={copyColumns.includes(header)} onChange={()=>toggleColumn(header, 'copy')} /></td>
                  <td style={{textAlign:'center', whiteSpace:'nowrap'}}>{position >= 0 && <>
                    {position + 1}{' '}
                    <button aria-label={`${header}を上へ`} disabled={position === 0} onClick={()=>moveDisplayColumn(header, -1)}>↑</button>{' '}
                    <button aria-label={`${header}を下へ`} disabled={position === displayColumns.length - 1} onClick={()=>moveDisplayColumn(header, 1)}>↓</button>
                  </>}</td>
                </tr>;
              })}</tbody>
            </table>
          </div>
          <p style={{fontSize:13}}>表示順: {displayColumns.join(' → ') || '未選択'}</p>
          <button style={{marginTop:18}} disabled={busy || searchColumns.length === 0 || displayColumns.length === 0} onClick={addList}>{editingId ? '設定を保存して同期' : '登録して同期'}</button>
        </section>
      )}

      <p style={{minHeight:24}}>{message}</p>
      <hr/>
      <p style={{color:'#666'}}>1行目を列名として扱います。表示済みの文字列を取得するため、Sheet側で設定した先頭ゼロなどの表示形式も保持します。</p>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);

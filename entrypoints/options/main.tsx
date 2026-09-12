import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { SheetInspection, SpreadsheetInspection } from '../../lib/types';
import { loadSettings, saveCache, saveSettings, type LookupSettings } from '../../lib/storage';
import { GoogleSheetsProvider } from '../../lib/providers/googleSheetsProvider';
import { MockProvider } from '../../lib/providers/mockProvider';

function App() {
  const [settings, setSettings] = useState<LookupSettings>({});
  const [inspection, setInspection] = useState<SpreadsheetInspection | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { loadSettings().then(setSettings); }, []);

  async function useDemo() {
    setBusy(true);
    try {
      const bundles = await new MockProvider().load();
      await saveCache(bundles);
      await saveSettings({ ...settings, useMock: true });
      setSettings({ ...settings, useMock: true });
      setMessage('デモデータを読み込みました。Popupで Apple / Microsoft / AAPL / MSFT を検索できます。');
    } finally {
      setBusy(false);
    }
  }

  async function connectSheet() {
    setBusy(true);
    setMessage('Google Sheetを確認しています...');
    try {
      const provider = new GoogleSheetsProvider(settings.gasUrl ?? '', settings.apiToken ?? '');
      const result = await provider.inspect(settings.spreadsheetUrl ?? '');
      setInspection(result);

      if (result.sheets.length === 0) {
        throw new Error('検索できる表示タブが見つかりませんでした。');
      }

      const preferred = result.sheets.find((s) => s.name === settings.sheetName) ?? result.sheets[0];
      if (result.sheets.length === 1 && preferred) {
        await syncSheet(preferred, result);
        return;
      }

      setSettings((current) => ({ ...current, sheetName: preferred?.name, useMock: false }));
      setMessage(`「${result.title}」を読み込みました。対象タブを選んで同期してください。`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function syncSelected() {
    if (!inspection) return;
    const sheet = inspection.sheets.find((s) => s.name === settings.sheetName);
    if (!sheet) {
      setMessage('対象タブを選択してください。');
      return;
    }
    setBusy(true);
    try {
      await syncSheet(sheet, inspection);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function syncSheet(sheet: SheetInspection, currentInspection: SpreadsheetInspection) {
    const headers = sheet.headers.filter(Boolean);
    if (headers.length === 0) throw new Error('1行目に列名がありません。');

    const nextSettings: LookupSettings = {
      ...settings,
      sheetName: sheet.name,
      useMock: false
    };
    await saveSettings(nextSettings);
    setSettings(nextSettings);

    const provider = new GoogleSheetsProvider(
      nextSettings.gasUrl ?? '',
      nextSettings.apiToken ?? '',
      {
        spreadsheetUrl: nextSettings.spreadsheetUrl ?? '',
        sheetName: sheet.name,
        // Simple mode: every column is searchable, visible, and copyable.
        searchColumns: headers,
        displayColumns: headers,
        copyColumns: headers
      }
    );
    const bundles = await provider.load();
    await saveCache(bundles);
    const count = bundles.reduce((n, b) => n + b.rows.length, 0);
    setMessage(`✓ ${currentInspection.title} / ${sheet.name}: ${count}件を同期しました。`);
  }

  return (
    <main style={{maxWidth:720, margin:'30px auto', fontFamily:'system-ui', lineHeight:1.55}}>
      <h1>LookupBox 設定</h1>
      <p>普段使うのは3項目だけです。初回にGAS接続情報を設定し、その後はGoogle Sheet URLを貼り替えるだけで使えます。</p>

      <details>
        <summary>初回だけ：接続設定</summary>
        <p><label>GAS Web App URL<br/><input style={{width:'100%'}} value={settings.gasUrl ?? ''} onChange={(e)=>setSettings({...settings,gasUrl:e.target.value})}/></label></p>
        <p><label>API Token<br/><input type="password" style={{width:'100%'}} value={settings.apiToken ?? ''} onChange={(e)=>setSettings({...settings,apiToken:e.target.value})}/></label></p>
      </details>

      <h2>使うGoogle Sheet</h2>
      <p><label>Google Sheet URL<br/><input placeholder="https://docs.google.com/spreadsheets/d/..." style={{width:'100%', padding:8}} value={settings.spreadsheetUrl ?? ''} onChange={(e)=>setSettings({...settings,spreadsheetUrl:e.target.value})}/></label></p>
      <button disabled={busy} onClick={connectSheet}>{busy ? '処理中...' : 'このSheetを使う'}</button>{' '}
      <button disabled={busy} onClick={useDemo}>デモで試す</button>

      {inspection && inspection.sheets.length > 1 && (
        <section style={{marginTop:20}}>
          <label>検索するタブ<br/>
            <select value={settings.sheetName ?? ''} onChange={(e)=>setSettings({...settings,sheetName:e.target.value})}>
              {inspection.sheets.map((s)=><option key={s.name} value={s.name}>{s.name} ({s.rowCount}件)</option>)}
            </select>
          </label>{' '}
          <button disabled={busy} onClick={syncSelected}>同期</button>
        </section>
      )}

      <p style={{minHeight:24}}>{message}</p>
      <hr/>
      <p style={{color:'#666'}}>シンプルモードでは1行目を列名として、すべての列を検索・表示・コピー対象にします。2列の key-value 表なら追加設定は不要です。</p>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);

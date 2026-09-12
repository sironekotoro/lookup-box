const DATASET_SHEET = '_datasets';

function doPost(e) {
  try {
    const payload = JSON.parse((e.postData && e.postData.contents) || '{}');
    const props = PropertiesService.getScriptProperties();
    const expectedToken = props.getProperty('LOOKUP_API_TOKEN');

    if (!expectedToken) return json_({ ok: false, error: 'LOOKUP_API_TOKEN is not configured.' });
    if (!payload.token || payload.token !== expectedToken) return json_({ ok: false, error: 'Unauthorized' });

    const spreadsheetId = resolveSpreadsheetId_(payload, props);
    enforceAllowlist_(spreadsheetId, props);
    const ss = SpreadsheetApp.openById(spreadsheetId);

    switch (String(payload.action || 'sync_simple')) {
      case 'inspect':
        return json_({ ok: true, spreadsheet: inspectSpreadsheet_(ss) });
      case 'sync_simple':
      case 'sync':
        if (payload.sheet_name) return json_({ ok: true, datasets: [simpleDataset_(ss, payload)] });
        return json_({ ok: true, datasets: advancedDatasets_(ss) });
      case 'sync_advanced':
        return json_({ ok: true, datasets: advancedDatasets_(ss) });
      default:
        return json_({ ok: false, error: 'Unknown action' });
    }
  } catch (err) {
    return json_({ ok: false, error: String((err && err.message) || err) });
  }
}

function inspectSpreadsheet_(ss) {
  const sheets = ss.getSheets()
    .filter(sheet => !sheet.isSheetHidden())
    .map(sheet => {
      const lastColumn = sheet.getLastColumn();
      const headers = lastColumn > 0
        ? sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0].map(String).filter(Boolean)
        : [];
      return {
        name: sheet.getName(),
        headers: headers,
        rowCount: Math.max(0, sheet.getLastRow() - 1)
      };
    })
    .filter(item => item.headers.length > 0);

  return { spreadsheetId: ss.getId(), title: ss.getName(), sheets: sheets };
}

function simpleDataset_(ss, payload) {
  const sheetName = String(payload.sheet_name || '');
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.isSheetHidden()) throw new Error('Sheet not found: ' + sheetName);

  const values = sheet.getDataRange().getDisplayValues();
  if (!values.length) throw new Error('Sheet is empty: ' + sheetName);
  const headers = values[0].map(String).filter(Boolean);
  if (!headers.length) throw new Error('Header row is empty: ' + sheetName);

  const searchColumns = columnsOrDefault_(payload.search_columns, headers);
  const displayColumns = columnsOrDefault_(payload.display_columns, headers);
  const copyColumns = columnsOrDefault_(payload.copy_columns, headers);
  validateColumnNames_(headers, searchColumns.concat(displayColumns, copyColumns), sheetName);

  return {
    definition: {
      dataset_id: datasetId_(sheetName),
      display_name: sheetName,
      sheet_name: sheetName,
      search_columns: searchColumns,
      display_columns: displayColumns,
      copy_columns: copyColumns,
      primary_key: headers[0],
      enabled: true,
      description: 'Simple Google Sheet lookup',
      provider: 'google_sheets'
    },
    rows: rowsFromValues_(headers, values.slice(1))
  };
}

function advancedDatasets_(ss) {
  const configSheet = ss.getSheetByName(DATASET_SHEET);
  if (!configSheet) throw new Error('_datasets sheet not found');

  return sheetObjects_(configSheet)
    .filter(row => bool_(row.enabled))
    .map(config => {
      const sheet = ss.getSheetByName(String(config.sheet_name));
      if (!sheet) throw new Error('Sheet not found: ' + config.sheet_name);
      const definition = {
        dataset_id: String(config.dataset_id),
        display_name: String(config.display_name),
        sheet_name: String(config.sheet_name),
        search_columns: csv_(config.search_columns),
        display_columns: csv_(config.display_columns),
        copy_columns: csv_(config.copy_columns),
        primary_key: String(config.primary_key || ''),
        enabled: true,
        description: String(config.description || ''),
        provider: 'google_sheets'
      };
      const rows = sheetObjects_(sheet);
      const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0].map(String);
      validateColumnNames_(header, definition.search_columns.concat(definition.display_columns, definition.copy_columns), sheet.getName());
      return { definition: definition, rows: rows };
    });
}

function resolveSpreadsheetId_(payload, props) {
  const explicit = String(payload.spreadsheet_id || '').trim();
  if (explicit) return explicit;

  const url = String(payload.spreadsheet_url || '').trim();
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) return match[1];

  const fallback = props.getProperty('LOOKUP_SPREADSHEET_ID');
  if (fallback) return fallback;
  throw new Error('Spreadsheet ID is not specified.');
}

function enforceAllowlist_(spreadsheetId, props) {
  const raw = String(props.getProperty('LOOKUP_ALLOWED_SPREADSHEET_IDS') || '').trim();
  if (!raw) return;
  const allowed = raw.split(',').map(s => s.trim()).filter(Boolean);
  if (allowed.indexOf(spreadsheetId) < 0) throw new Error('Spreadsheet is not in the allowlist.');
}

function columnsOrDefault_(value, headers) {
  if (Array.isArray(value) && value.length) return value.map(String);
  if (typeof value === 'string' && value.trim()) return csv_(value);
  return headers.slice();
}

function rowsFromValues_(headers, rows) {
  return rows
    .filter(row => row.some(value => String(value).trim() !== ''))
    .map(row => {
      const out = {};
      headers.forEach((header, index) => out[header] = String(row[index] == null ? '' : row[index]));
      return out;
    });
}

function sheetObjects_(sheet) {
  const values = sheet.getDataRange().getDisplayValues();
  if (!values.length) return [];
  const headers = values[0].map(String);
  return rowsFromValues_(headers, values.slice(1));
}

function validateColumnNames_(headers, required, sheetName) {
  const known = new Set(headers);
  required.forEach(column => {
    if (!known.has(column)) throw new Error(sheetName + ': missing column ' + column);
  });
}

function datasetId_(name) {
  const value = String(name).normalize('NFKC').toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
  return value || 'sheet';
}
function csv_(value) { return String(value || '').split(',').map(s => s.trim()).filter(Boolean); }
function bool_(value) { return ['true', '1', 'yes', 'on'].indexOf(String(value).trim().toLowerCase()) >= 0; }
function json_(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }

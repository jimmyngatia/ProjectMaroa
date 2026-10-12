/**
 * Receives survey submissions and appends them as rows in this spreadsheet.
 * Paste this into Extensions > Apps Script (inside your Google Sheet), then deploy as a Web app.
 *
 * Columns are created automatically from the first submission, in question order.
 */

const SHEET_NAME = "Responses";
const MAX_CELL_LENGTH = 5000;

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);

    const data = JSON.parse(e.postData.contents);

    // Honeypot: real people never fill this hidden field, bots often do.
    if (data.website) return reply({ ok: true });
    delete data.website;

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);

    // Read existing headers (if any)
    let headers = [];
    if (sheet.getLastColumn() > 0) {
      headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    }

    // Add any new columns we haven't seen before
    const keys = Object.keys(data);
    let changed = false;
    keys.forEach(function (k) {
      if (headers.indexOf(k) === -1) {
        headers.push(k);
        changed = true;
      }
    });
    if (changed) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
      sheet.setFrozenRows(1);
    }

    // Build the row in header order
    const row = headers.map(function (h) {
      return clean(data[h]);
    });
    sheet.appendRow(row);

    return reply({ ok: true });
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// Visiting the URL in a browser shows this, which is handy for checking the deployment.
function doGet() {
  return reply({ ok: true, message: "Survey endpoint is running." });
}

function clean(value) {
  if (value === undefined || value === null) return "";
  if (typeof value === "number") return value;
  let s = String(value).slice(0, MAX_CELL_LENGTH);
  // Stop respondents from injecting spreadsheet formulas
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

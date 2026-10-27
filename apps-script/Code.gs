const TO = "tuananhle2612@gmail.com";
const BRIDE_EMAIL = "nguyenhongthu462@gmail.com";
const SHEET_NAME = "RSVP";
const GUESTBOOK_SHEET_NAME = "Guestbook";
const GUESTBOOK_AUTH_MAX_FAILURES = 5;
const GUESTBOOK_AUTH_LOCKOUT_SECONDS = 900;

function doPost(e) {
  const p = (e && e.parameter) || {};
  if (p.action === "guestbook-create") return createGuestbookWish_(p);
  if (p.action === "guestbook-auth") {
    return guestbookResult_(p.requestId, { ok: isGuestbookAdmin_(p.adminToken) });
  }
  if (p.action === "guestbook-delete") return deleteGuestbookWish_(p);

  if (p.website) return ok_();

  const name = clean_(p.name, 100);
  if (!name) return ok_();
  const attending = p.attendance === "yes";
  const guests = attending ? Math.max(1, Math.min(20, parseInt(p.guests, 10) || 1)) : 0;
  const message = clean_(p.message, 500);

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["Thời gian", "Tên", "Tham dự", "Số khách", "Lời nhắn"]);
    }
    sheet.appendRow([new Date(), safe_(name), attending ? "Có" : "Không", guests, safe_(message)]);
  } finally {
    lock.releaseLock();
  }

  const status = attending ? "Có tham dự (" + guests + " người)" : "Không tham dự";
  MailApp.sendEmail({
    to: attending ? [TO, BRIDE_EMAIL].join(",") : TO,
    subject: "RSVP: " + name + " - " + status,
    body: "Tên: " + name + "\nTham dự: " + status + "\nLời nhắn: " + (message || "-"),
  });
  return ok_();
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action !== "guestbook-list") return ok_();

  const callback = String(p.callback || "");
  if (!/^guestbookCallback\d+$/.test(callback)) {
    return ContentService.createTextOutput("Invalid callback");
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(GUESTBOOK_SHEET_NAME);
  const wishes = [];
  if (sheet && sheet.getLastRow() > 1) {
    const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues();
    rows.reverse().forEach((row) => {
      wishes.push({
        id: String(row[0]),
        createdAt: row[1] instanceof Date ? row[1].toISOString() : new Date(row[1]).toISOString(),
        name: String(row[2]),
        message: String(row[3]),
      });
    });
  }

  const json = JSON.stringify({ ok: true, wishes })
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
  return ContentService.createTextOutput(callback + "(" + json + ");")
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function createGuestbookWish_(p) {
  const name = clean_(p.name, 100);
  const message = clean_(p.message, 1000);
  if (!name || !message) return guestbookResult_(p.requestId, { ok: false, error: "Name and message are required." });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = guestbookSheet_();
    sheet.appendRow([Utilities.getUuid(), new Date(), safe_(name), safe_(message)]);
  } finally {
    lock.releaseLock();
  }
  return guestbookResult_(p.requestId, { ok: true });
}

function deleteGuestbookWish_(p) {
  if (!isGuestbookAdmin_(p.adminToken)) {
    return guestbookResult_(p.requestId, { ok: false, error: "Not authorized." });
  }
  const id = clean_(p.id, 100);
  if (!id) return guestbookResult_(p.requestId, { ok: false, error: "Missing wish ID." });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(GUESTBOOK_SHEET_NAME);
    if (sheet && sheet.getLastRow() > 1) {
      const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getDisplayValues();
      const rowIndex = ids.findIndex((row) => row[0] === id);
      if (rowIndex !== -1) {
        sheet.deleteRow(rowIndex + 2);
        return guestbookResult_(p.requestId, { ok: true });
      }
    }
  } finally {
    lock.releaseLock();
  }
  return guestbookResult_(p.requestId, { ok: false, error: "Wish not found." });
}

function guestbookSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(GUESTBOOK_SHEET_NAME) || ss.insertSheet(GUESTBOOK_SHEET_NAME);
  if (sheet.getLastRow() === 0) sheet.appendRow(["ID", "Thời gian", "Tên", "Lời chúc"]);
  return sheet;
}

function isGuestbookAdmin_(token) {
  const expected = PropertiesService.getScriptProperties().getProperty("GUESTBOOK_ADMIN_TOKEN");
  const cache = CacheService.getScriptCache();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (cache.get("guestbookAdminLocked") === "1") return false;

    const isValid = Boolean(
      expected &&
      /^\d{6}$/.test(expected) &&
      token &&
      /^\d{6}$/.test(String(token)) &&
      String(token) === expected,
    );
    if (isValid) {
      cache.remove("guestbookAdminFailures");
      return true;
    }

    const failures = Number(cache.get("guestbookAdminFailures") || 0) + 1;
    if (failures >= GUESTBOOK_AUTH_MAX_FAILURES) {
      cache.put("guestbookAdminLocked", "1", GUESTBOOK_AUTH_LOCKOUT_SECONDS);
      cache.remove("guestbookAdminFailures");
    } else {
      cache.put("guestbookAdminFailures", String(failures), GUESTBOOK_AUTH_LOCKOUT_SECONDS);
    }
    return false;
  } finally {
    lock.releaseLock();
  }
}

function guestbookResult_(requestId, result) {
  const id = String(requestId || "");
  if (!/^guestbook[a-f0-9]{32}$/.test(id)) {
    return HtmlService.createHtmlOutput("Invalid request");
  }
  const payload = JSON.stringify({ ...result, requestId: id })
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
  return HtmlService.createHtmlOutput(
    "<!doctype html><script>window.top.postMessage(" + payload + ", '*');</script>",
  ).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function clean_(v, max) {
  return String(v || "").trim().slice(0, max);
}

function safe_(s) {
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function ok_() {
  return ContentService.createTextOutput("ok");
}

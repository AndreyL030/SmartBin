/**
 * SmartBin — приёмник сообщений чата поддержки.
 *
 * Как включить (5–10 минут, бесплатно, без карты):
 * 1. Откройте https://script.google.com → «Новый проект».
 * 2. Удалите заготовку и вставьте этот файл целиком.
 * 3. «Развернуть» → «Новое развёртывание» → тип «Веб-приложение».
 *    - Запуск от имени: Я
 *    - У кого есть доступ: Все
 * 4. Скопируйте адрес вида https://script.google.com/macros/s/AKfy.../exec
 * 5. В репозитории откройте data/chat.json и впишите его в поле inbox:
 *    { "inbox": "https://script.google.com/macros/s/.../exec" }
 * 6. Перезагрузите админку — раздел «Обращения» начнёт показывать сообщения.
 *
 * Сообщения хранятся в Google Таблице «SmartBin chat» на вашем Диске.
 * Протокол:
 *   GET  ?action=list                    → { ok, messages: [...] }
 *   POST { action: 'send', message: {...} }  → { ok, id }
 *   POST { action: 'reply', id, text, ts }   → { ok }
 */

var SHEET_NAME = 'chat';
var HEADERS = ['id', 'ts', 'name', 'contact', 'text', 'device', 'reply', 'replyTs'];

function getSheet_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('sheetId');
  var ss = null;

  if (id) {
    try { ss = SpreadsheetApp.openById(id); } catch (err) { ss = null; }
  }
  if (!ss) {
    ss = SpreadsheetApp.create('SmartBin chat');
    props.setProperty('sheetId', ss.getId());
  }

  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
  }
  return sheet;
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function rows_(sheet) {
  var values = sheet.getDataRange().getValues();
  return values.slice(1).filter(function (row) { return row[0]; });
}

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'list';

  if (action !== 'list') {
    return json_({ ok: false, error: 'unknown action' });
  }

  var sheet = getSheet_();
  var messages = rows_(sheet).map(function (row) {
    return {
      id: String(row[0]),
      ts: String(row[1] || ''),
      name: String(row[2] || ''),
      contact: String(row[3] || ''),
      text: String(row[4] || ''),
      device: String(row[5] || ''),
      reply: String(row[6] || ''),
      replyTs: String(row[7] || '')
    };
  });

  return json_({ ok: true, messages: messages.slice(-300) });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);

  try {
    var payload = {};
    try {
      payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    } catch (err) {
      payload = {};
    }

    var sheet = getSheet_();
    var action = payload.action || '';

    if (action === 'send') {
      var msg = payload.message || {};
      var text = String(msg.text || '').slice(0, 2000);
      if (!text) return json_({ ok: false, error: 'empty text' });

      var id = 'm' + Date.now() + Math.floor(Math.random() * 1000);
      sheet.appendRow([
        id,
        String(msg.ts || new Date().toISOString()),
        String(msg.name || '').slice(0, 80),
        String(msg.contact || '').slice(0, 120),
        text,
        String(msg.device || '').slice(0, 40),
        '',
        ''
      ]);
      return json_({ ok: true, id: id });
    }

    if (action === 'reply') {
      var targetId = String(payload.id || '');
      var replyText = String(payload.text || '').slice(0, 2000);
      if (!targetId || !replyText) return json_({ ok: false, error: 'bad reply' });

      var data = sheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i += 1) {
        if (String(data[i][0]) === targetId) {
          sheet.getRange(i + 1, 7).setValue(replyText);
          sheet.getRange(i + 1, 8).setValue(String(payload.ts || new Date().toISOString()));
          return json_({ ok: true });
        }
      }
      return json_({ ok: false, error: 'not found' });
    }

    return json_({ ok: false, error: 'unknown action' });
  } finally {
    lock.releaseLock();
  }
}

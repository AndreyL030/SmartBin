/**
 * SmartBin — приёмник чата и заказов.
 *
 * Как обновить (2 минуты):
 * 1. Откройте свой проект на https://script.google.com
 * 2. Замените весь код этим файлом → «Сохранить».
 * 3. «Развернуть» → «Управление развёртываниями» → карандаш у текущего →
 *    «Версия: Новая версия» → «Развернуть». Адрес /exec остаётся тем же.
 *
 * Пока скрипт старой версии, сайт присылает заказ обычным сообщением —
 * в админке он появится в разделе «Заказы с сайта» как текст.
 *
 * Действия:
 *   GET  ?action=list                 → сообщения чата
 *   GET  ?action=orders               → заказы
 *   POST { action:'send',  message }  → новое сообщение
 *   POST { action:'reply', id, text } → ответ оператора
 *   POST { action:'order', order }    → новый заказ
 *   POST { action:'orderStatus', id, status } → статус заказа
 */

var CHAT_SHEET = 'chat';
var CHAT_HEADERS = ['id', 'ts', 'name', 'contact', 'text', 'device', 'reply', 'replyTs'];

var ORDER_SHEET = 'orders';
var ORDER_HEADERS = ['id', 'ts', 'number', 'name', 'phone', 'email', 'city', 'address',
  'deliveryKind', 'delivery', 'items', 'total', 'status'];

function book_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('sheetId');
  var ss = null;

  if (id) {
    try { ss = SpreadsheetApp.openById(id); } catch (err) { ss = null; }
  }
  if (!ss) {
    ss = SpreadsheetApp.create('SmartBin data');
    props.setProperty('sheetId', ss.getId());
  }
  return ss;
}

function sheet_(name, headers) {
  var ss = book_();
  var sheet = ss.getSheetByName(name);

  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.appendRow(headers);

  return sheet;
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function rows_(sheet) {
  return sheet.getDataRange().getValues().slice(1).filter(function (row) { return row[0]; });
}

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'list';

  if (action === 'list') {
    var chat = sheet_(CHAT_SHEET, CHAT_HEADERS);
    var messages = rows_(chat).map(function (row) {
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

  if (action === 'orders') {
    var ordersSheet = sheet_(ORDER_SHEET, ORDER_HEADERS);
    var orders = rows_(ordersSheet).map(function (row) {
      var items = [];
      try { items = JSON.parse(String(row[10] || '[]')); } catch (err) { items = []; }

      return {
        id: String(row[0]),
        ts: String(row[1] || ''),
        number: String(row[2] || ''),
        name: String(row[3] || ''),
        phone: String(row[4] || ''),
        email: String(row[5] || ''),
        city: String(row[6] || ''),
        address: String(row[7] || ''),
        deliveryKind: String(row[8] || ''),
        delivery: Number(row[9] || 0),
        items: items,
        total: Number(row[11] || 0),
        status: String(row[12] || 'new')
      };
    });
    return json_({ ok: true, orders: orders.slice(-300) });
  }

  return json_({ ok: false, error: 'unknown action' });
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

    var action = payload.action || '';

    if (action === 'send') {
      var chat = sheet_(CHAT_SHEET, CHAT_HEADERS);
      var msg = payload.message || {};
      var text = String(msg.text || '').slice(0, 2000);
      if (!text) return json_({ ok: false, error: 'empty text' });

      var id = 'm' + Date.now() + Math.floor(Math.random() * 1000);
      chat.appendRow([
        id,
        String(msg.ts || new Date().toISOString()),
        String(msg.name || '').slice(0, 120),
        String(msg.contact || '').slice(0, 120),
        text,
        String(msg.device || '').slice(0, 40),
        '',
        ''
      ]);
      return json_({ ok: true, id: id });
    }

    if (action === 'reply') {
      var chatSheet = sheet_(CHAT_SHEET, CHAT_HEADERS);
      var targetId = String(payload.id || '');
      var replyText = String(payload.text || '').slice(0, 2000);
      if (!targetId || !replyText) return json_({ ok: false, error: 'bad reply' });

      var chatRows = chatSheet.getDataRange().getValues();
      for (var i = 1; i < chatRows.length; i += 1) {
        if (String(chatRows[i][0]) === targetId) {
          chatSheet.getRange(i + 1, 7).setValue(replyText);
          chatSheet.getRange(i + 1, 8).setValue(String(payload.ts || new Date().toISOString()));
          return json_({ ok: true });
        }
      }
      return json_({ ok: false, error: 'not found' });
    }

    if (action === 'order') {
      var ordersSheet = sheet_(ORDER_SHEET, ORDER_HEADERS);
      var order = payload.order || {};
      var customer = order.customer || {};
      var items = Array.isArray(order.items) ? order.items : [];

      if (!order.number || !items.length) {
        return json_({ ok: false, error: 'bad order' });
      }

      var orderId = 'o' + Date.now() + Math.floor(Math.random() * 1000);
      ordersSheet.appendRow([
        orderId,
        String(order.createdAt || new Date().toISOString()),
        String(order.number).slice(0, 40),
        String(customer.name || '').slice(0, 120),
        String(customer.phone || '').slice(0, 60),
        String(customer.email || '').slice(0, 120),
        String(customer.city || '').slice(0, 80),
        String(customer.address || '').slice(0, 200),
        String(order.deliveryKind || 'courier'),
        Number(order.delivery || 0),
        JSON.stringify(items).slice(0, 5000),
        Number(order.total || 0),
        'new'
      ]);

      return json_({ ok: true, id: orderId });
    }

    if (action === 'orderStatus') {
      var sheet = sheet_(ORDER_SHEET, ORDER_HEADERS);
      var wanted = String(payload.id || '');
      var status = String(payload.status || '');
      if (!wanted || !status) return json_({ ok: false, error: 'bad status' });

      var data = sheet.getDataRange().getValues();
      for (var j = 1; j < data.length; j += 1) {
        if (String(data[j][0]) === wanted) {
          sheet.getRange(j + 1, 13).setValue(status);
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

var USERS_SHEET_NAME = "Users";
var MENU_SHEET_NAME = "Sheet1";

var TELEGRAM_BOT_TOKEN = "9179289836:AAFYWKGeXYoXhvMNAS_tcvYoTLpjRcY01-E";
var TELEGRAM_GROUP_ID = "-5598548166";

function sendTelegramNotification(shopName, username, phone, email) {
  var message = "🚨 🔔 មានការចុះឈ្មោះហាងថ្មីនៅលើ OS Menu!\n\n" +
                "🏪 ឈ្មោះហាង: " + shopName + "\n" +
                "👤 Username: " + username + "\n" +
                "📞 លេខទូរស័ព្ទ: " + phone + "\n" +
                "📧 Email: " + (email || "អត់មាន") + "\n" +
                "⏱ ពេលវេលា: " + new Date().toLocaleString();
                
  var url = "https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/sendMessage?chat_id=" + TELEGRAM_GROUP_ID + "&text=" + encodeURIComponent(message);
  try { UrlFetchApp.fetch(url); } catch (err) { console.error("Telegram Error: " + err.toString()); }
}

function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var menuSheet = ss.getSheetByName(MENU_SHEET_NAME);
  var menuItems = [];
  var targetOwner = e && e.parameter && e.parameter.shop ? String(e.parameter.shop).trim() : "";

  if (menuSheet) {
    var menuData = menuSheet.getDataRange().getValues();
    if (menuData.length > 1) {
      var mHeaders = menuData[0];
      for (var m = 1; m < menuData.length; m++) {
        var mRow = menuData[m];
        var mItem = {};
        for (var n = 0; n < mHeaders.length; n++) { mItem[mHeaders[n]] = mRow[n]; }
        if (!targetOwner || String(mItem.owner).trim() === targetOwner) { menuItems.push(mItem); }
      }
    }
  }
  return ContentService.createTextOutput(JSON.stringify({ status: "Secure API Running", items: menuItems })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // ១. Login
    if (data.action === 'login') {
      var sheet = ss.getSheetByName(USERS_SHEET_NAME);
      if (!sheet) return ContentService.createTextOutput(JSON.stringify({result: 'error', message: 'រកមិនឃើញទិន្នន័យគណនីទេ!'})).setMimeType(ContentService.MimeType.JSON);
      
      var rows = sheet.getDataRange().getValues();
      var headers = rows[0];
      var userIdx = headers.indexOf('username');
      var passIdx = headers.indexOf('password');
      var shopNameIdx = headers.indexOf('shopname');
      var avatarIdx = headers.indexOf('avatar'); // Column H (ស្មើ index 7 បើចាប់ផ្តើមពី 0)
      
      for (var i = 1; i < rows.length; i++) {
        var dbUser = String(rows[i][userIdx]).trim();
        var dbPass = String(rows[i][passIdx]).trim();
        
        if (dbUser === String(data.username).trim() && (data.password === "" || dbPass === String(data.password).trim())) {
          var shopName = shopNameIdx !== -1 ? rows[i][shopNameIdx] : dbUser;
          var avatarUrl = (avatarIdx !== -1 && rows[i][avatarIdx]) ? rows[i][avatarIdx] : "";
          
          var menuSheet = ss.getSheetByName(MENU_SHEET_NAME);
          var menuItems = [];
          if (menuSheet) {
            var menuData = menuSheet.getDataRange().getValues();
            if (menuData.length > 1) {
              var mHeaders = menuData[0];
              for (var m = 1; m < menuData.length; m++) {
                var mRow = menuData[m];
                var mItem = {};
                for (var n = 0; n < mHeaders.length; n++) { mItem[mHeaders[n]] = mRow[n]; }
                if (String(mItem.owner).trim() === dbUser) { menuItems.push(mItem); }
              }
            }
          }

          return ContentService.createTextOutput(JSON.stringify({
            result: 'success',
            username: dbUser,
            shopname: shopName,
            avatar: avatarUrl,
            menu: menuItems
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({result: 'error', message: 'Username ឬ Password មិនត្រឹមត្រូវទេ!'})).setMimeType(ContentService.MimeType.JSON);
    }

    // ២. Register
    else if (data.action === 'register') {
      var sheet = ss.getSheetByName(USERS_SHEET_NAME);
      if (!sheet) {
        sheet = ss.insertSheet(USERS_SHEET_NAME);
        sheet.appendRow(['id', 'shopname', 'username', 'password', 'phone', 'email', 'status', 'avatar']);
      }
      var rows = sheet.getDataRange().getValues();
      var headers = rows[0];
      var userIdx = headers.indexOf('username');
      var phoneIdx = headers.indexOf('phone');
      
      for (var i = 1; i < rows.length; i++) {
        if (String(rows[i][userIdx]).trim() === String(data.username).trim()) {
          return ContentService.createTextOutput(JSON.stringify({result: 'error', message: 'Username នេះមានម្ចាស់ប្រើប្រាស់រួចហើយ!'})).setMimeType(ContentService.MimeType.JSON);
        }
        if (phoneIdx !== -1 && String(rows[i][phoneIdx]).trim() === String(data.phone).trim()) {
          return ContentService.createTextOutput(JSON.stringify({result: 'error', message: 'លេខទូរស័ព្ទនេះត្រូវបានចុះឈ្មោះរួចរាល់ហើយ!'})).setMimeType(ContentService.MimeType.JSON);
        }
      }
      
      sheet.appendRow([Date.now(), data.shopName || '', data.username || '', data.password || '', data.phone || '', data.email || '', 'នៅលក់', '']);
      sendTelegramNotification(data.shopName, data.username, data.phone, data.email);

      return ContentService.createTextOutput(JSON.stringify({result: 'success'})).setMimeType(ContentService.MimeType.JSON);
    } 

    // ៣. Update Avatar (Column H)
    else if (data.action === 'updateAvatar') {
      var sheet = ss.getSheetByName(USERS_SHEET_NAME);
      var rows = sheet.getDataRange().getValues();
      var headers = rows[0];
      var userIdx = headers.indexOf('username');
      var avatarIdx = headers.indexOf('avatar');
      
      if (avatarIdx === -1) {
        sheet.getRange(1, headers.length + 1).setValue('avatar');
        avatarIdx = headers.length;
      }

      for (var i = 1; i < rows.length; i++) {
        if (String(rows[i][userIdx]).trim() === String(data.username).trim()) {
          sheet.getRange(i + 1, avatarIdx + 1).setValue(data.avatar);
          return ContentService.createTextOutput(JSON.stringify({result: 'success'})).setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({result: 'error', message: 'User not found'})).setMimeType(ContentService.MimeType.JSON);
    }
    
    // ៤. Sync Menu
    else if (data.action === 'sync') {
      var sheet = ss.getSheetByName(MENU_SHEET_NAME);
      if (!sheet) sheet = ss.getSheets()[0];
      
      var newItems = data.items || [];
      var existingData = sheet.getDataRange().getValues();
      var standardKeys = ['id', 'name', 'category', 'unit', 'price_1', 'price_2', 'image_1', 'image_2', 'image_3', 'image_4', 'image_5', 'status', 'owner'];
      
      var ownerIdx = existingData.length > 0 ? existingData[0].indexOf('owner') : -1;
      var currentOwner = newItems.length > 0 ? newItems[0].owner : '';

      var keptItems = [];
      if (existingData.length > 1 && ownerIdx !== -1) {
        var headers = existingData[0];
        for (var r = 1; r < existingData.length; r++) {
          var rowObj = {};
          var rowVal = existingData[r];
          for (var c = 0; c < headers.length; c++) { rowObj[headers[c]] = rowVal[c]; }
          if (String(rowObj.owner).trim() !== String(currentOwner).trim()) { keptItems.push(rowObj); }
        }
      }

      var finalItems = keptItems.concat(newItems);
      sheet.clearContents();
      sheet.appendRow(standardKeys);
      
      var rowsToAdd = [];
      for (var k = 0; k < finalItems.length; k++) {
        var rowData = [];
        var curItm = finalItems[k];
        for (var l = 0; l < standardKeys.length; l++) { rowData.push(curItm[standardKeys[l]] || ''); }
        rowsToAdd.push(rowData);
      }
      
      if (rowsToAdd.length > 0) { sheet.getRange(2, 1, rowsToAdd.length, standardKeys.length).setValues(rowsToAdd); }
      return ContentService.createTextOutput(JSON.stringify({result: 'success'})).setMimeType(ContentService.MimeType.JSON);
    }
    
    return ContentService.createTextOutput(JSON.stringify({result: 'error', message: 'Invalid action'})).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({result: 'error', message: err.toString()})).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}
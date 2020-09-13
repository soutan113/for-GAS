const ss = SpreadsheetApp.getActive()
const authToken = PropertiesService.getScriptProperties().getProperty('authToken') || ''

/**
 * レスポンスを作成して返します
 * @param {*} content
 * @returns {TextOutput}
 */
function response (content) {
  const res = ContentService.createTextOutput()
  res.setMimeType(ContentService.MimeType.JSON)
  res.setContent(JSON.stringify(content))
  return res
}

/**
 * アプリにPOSTリクエストが送信されたとき実行されます
 * @param {Event} e
 * @returns {TextOutput}
 */
function doPost (e) {
  let contents
  try {
    contents = JSON.parse(e.postData.contents)
  } catch (e) {
    return response({ error: 'JSONの形式が正しくありません' })
  }

  if (contents.authToken !== authToken) {
    return response({ error: '認証に失敗しました' })
  }

  const { method = '', params = {} } = contents

  let result
  try {
    switch (method) {
      case 'POST':
        result = onPost(params)
        break
      case 'GET':
        result = onGet(params)
        break
      case 'PUT':
        result = onPut(params)
        break
      case 'DELETE':
        result = onDelete(params)
        break
      default:
        result = { error: 'methodを指定してください' }
    }
  } catch (e) {
    result = { error: e }
  }

  return response(result)
}

/** --- API --- */

/**
 * 指定年月のデータ一覧を取得します
 * @param {Object} params
 * @param {String} params.yearMonth 年月
 * @returns {Object[]} 家計簿データ
 */
function onGet ({ yearMonth }) {
  const ymReg = /^[0-9]{4}-(0[1-9]|1[0-2])$/

  if (!ymReg.test(yearMonth)) {
    return {
      error: '正しい形式で入力してください'
    }
  }

  const sheet = ss.getSheetByName(yearMonth)
  const lastRow = sheet ? sheet.getLastRow() : 0

  if (lastRow < 2) {
    return []
  }

  const list = sheet.getRange('A2:F' + lastRow).getValues().map(row => {
    const [id, date, category, yuta, kana, memo] = row
    return {
      id,
      date,
      category,
      yuta: (yuta === '') ? null : yuta,
      kana: (kana === '') ? null : kana,
      memo
    }
  })

  return list
}

/** --- API --- */

/**
 * データを追加します
 * @param {Object} params
 * @param {Object} params.item 家計簿データ
 * @returns {Object} 追加した家計簿データ
 */
function onPost ({ item }) {
  if (!isValid(item)) {
    return {
      error: '正しい形式で入力してください'
    }
  }
  const { date, category, yuta, kana, memo } = item

  const yearMonth = date.slice(0, 7)
  const sheet = ss.getSheetByName(yearMonth) || insertTemplate(yearMonth)

  const id = Utilities.getUuid().slice(0, 8)
  const row = ["'" + id, "'" + date, "'" + category, yuta, kana, "'" + memo]
  sheet.appendRow(row)

  return { id, date, category, yuta, kana, memo }
}

          
function onDelete ({ yearMonth, id }) {
  const ymReg = /^[0-9]{4}-(0[1-9]|1[0-2])$/
  const sheet = ss.getSheetByName(yearMonth)

  if (!ymReg.test(yearMonth) || sheet === null) {
    return {
      error: '指定のシートは存在しません'
    }
  }

  const lastRow = sheet.getLastRow()
  const index = sheet.getRange('A2:A' + lastRow).getValues().flat().findIndex(v => v === id)

  if (index === -1) {
    return {
      error: '指定のデータは存在しません'
    }
  }

  sheet.deleteRow(index + 2)
  
  return {
    message: '削除完了しました'
  }
}          
          
/**
 * 指定データを更新します
 * @param {Object} params
 * @param {String} params.beforeYM 更新前の年月
 * @param {Object} params.item 家計簿データ
 * @returns {Object} 更新後の家計簿データ
 */
function onPut ({ beforeYM, item }) {
  const ymReg = /^[0-9]{4}-(0[1-9]|1[0-2])$/
  if (!ymReg.test(beforeYM) || !isValid(item)) {
    return {
      error: '正しい形式で入力してください'
    }
  }

  // 更新前と後で年月が違う場合、データ削除と追加を実行
  const yearMonth = item.date.slice(0, 7)
  if (beforeYM !== yearMonth) {
    onDelete({ yearMonth: beforeYM, id: item.id })
    return onPost({ item })
  }

  const sheet = ss.getSheetByName(yearMonth)
  if (sheet === null) {
    return {
      error: '指定のシートは存在しません'
    }
  }

  const id = item.id
  const lastRow = sheet.getLastRow()
  const index = sheet.getRange('A2:A' + lastRow).getValues().flat().findIndex(v => v === id)

  if (index === -1) {
    return {
      error: '指定のデータは存在しません'
    }
  }

  const row = index + 2
  const { date, category, yuta, kana, memo } = item

  const values = [["'" + date, "'" + category, yuta, kana, "'" + memo]]
  sheet.getRange(`B${row}:F${row}`).setValues(values)
  

  return { id, date, category, yuta, kana, memo }
}          
           
/** --- common --- */

/**
 * 指定年月のテンプレートシートを作成します
 * @param {String} yearMonth
 * @returns {Sheet} sheet
 */
function insertTemplate (yearMonth) {
  const { SOLID_MEDIUM, DOUBLE } = SpreadsheetApp.BorderStyle

  const sheet = ss.insertSheet(yearMonth, 0)
  const [year, month] = yearMonth.split('-')

  // テーブルヘッダー
  sheet.getRange('A1:F1')
    .setValues([['id', '日付', 'カテゴリ', '悠太', '佳菜子', 'メモ']])
    .setFontWeight('bold')
    .setBorder(null, null, true, null, null, null, 'black', SOLID_MEDIUM)

  sheet.getRange('D7:E')
    .setNumberFormat('#,##0')

  log('info', '[insertTemplate] シートを作成しました シート名: ' + yearMonth)       
          
  return sheet
}

/**
 * データが正しい形式か検証します
 * @param {Object} item
 * @returns {Boolean} isValid
 */
function isValid (item = {}) {
  const strKeys = ['date', 'category', 'memo']
  const keys = [...strKeys, 'yuta', 'kana']

  // すべてのキーが存在するか
  for (const key of keys) {
    if (item[key] === undefined) return false
  }

  // 収支以外が文字列であるか
  for (const key of strKeys) {
    if (typeof item[key] !== 'string') return false
  }

  // 日付が正しい形式であるか
  const dateReg = /^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/
  if (!dateReg.test(item.date)) return false

  // 収支のどちらかが入力されているか
  const { yuta: i, kana: o } = item
  if ((i === null && o === null) || (i !== null && o !== null)) return false

  // 入力された収支が数字であるか
  if (i !== null && typeof i !== 'number') return false
  if (o !== null && typeof o !== 'number') return false

  return true
}
  
  
  
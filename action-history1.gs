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

  const { method = '', params = {}} = contents

  let result
  try {
    switch (method) {
      case 'POST':
        result = onPost(params)
        break
      case 'GET':
        result = onGet()
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
 * データ一覧を取得します
 */

function onGet () {

  const sheet = ss.getSheetByName('2020')
  const lastRow = sheet ? sheet.getLastRow() : 0

  const list = sheet.getRange('A2:C' + lastRow).getValues().map(row => {
    const [date, temperature, memo] = row
    return {
      date,
      temperature,
      memo
    }
  })

  return list
}

/** --- API --- */
/**
 * データを追加します
 */

function onPost ({ item }) {

  const { date, temperature, memo } = item

  const sheet = ss.getSheetByName('2020') || insertTemplate('2020')

  const row = ["'" + date, temperature, "'" + memo]
  sheet.appendRow(row)

  return { date, temperature, memo }
}


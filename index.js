// スプシの設定
const SS = SpreadsheetApp.getActiveSpreadsheet();
const SHEET = SS.getSheetByName('シート1');
const BKUP = SS.getSheetByName('backup');

// 環境変数をまとめて呼び出しておく。
const prop = PropertiesService.getScriptProperties().getProperties();

// グルーバル変数の定義
//これはシフトの範囲外に出たものがあったときに使う
let TIMERANGE=new Array();


function doPost(e) {
  //slackと連携するためのTokenをSlackAppに渡す。
  let app = SlackApp.create(prop.slackToken);
  //POSTされた情報を使ってメッセージを作る
  let message = e.parameter.text;
  let msg_ary = message.split(/\n/);
  // シフト範囲外に出ていた場合のboolean
  // 手動でメッセージ入力するデータ例
  //let message="ああああ\n当日の欠勤がありました。\n以下の日付で出勤ができる方はスレッドにて宣言してください。\n先着1名様に交代して出勤する権利を贈呈します。\nメンター名\n@m-yo\nランク：S3\n日程：2/15\n時間帯：13:00-22:00";
  //let msg_ary = message.split("\n");
  //以下の文が含まれていなければ終了
  if (!message.includes("以下の日付で出勤ができる方はスレッドにて宣言してください。"))return;
  let rank = msg_ary[6].replace("ランク：", "");
  let date = msg_ary[7].replace("日程：", "");
  let time_range = msg_ary[8].replace("時間帯：", "");
  if(rank === "JE/エンジニアメンター" || rank === "コンテンツ")　return;

  //日程判定
  //spredsheetから日程と時間を呼び出してくる。
  let dates = getDates();

  //データがもし入っていなかったらspredsheetにデータがないということ
  if(dates.indexOf(date) < 0) return;
  //Sheetオブジェクト.getRange(行番号, 列番号, 行数, 列数)
  let row = SHEET.getRange(dates.indexOf(date)+1, 1, 1, 2).getValues();
  if (!isValidTimeRange(row,time_range))return;
  removeDate(dates.indexOf(date));
  //POST元が違っていたらエラー
  if (prop.verifyToken != e.parameter.token) {
    post_msg = "invalid token.";
  }
  //特定のチャンネルにメッセージをPOSTする。
  //console.log(TIMERANGE[0]+"~"+TIMERANGE[1]+"で出勤可能です!");
  //"<!subteam^S035UDA2D6D> <!subteam^SKJUP5BL2>\n"+
  app.postMessage("#129_work_information",TIMERANGE[0]+"~"+TIMERANGE[1]+"で出勤可能です!", {
    thread_ts: e.parameter.timestamp,
    as_user: true
  });
}

function getDates() {
  //valuesに8列分のデータをspredsheetから格納
  const values = SHEET.getRange('A1:A14').getValues();
  //result配列を作成
  const result = new Array();
  //valuesのカラムの数だけ繰り返し。
  values.map(value => {
    //値が存在するかどうかを判定
    if (value != null && value != "") {
      //値が存在したらresultにpushしていく。
      result.push(value[0]);
    }
  })
  //返り値はresult
  return  result;
}

function removeDate(indexOfDate) {
  SHEET.deleteRows(indexOfDate + 1);
}

function rangeSpliter(range) {
  return range.split(/-|~|ー| ~ | - | ー | 〜 |〜/);
}
function timespliter(time){
  return time.split(/:|：/)
}

function isValidTimeRange(idealTimeRangeAry, timeRange) {
  const [start, end] = rangeSpliter(timeRange)
  const [idstart,idend] = rangeSpliter(idealTimeRangeAry[0][1])
  const ideal_start_min = Number(timespliter(idstart)[0])*60+Number(timespliter(idstart)[1])
  const ideal_end_min = Number(timespliter(idend)[0])*60+Number(timespliter(idend)[1])
  const start_min = Number(timespliter(start)[0])*60+Number(timespliter(start)[1])
  const end_min = Number(timespliter(end)[0])*60+Number(timespliter(end)[1])
  //idealは自分の希望時間, 無印は欠勤申請時間
  //希望勤務時間と欠勤申請がジャストだった場合。
  //欠勤申請が後ろにはみ出た場合
  if (start_min === ideal_start_min && end_min===ideal_end_min){
    TIMERANGE.push(start)
    TIMERANGE.push(idend)
    return 1;
  }

  //欠勤申請が後ろにはみ出た場合
  if (start_min >= ideal_start_min && end_min>=ideal_end_min && (ideal_end_min-start_min)>=180){
    TIMERANGE.push(start)
    TIMERANGE.push(idend)
    return 1;
  }
  //欠勤申請が前にはみ出た場合
  else if(start_min<=ideal_start_min && end_min<=ideal_end_min && (end_min-ideal_start_min)>=180){
    TIMERANGE.push(idstart)
    TIMERANGE.push(end)
    return 1;
  }
  //希望申請時間内に欠勤希望申請時間が綺麗に入っていた場合
  else if(start_min>=ideal_start_min && end_min<=ideal_end_min && (end_min-start_min)>=180){
    TIMERANGE.push(start)
    TIMERANGE.push(end)
    return 1;
  }
  //欠勤申請時間内に希望申請時間が綺麗に入っていた場合
  else if(start_min<=ideal_start_min && end_min>=ideal_end_min && (ideal_end_min-ideal_start_min)>=180){
    TIMERANGE.push(idstart)
    TIMERANGE.push(idend)
    return 1;
  }
  return 0;
}
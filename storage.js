// ブラウザのLocalStorageにデータを保存する際の「引き出しの名前（キー）」を定数として定義します
const STORAGE_KEY = 'tohotabi_app_data_v1';

// アプリ初回起動時やデータリセット時に使う「初期データ（デフォルト値）」のひな形を用意します
const DEFAULT_DATA = {
  // 現在選択中のコースID（初期値は宮城県内ルートを想定した 'course1' に設定）
  currentCourseId: 'course1',
  // 1歩あたりの歩幅（センチメートル単位。初期値は一般的な70cmに設定）
  strideCm: 70,
  // これまでの累計歩数（初期値は0歩）
  totalSteps: 0,
  // 日別の歩数記録を順番に入れていくための空のリスト（配列）
  history: []
};

// 保存データ管理の機能をひとまとめにしたオブジェクト（部品）を作成します
const StorageManager = {
  
  // 【機能1】LocalStorageから保存データを読み込む関数（dBASEのUSEやREADに相当）
  loadData: function() {
    // 指定したキー名でLocalStorageから文字列データを取り出します
    const savedJson = localStorage.getItem(STORAGE_KEY);
    
    // もしデータが存在しない場合（初回起動時など）の処理です
    if (!savedJson) {
      // 初期データのひな形をコピーして新しいデータとして返します
      return Object.assign({}, DEFAULT_DATA);
    }
    
    // 保存されていた文字列データを、JavaScriptで扱えるデータ形式（オブジェクト）に変換します
    try {
      // JSON形式の文字列を元のデータ構造に復元します
      const parsedData = JSON.parse(savedJson);
      // 万が一古いデータに不足項目があってもエラーにならないよう、初期データと合体させて返します
      return Object.assign({}, DEFAULT_DATA, parsedData);
    } catch (error) {
      // データが壊れていた場合はコンソールにエラーを表示します
      console.error('データの読み込みに失敗しました:', error);
      // 安全のため初期データを返します
      return Object.assign({}, DEFAULT_DATA);
    }
  },

  // 【機能2】現在のデータをLocalStorageに書き込んで保存する関数（dBASEのREPLACEやCOMMITに相当）
  saveData: function(data) {
    // JavaScriptのデータ（オブジェクト）を、LocalStorageに保存できる「JSON文字列」に変換します
    const jsonString = JSON.stringify(data);
    // 指定したキー名を使ってLocalStorageに上書き保存します
    localStorage.setItem(STORAGE_KEY, jsonString);
  },

  // 【機能3】新しい歩数記録を追加して保存する便利関数
  addStepRecord: function(dateStr, steps) {
    // まず現在の保存データをすべて読み込みます
    const data = this.loadData();
    // 入力された歩数を数値に変換して、累計歩数に足し算します
    const numSteps = Number(steps);
    // 累計歩数を更新します
    data.totalSteps += numSteps;
    // 日別履歴のリストの末尾に、今回の「日付」と「歩数」のペアを追加します
    data.history.push({
      // 日付文字列（例: "2026-11-21"）をセットします
      date: dateStr,
      // 今回の歩数をセットします
      steps: numSteps
    });
    // 更新したデータをLocalStorageに保存します
    this.saveData(data);
    // 呼び出し元で最新の状態を使えるように、更新後のデータを返します
    return data;
  },

  // 【機能4】歩幅や選択コースなどの設定を変更して保存する便利関数
  updateSettings: function(newCourseId, newStrideCm) {
    // まず現在の保存データをすべて読み込みます
    const data = this.loadData();
    // 新しいコースIDが指定されていれば上書きします
    if (newCourseId) {
      // コースIDを更新します
      data.currentCourseId = newCourseId;
    }
    // 新しい歩幅が指定されていれば数値に変換して上書きします
    if (newStrideCm) {
      // 歩幅を更新します
      data.strideCm = Number(newStrideCm);
    }
    // 更新したデータをLocalStorageに保存します
    this.saveData(data);
    // 更新後のデータを返します
    return data;
  },

  // 【機能5】テスト用：保存データをすべて消去して初期状態に戻す関数
  clearAllData: function() {
    // LocalStorageから指定したキーのデータを削除します
    localStorage.removeItem(STORAGE_KEY);
    // 初期状態のデータを返します
    return Object.assign({}, DEFAULT_DATA);
  }
};
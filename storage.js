// ブラウザのLocalStorageにデータを保存する際のキー名です
const STORAGE_KEY = 'tohotabi_app_data_v1';

// アプリ初回起動時やデータリセット時に使う初期データのひな形です
const DEFAULT_DATA = {
  // 現在選択中のコースID（初期値は 'course1'）
  currentCourseId: 'course1',
  // 1歩あたりの歩幅（cm単位。初期値は 70cm）
  strideCm: 70,
  // これまでの累計歩数（初期値は 0歩）
  totalSteps: 0,
  // 日別の歩数記録を順番に入れていく空のリストです
  history: []
};

// 保存データ管理の機能をひとまとめにしたモジュールです
const StorageManager = {

  // 【機能1】LocalStorageから保存データを読み込む関数です
  loadData: function() {
    // 指定したキー名でLocalStorageから文字列データを取り出します
    const savedJson = localStorage.getItem(STORAGE_KEY);

    // データが存在しない場合は初期データのコピーを返します
    if (!savedJson) {
      return Object.assign({}, DEFAULT_DATA);
    }

    // JSON文字列をJavaScriptで扱えるデータ形式に変換します
    try {
      const parsedData = JSON.parse(savedJson);
      return Object.assign({}, DEFAULT_DATA, parsedData);
    } catch (error) {
      console.error('データの読み込みに失敗しました:', error);
      return Object.assign({}, DEFAULT_DATA);
    }
  },

  // 【機能2】現在のデータをLocalStorageに書き込んで保存する関数です
  saveData: function(data) {
    const jsonString = JSON.stringify(data);
    localStorage.setItem(STORAGE_KEY, jsonString);
  },

  // 【機能3】新しい歩数記録を追加して保存する便利関数です
  addStepRecord: function(dateStr, steps) {
    const data = this.loadData();
    const numSteps = Number(steps);
    data.totalSteps += numSteps;
    data.history.push({
      date: dateStr,
      steps: numSteps
    });
    this.saveData(data);
    return data;
  },

  // 【機能4】歩幅や選択コースなどの設定を変更して保存する便利関数です
  updateSettings: function(newCourseId, newStrideCm) {
    const data = this.loadData();
    if (newCourseId) {
      data.currentCourseId = newCourseId;
    }
    if (newStrideCm) {
      data.strideCm = Number(newStrideCm);
    }
    this.saveData(data);
    return data;
  },

  // 【機能5】保存データをすべて消去して初期状態に戻す関数です
  clearAllData: function() {
    localStorage.removeItem(STORAGE_KEY);
    return Object.assign({}, DEFAULT_DATA);
  },

  // 【機能6】現在のデータをバックアップ用JSON文字列として取り出す関数です
  exportBackupJson: function() {
    const data = this.loadData();
    // 見やすく整形したJSON文字列にして返します
    return JSON.stringify(data, null, 2);
  },

  // 【機能7】バックアップファイル（JSON文字列）を検証して復元する関数です
  importBackupJson: function(jsonText) {
    // 文字列をオブジェクトに変換します
    const parsed = JSON.parse(jsonText);
    // 正しいバックアップデータか（history配列があるか）確認します
    if (!parsed || !Array.isArray(parsed.history)) {
      throw new Error('バックアップデータの形式が正しくありません。');
    }
    // 履歴から累計歩数を再計算して整合性を保ちます
    let sumSteps = 0;
    for (let i = 0; i < parsed.history.length; i++) {
      const item = parsed.history.at(i);
      if (item && typeof item.steps === 'number') {
        sumSteps += item.steps;
      }
    }
    // 初期データのひな形と合体させて安全に保存します
    const restored = Object.assign({}, DEFAULT_DATA, parsed);
    restored.totalSteps = sumSteps;
    this.saveData(restored);
    return restored;
  }
};
// --- storage.js ここまで ---
// ブラウザのLocalStorageにデータを保存する際のキー名です
const STORAGE_KEY = 'tohotabi_app_data_v1';

// アプリ初回起動時やデータリセット時に使う初期データのひな形です
const DEFAULT_DATA = {
  // 現在選択中のコースID（初期値は 'course1'）
  currentCourseId: 'course1',
  // 1歩あたりの歩幅（cm単位。初期値は 70cm）
  strideCm: 70,
  // 全コース合算の累計歩数（初期値は 0歩）
  totalSteps: 0,
  // 全コース合算の日別歩数記録（グラフ表示用）
  history: [],
  // コースごとの歩数記録を独立して保存する箱です
  courseHistories: {},
  // コースごとの途中スタート（ワープ）開始距離(km)を保存する箱です
  courseStartKm: {}
};

// 保存データ管理の機能をひとまとめにしたモジュールです
const StorageManager = {

  // 【内部補助】古い保存データに新しい項目が無い場合に自動移行する関数です
  _migrateData: function(rawData) {
    // 初期データのひな形をベースに読み込みデータを合体させます
    const data = Object.assign({}, DEFAULT_DATA, rawData);
    // courseHistories が未作成またはオブジェクトでない場合は初期化します
    if (!data.courseHistories || typeof data.courseHistories !== 'object') {
      data.courseHistories = {};
    }
    // courseStartKm が未作成またはオブジェクトでない場合は初期化します
    if (!data.courseStartKm || typeof data.courseStartKm !== 'object') {
      data.courseStartKm = {};
    }
    // 過去の履歴があり、まだコース別履歴が1つも無い場合は現在コースへ引き継ぎます
    const hasHistory = Array.isArray(data.history) && data.history.length > 0;
    const keys = Object.keys(data.courseHistories);
    if (hasHistory && keys.length === 0) {
      const cid = data.currentCourseId || 'course1';
      // 既存の履歴をコピーして現在のコースの実績として引き継ぎます
      Reflect.set(data.courseHistories, cid, data.history.slice());
    }
    return data;
  },

  // 【機能1】LocalStorageから保存データを読み込む関数です
  loadData: function() {
    // 指定したキー名でLocalStorageから文字列データを取り出します
    const savedJson = localStorage.getItem(STORAGE_KEY);

    // データが存在しない場合は初期データのコピーを返します
    if (!savedJson) {
      return this._migrateData({});
    }

    // JSON文字列をJavaScriptで扱えるデータ形式に変換します
    try {
      const parsedData = JSON.parse(savedJson);
      return this._migrateData(parsedData);
    } catch (error) {
      console.error('データの読み込みに失敗しました:', error);
      return this._migrateData({});
    }
  },

  // 【機能2】現在のデータをLocalStorageに書き込んで保存する関数です
  saveData: function(data) {
    // データをJSON文字列に変換します
    const jsonString = JSON.stringify(data);
    // LocalStorageへ書き込みます
    localStorage.setItem(STORAGE_KEY, jsonString);
  },

  // 【機能3】新しい歩数記録を追加して保存する便利関数です
  addStepRecord: function(dateStr, steps) {
    // 最新データを読み込みます
    const data = this.loadData();
    const numSteps = Number(steps);
    const record = { date: dateStr, steps: numSteps };

    // 1. 全コース共通の累計歩数とグラフ用履歴に追加します
    data.totalSteps += numSteps;
    data.history.push(record);

    // 2. 現在選択中のコース専用の履歴にも追加します
    const cid = data.currentCourseId || 'course1';
    const cList = Reflect.get(data.courseHistories, cid) || [];
    cList.push(record);
    Reflect.set(data.courseHistories, cid, cList);

    // 変更を保存して返します
    this.saveData(data);
    return data;
  },

  // 【機能4】指定したコースの履歴・累計歩数・ワープ開始距離を取得する関数です
  getCourseStats: function(courseId, dataObj) {
    // 引数にデータがあればそれを使い、無ければ最新を読み込みます
    const data = dataObj || this.loadData();
    const cid = courseId || data.currentCourseId || 'course1';
    // 対象コースの履歴配列を取り出します（無ければ空配列）
    const cHistory = Reflect.get(data.courseHistories, cid) || [];
    // 対象コースのワープ開始距離(km)を取り出します（無ければ 0）
    const rawStartKm = Reflect.get(data.courseStartKm, cid);
    const startKm = (typeof rawStartKm === 'number') ? rawStartKm : 0;

    // 対象コースの累計歩数を合計します
    let cTotalSteps = 0;
    for (let i = 0; i < cHistory.length; i++) {
      const item = cHistory.at(i);
      if (item && typeof item.steps === 'number') {
        cTotalSteps += item.steps;
      }
    }

    // コース専用の履歴・累計歩数・ワープ開始距離をまとめて返します
    return {
      history: cHistory,
      totalSteps: cTotalSteps,
      startKm: startKm
    };
  },

  // 【機能5】歩幅や選択コースなどの設定を変更して保存する便利関数です
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

  // 【機能6-1】指定コースの途中スタート（ワープ）地点を設定する関数です
  setCourseWarp: function(courseId, startKm) {
    const data = this.loadData();
    const cid = courseId || data.currentCourseId || 'course1';
    const kmVal = Number(startKm) || 0;
    // 指定地点ピタリから始めるため、そのコースの歩数履歴を0に戻します
    Reflect.set(data.courseHistories, cid, []);
    // 指定地点の距離(km)をワープ開始位置として上書き保存します
    Reflect.set(data.courseStartKm, cid, kmVal);
    this.saveData(data);
    return data;
  },

  // 【機能6-2】選択中（または指定）コースの実績とワープ位置を0にリセットする関数です
  resetCourseProgress: function(courseId) {
    const data = this.loadData();
    const cid = courseId || data.currentCourseId || 'course1';
    // 対象コースの履歴を空配列に、ワープ開始距離を0に書き換えます（全体履歴は残ります）
    Reflect.set(data.courseHistories, cid, []);
    Reflect.set(data.courseStartKm, cid, 0);
    this.saveData(data);
    return data;
  },

  // 【機能7】保存データをすべて消去して初期状態に戻す関数です
  clearAllData: function() {
    localStorage.removeItem(STORAGE_KEY);
    return this._migrateData({});
  },

  // 【機能8】現在のデータをバックアップ用JSON文字列として取り出す関数です
  exportBackupJson: function() {
    const data = this.loadData();
    // 見やすく整形したJSON文字列にして返します
    return JSON.stringify(data, null, 2);
  },

  // 【機能9】バックアップファイル（JSON文字列）を検証して復元する関数です
  importBackupJson: function(jsonText) {
    // 文字列をオブジェクトに変換します
    const parsed = JSON.parse(jsonText);
    // 正しいバックアップデータか（history配列があるか）確認します
    if (!parsed || !Array.isArray(parsed.history)) {
      throw new Error('バックアップデータの形式が正しくありません。');
    }
    // 全体履歴から累計歩数を再計算して整合性を保ちます
    let sumSteps = 0;
    for (let i = 0; i < parsed.history.length; i++) {
      const item = parsed.history.at(i);
      if (item && typeof item.steps === 'number') {
        sumSteps += item.steps;
      }
    }
    // 移行処理を通して安全に保存します
    const restored = this._migrateData(parsed);
    restored.totalSteps = sumSteps;
    this.saveData(restored);
    return restored;
  }
};
// --- storage.js ここまで ---
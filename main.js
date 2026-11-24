// 画面の読み込みが完了したらアプリ全体の初期設定を開始します
document.addEventListener('DOMContentLoaded', function() {
  // 歩数グラフの現在の表示モード（初期値は日別 'day'）を保持します
  let currentChartMode = 'day';

  // 【共通関数】最新データを読み込み、画面と地図をまとめて再描画します
  function refreshApp() {
    // 1. 保存データを読み込みます
    const data = StorageManager.loadData();
    // 2. 選択中コース専用の累計歩数と履歴を取り出します
    const cStats = StorageManager.getCourseStats(data.currentCourseId, data);
    // 3. 選択中コース専用の歩数と歩幅から進行状況を判定します
    const progress = WalkLogic.evaluateProgress(
      data.currentCourseId,
      cStats.totalSteps,
      data.strideCm
    );
    // 4. 励ましメッセージを作成します
    const message = WalkLogic.createEncouragementMessage(progress);
    // 5. 全コース共通の履歴から期間別の歩数グラフ用データを集計します
    const chartSummary = WalkLogic.aggregateByPeriod(
      data.history,
      currentChartMode
    );
    // 6. 画面全体の表示を更新します
    UIManager.renderAll(data, progress, message, chartSummary, currentChartMode);
    // 7. 地図の描画とピン位置を更新します
    MapManager.updateMap(data.currentCourseId, progress);
  }

  // アプリ起動時の初期セットアップを実行します
  UIManager.initCourseOptions();
  UIManager.setTodayDate();
  refreshApp();

  // --- イベント1：上部のタブ切り替えボタンが押された時の処理 ---
  const tabButtons = document.querySelectorAll('.tab-btn');
  for (let i = 0; i < tabButtons.length; i++) {
    const btn = tabButtons.item(i);
    btn.addEventListener('click', function() {
      const targetId = this.getAttribute('data-target');
      if (targetId) {
        UIManager.switchTab(targetId);
        // 記録・現在地タブに戻った時は地図サイズ崩れを防ぐため再描画します
        if (targetId === 'tab-home') {
          refreshApp();
        }
      }
    });
  }

  // --- イベント2：「この歩数を記録する」ボタンが押された時の処理 ---
  const addStepsBtn = document.getElementById('btn-add-steps');
  if (addStepsBtn) {
    addStepsBtn.addEventListener('click', function() {
      const dateInput = document.getElementById('input-date');
      const stepsInput = document.getElementById('input-steps');
      const dateVal = dateInput ? dateInput.value : '';
      const stepsVal = stepsInput ? Number(stepsInput.value) : 0;

      // 日付や歩数が未入力・0以下の場合は警告を出して止めます
      if (!dateVal) {
        alert('日付を選択してください。');
        return;
      }
      if (!stepsVal || stepsVal <= 0) {
        alert('1歩以上の歩数を入力してください。');
        return;
      }

      // 全体履歴と選択中コース専用履歴の両方に歩数を追加保存します
      StorageManager.addStepRecord(dateVal, stepsVal);
      // 入力欄を空にして画面全体を更新します
      stepsInput.value = '';
      refreshApp();
      alert(stepsVal.toLocaleString() + ' 歩を記録しました！');
    });
  }

  // --- イベント3：「設定を保存する」ボタンが押された時の処理 ---
  const saveSettingsBtn = document.getElementById('btn-save-settings');
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', function() {
      const courseSelect = document.getElementById('select-course');
      const strideInput = document.getElementById('input-stride');
      const nextCourseId = courseSelect ? courseSelect.value : 'course1';
      const nextStride = strideInput ? Number(strideInput.value) : 70;

      // 歩幅が極端な値でないか確認します
      if (!nextStride || nextStride < 20 || nextStride > 200) {
        alert('歩幅は 20〜200 cm の間で入力してください。');
        return;
      }

      // 設定を保存して新しいコースの進捗画面へ切り替えます
      StorageManager.updateSettings(nextCourseId, nextStride);
      refreshApp();
      UIManager.switchTab('tab-home');
      alert('設定を保存しました！');
    });
  }

  // --- イベント4-1：「選択中のコースの進捗をリセット」ボタンの処理 ---
  const resetCourseBtn = document.getElementById('btn-reset-course');
  if (resetCourseBtn) {
    resetCourseBtn.addEventListener('click', function() {
      const data = StorageManager.loadData();
      const cid = data.currentCourseId || 'course1';
      const course = Reflect.get(MASTER_DATA, cid) || MASTER_DATA.course1;
      const msg = '「' + course.name + '」の進行状況（距離・到達地点）だけを0に戻しますか？\n'
        + '※日別・週別の歩数グラフや他のコースの進捗は消えません。';

      if (!confirm(msg)) {
        return;
      }
      // 選択中のコースの履歴だけを空にリセットします
      StorageManager.resetCourseProgress(cid);
      refreshApp();
      UIManager.switchTab('tab-home');
      alert('「' + course.name + '」の進捗をスタート地点（0km）に戻しました。');
    });
  }

  // --- イベント4-2：「すべての記録をリセットする」全初期化ボタンの処理 ---
  const resetAllBtn = document.getElementById('btn-reset-data');
  if (resetAllBtn) {
    resetAllBtn.addEventListener('click', function() {
      const msg = '【注意】すべての歩数グラフ履歴と全コースの進捗データを完全に消去しますか？\n'
        + '※この操作は取り消せません。';
      if (!confirm(msg)) {
        return;
      }
      StorageManager.clearAllData();
      UIManager.setTodayDate();
      refreshApp();
      UIManager.switchTab('tab-home');
      alert('すべてのデータを初期化しました。');
    });
  }

  // --- イベント5：グラフの期間切り替えボタンがタップされた時の処理 ---
  const modeButtons = document.querySelectorAll('.chart-mode-btn');
  for (let i = 0; i < modeButtons.length; i++) {
    const mBtn = modeButtons.item(i);
    mBtn.addEventListener('click', function() {
      // 押されたボタンの期間モード（day / week / month / half）を取得します
      const nextMode = this.getAttribute('data-mode');
      if (nextMode) {
        currentChartMode = nextMode;
        // 新しい期間モードでグラフを描き直します
        refreshApp();
      }
    });
  }

  // --- イベント6：「データをファイルに保存（バックアップ）」ボタンの処理 ---
  const exportBtn = document.getElementById('btn-export-data');
  if (exportBtn) {
    exportBtn.addEventListener('click', function() {
      // バックアップ用JSON文字列を取得します
      const jsonText = StorageManager.exportBackupJson();
      // 今日の日付（YYYYMMDD形式）を作ってファイル名に付けます
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      const fileName = 'tohotabi_backup_' + y + m + d + '.json';

      // ファイルとしてダウンロードさせるためのBlobとリンクを作ります
      const blob = new Blob([jsonText], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    });
  }

  // --- イベント7：「バックアップファイルから復元」ボタンとファイル選択の処理 ---
  const importBtn = document.getElementById('btn-import-data');
  const importInput = document.getElementById('input-import-file');
  if (importBtn && importInput) {
    // 復元ボタンが押されたら隠れたファイル選択ダイアログを開きます
    importBtn.addEventListener('click', function() {
      importInput.value = '';
      importInput.click();
    });

    // ファイルが選択されたら中身を読み込んで復元します
    importInput.addEventListener('change', function() {
      const files = importInput.files;
      if (!files || files.length === 0) {
        return;
      }
      const file = files.item(0);
      if (!file) {
        return;
      }
      const reader = new FileReader();
      reader.onload = function() {
        try {
          const text = String(reader.result || '');
          const ok = confirm('選択したバックアップファイルの内容で現在のデータを上書き復元しますか？');
          if (!ok) {
            return;
          }
          StorageManager.importBackupJson(text);
          refreshApp();
          alert('バックアップからデータを復元しました！');
        } catch (err) {
          const msg = (err instanceof Error) ? err.message : String(err);
          alert('復元に失敗しました：' + msg);
        }
      };
      reader.readAsText(file);
    });
  }
});
// --- main.js ここまで ---
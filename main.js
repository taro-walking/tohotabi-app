// アプリ全体の司令塔となる処理です。画面読み込み完了時に動き始めます
document.addEventListener('DOMContentLoaded', function() {

  // 現在選択中のグラフ期間モード（day / week / month / half）を保持します
  let currentChartMode = 'day';

  // 【共通処理】最新データを読み込み、計算して、画面全体と地図を描画する関数です
  function refreshApp() {
    // 1. StorageManagerから現在の保存データを読み込みます
    const currentData = StorageManager.loadData();
    // 2. WalkLogicで現在の進行状況（距離・到達地点・次の目的地）を計算します
    const progress = WalkLogic.evaluateProgress(
      currentData.currentCourseId,
      currentData.totalSteps,
      currentData.strideCm
    );
    // 3. 励ましメッセージを生成します
    const message = WalkLogic.createEncouragementMessage(progress);
    // 4. 選択中の期間モード（日・週・月・半年）で歩数を集計します
    const chartSummary = WalkLogic.aggregateByPeriod(
      currentData.history,
      currentChartMode
    );

    // 5. UIManagerにすべての結果を渡して画面を最新の状態に書き換えます
    UIManager.renderAll(
      currentData,
      progress,
      message,
      chartSummary,
      currentChartMode
    );

    // 6. MapManagerに現在のコースと進行状況を渡して地図を更新します
    MapManager.updateMap(currentData.currentCourseId, progress);
  }

  // --- アプリ起動時の初期セットアップ ---
  // 設定画面のコース選択肢をマスターデータから自動生成します
  UIManager.initCourseOptions();
  // 日付入力欄に今日の日付と曜日を自動セットします
  UIManager.setTodayDate();
  // 初回の画面描画を実行します
  refreshApp();

  // --- イベント1：上部の3つのタブボタンがタップされた時の処理 ---
  const tabButtons = document.querySelectorAll('.tab-btn');
  for (let i = 0; i < tabButtons.length; i++) {
    const btn = tabButtons.item(i);
    btn.addEventListener('click', function() {
      // タップされたボタンの切り替え先ID（tab-home など）を取得します
      const targetId = this.getAttribute('data-target');
      // UIManagerにタブの切り替えを指示します
      UIManager.switchTab(targetId);
    });
  }

  // --- イベント2：「この歩数を記録する」ボタンがタップされた時の処理 ---
  const addBtn = document.getElementById('btn-add-steps');
  addBtn.addEventListener('click', function() {
    // 入力された日付と歩数を取得します
    const dateVal = document.getElementById('input-date').value;
    const stepsInput = document.getElementById('input-steps');
    const stepsVal = stepsInput.value;

    // 日付が空っぽの場合は警告を出して処理を止めます
    if (!dateVal) {
      alert('日付を選択してください。');
      return;
    }
    // 歩数が空っぽ、または0以下の場合は警告を出して処理を止めます
    if (!stepsVal || Number(stepsVal) <= 0) {
      alert('1歩以上の歩数を入力してください。');
      return;
    }

    // StorageManagerに新しい歩数記録を保存します
    StorageManager.addStepRecord(dateVal, Number(stepsVal));
    // 歩数入力欄を空欄に戻します
    stepsInput.value = '';
    // 画面全体と地図を最新の状態に更新します
    refreshApp();
    // 登録完了のメッセージを表示します
    alert(stepsVal + ' 歩を記録しました！');
  });

  // --- イベント3：「設定を保存する」ボタンがタップされた時の処理 ---
  const saveBtn = document.getElementById('btn-save-settings');
  saveBtn.addEventListener('click', function() {
    // 選択されたコースIDと入力された歩幅(cm)を取得します
    const selectedCourse = document.getElementById('select-course').value;
    const strideVal = document.getElementById('input-stride').value;

    // 歩幅が極端に小さい・大きい場合のチェックです
    if (!strideVal || Number(strideVal) < 20 || Number(strideVal) > 200) {
      alert('歩幅は 20〜200 cm の間で入力してください。');
      return;
    }

    // StorageManagerに設定変更を保存します
    StorageManager.updateSettings(selectedCourse, Number(strideVal));
    // 変更したコースや歩幅で距離や到達地点を再計算し、画面を更新します
    refreshApp();
    // 保存完了のメッセージを表示します
    alert('設定を保存しました！');
  });

  // --- イベント4：「すべての記録をリセットする」ボタンがタップされた時の処理 ---
  const resetBtn = document.getElementById('btn-reset-data');
  resetBtn.addEventListener('click', function() {
    // 誤って消さないよう確認ダイアログを出します
    const msg = '本当にこれまでの歩数記録をすべて消去して初期状態に戻しますか？';
    const isConfirmed = confirm(msg);
    if (isConfirmed) {
      // データを完全に初期化します
      StorageManager.clearAllData();
      // 画面と地図を初期状態に描き直します
      refreshApp();
      alert('データをリセットしました。');
    }
  });

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
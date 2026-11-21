// アプリ全体の司令塔となる処理です。画面のHTMLがすべて読み込まれた瞬間に動き始めます
document.addEventListener('DOMContentLoaded', function() {

  // 【共通処理】最新データを読み込み、計算して、画面全体と地図を描画し直す関数
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
    // 4. 直近7日間の日別歩数を集計します
    const dailySummary = WalkLogic.aggregateDailySteps(currentData.history, 7);

    // 5. UIManagerにすべての結果を渡して、画面を最新の状態に書き換えます
    UIManager.renderAll(currentData, progress, message, dailySummary);

    // 6. MapManagerに現在のコースと進行状況を渡して、地図の線とピンを更新します
    MapManager.updateMap(currentData.currentCourseId, progress);
  }

  // --- アプリ起動時の初期セットアップ ---
  // 設定画面のコース選択肢をマスターデータから自動生成します
  UIManager.initCourseOptions();
  // 日付入力欄に今日の日付を自動セットします
  UIManager.setTodayDate();
  // 初回の画面描画を実行します（テスト時のデータが残っていればそれも反映されます）
  refreshApp();

  // --- イベント1：上部の3つのタブボタンがタップされた時の処理 ---
  const tabButtons = document.querySelectorAll('.tab-btn');
  for (let i = 0; i < tabButtons.length; i++) {
    tabButtons[i].addEventListener('click', function() {
      // タップされたボタンの切り替え先ID（tab-home など）を取得します
      const targetId = this.getAttribute('data-target');
      // UIManagerにタブの切り替えを指示します
      UIManager.switchTab(targetId);
    });
  }

  // --- イベント2：「この歩数を記録する」ボタンがタップされた時の処理 ---
  document.getElementById('btn-add-steps').addEventListener('click', function() {
    // 入力された日付と歩数を取得します
    const dateVal = document.getElementById('input-date').value;
    const stepsVal = document.getElementById('input-steps').value;

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
    // 歩数入力欄を空欄に戻します（連続入力の誤操作を防ぐため）
    document.getElementById('input-steps').value = '';
    // 画面全体と地図を最新の状態に更新します
    refreshApp();
    // 登録完了のメッセージを表示します
    alert(stepsVal + ' 歩を記録しました！');
  });

  // --- イベント3：「設定を保存する」ボタンがタップされた時の処理 ---
  document.getElementById('btn-save-settings').addEventListener('click', function() {
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
    // 変更したコースや歩幅で距離や到達地点を再計算し、画面と地図を更新します
    refreshApp();
    // 保存完了のメッセージを表示します
    alert('設定を保存しました！');
  });

  // --- イベント4：「すべての記録をリセットする」ボタンがタップされた時の処理 ---
  document.getElementById('btn-reset-data').addEventListener('click', function() {
    // 誤って消さないよう確認ダイアログを出します
    const isConfirmed = confirm('本当にこれまでの歩数記録をすべて消去して初期状態に戻しますか？');
    if (isConfirmed) {
      // データを完全に初期化します
      StorageManager.clearAllData();
      // 画面と地図を初期状態に描き直します
      refreshApp();
      alert('データをリセットしました。');
    }
  });
});
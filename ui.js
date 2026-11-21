// 画面表示の更新やタブ切り替えをひとまとめにしたオブジェクト（部品）を作成します
const UIManager = {

  // 【機能1】アプリ全体の画面を最新のデータで描き直すメインの描画関数
  renderAll: function(data, progress, message, dailySummary) {
    // 1. ヘッダーのコース名を書き換えます
    document.getElementById('header-course-name').textContent = progress.courseName;

    // 2. 励ましメッセージカードを書き換えます
    document.getElementById('encouragement-msg').textContent = message;

    // 3. 現在の到達地点カード（街の名前・距離・歩数・名所・特産品）を書き換えます
    document.getElementById('latest-point-name').textContent = progress.latestPoint.name;
    document.getElementById('total-km').textContent = progress.currentKm + ' km';
    document.getElementById('total-steps').textContent = data.totalSteps.toLocaleString() + ' 歩';
    document.getElementById('latest-spot').textContent = progress.latestPoint.spot;
    document.getElementById('latest-specialty').textContent = progress.latestPoint.specialty;

    // 4. 日別歩数グラフを描画します
    this.renderChart(dailySummary);

    // 5. コース通過チェックリストを描画します
    this.renderPointList(data.currentCourseId, progress.currentKm);

    // 6. 設定画面の選択状態（現在のコースと歩幅）を反映させます
    document.getElementById('select-course').value = data.currentCourseId;
    document.getElementById('input-stride').value = data.strideCm;
  },

  // 【機能2】直近7日間の日別歩数グラフ（棒グラフ）を描画する関数
  renderChart: function(dailySummary) {
    // グラフを表示するHTMLの箱を取得します
    const container = document.getElementById('step-chart');
    // 中身を一度空っぽにします
    container.innerHTML = '';

    // まだ歩数記録が1件もない場合は案内メッセージを表示して終了します
    if (dailySummary.length === 0) {
      container.innerHTML = '<p class="empty-text">まだ記録がありません</p>';
      return;
    }

    // グラフの高さを揃えるため、表示期間中の「最大歩数」を探します（最低でも10000歩を基準にします）
    let maxSteps = 10000;
    for (let i = 0; i < dailySummary.length; i++) {
      if (dailySummary[i].steps > maxSteps) {
        maxSteps = dailySummary[i].steps;
      }
    }

    // 1日分ずつ棒グラフのHTMLパーツを作って追加します
    for (let i = 0; i < dailySummary.length; i++) {
      const item = dailySummary[i];
      // 最大歩数に対する割合（パーセント）を計算し、棒の高さ（最大100px）を決めます
      const barHeight = Math.round((item.steps / maxSteps) * 100);
      // 日付文字列 "2026-11-21" から後ろの "11/21" だけを抜き出して見やすくします
      const shortDate = item.date.slice(5).replace('-', '/');

      // 1日分の列を作るdiv要素を作成します
      const col = document.createElement('div');
      col.className = 'chart-bar-item';
      // 歩数ラベル・緑色の棒・日付ラベルをHTMLとして組み立てます
      col.innerHTML =
        '<span class="chart-val">' + item.steps.toLocaleString() + '</span>' +
        '<div class="chart-bar" style="height: ' + barHeight + 'px;"></div>' +
        '<span class="chart-date">' + shortDate + '</span>';

      // グラフの箱に追加します
      container.appendChild(col);
    }
  },

  // 【機能3】コース内の全地点と到達状況の一覧リストを描画する関数
  renderPointList: function(courseId, currentKm) {
    // リストを表示するul要素を取得します
    const listEl = document.getElementById('point-list');
    // 一度中身を空っぽにします
    listEl.innerHTML = '';

    // 選択中のコースの地点リストを取得します
    const course = MASTER_DATA[courseId] || MASTER_DATA['course1'];
    const points = course.points;

    // 各地点を1行ずつリストに追加します
    for (let i = 0; i < points.length; i++) {
      const pt = points[i];
      // 現在の累計距離が地点の距離以上なら到達済み（true）と判定します
      const isPassed = currentKm >= pt.km;

      // 1行分のli要素を作成します
      const li = document.createElement('li');
      // 到達済みの場合は 'passed' クラスを付けて背景を緑色にします
      li.className = isPassed ? 'point-item passed' : 'point-item';

      // 右側に表示するステータス文字（到達済か、距離表示か）を決めます
      const statusText = isPassed ? '✅ 到達済（' + pt.km + 'km）' : '未到達（' + pt.km + 'km）';

      // 左側に街の名前、右側にステータスを配置します
      li.innerHTML = '<span>' + pt.name + '</span><span>' + statusText + '</span>';
      listEl.appendChild(li);
    }
  },

  // 【機能4】設定画面の「コース選択プルダウン」の中身を自動生成する関数
  initCourseOptions: function() {
    // select要素を取得します
    const selectEl = document.getElementById('select-course');
    // 中身を一度空にします
    selectEl.innerHTML = '';

    // MASTER_DATAに登録されているすべてのコースID（course1, course2, course3）を取り出します
    const courseIds = Object.keys(MASTER_DATA);
    for (let i = 0; i < courseIds.length; i++) {
      const id = courseIds[i];
      // option要素（選択肢）を作成します
      const option = document.createElement('option');
      option.value = id;
      option.textContent = MASTER_DATA[id].name;
      selectEl.appendChild(option);
    }
  },

  // 【機能5】日付入力欄に「今日の日付」を自動でセットする便利関数
  setTodayDate: function() {
    // 現在の日時を取得します
    const today = new Date();
    // 年・月・日を取り出し、2桁ゼロ埋め（例: 11月5日 -> "05"）して "YYYY-MM-DD" 形式にします
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    // 日付入力欄の初期値としてセットします
    document.getElementById('input-date').value = yyyy + '-' + mm + '-' + dd;
  },

  // 【機能6】タブボタンが押された時に表示画面を切り替える関数
  switchTab: function(targetId) {
    // すべてのタブボタンから 'active' クラスを外します
    const buttons = document.querySelectorAll('.tab-btn');
    for (let i = 0; i < buttons.length; i++) {
      buttons[i].classList.remove('active');
      // 押されたボタン（data-targetが一致するもの）だけに 'active' を付けます
      if (buttons[i].getAttribute('data-target') === targetId) {
        buttons[i].classList.add('active');
      }
    }

    // すべてのタブ画面を一度非表示（active削除）にします
    const contents = document.querySelectorAll('.tab-content');
    for (let i = 0; i < contents.length; i++) {
      contents[i].classList.remove('active');
    }

    // 指定されたタブ画面だけを表示（active追加）します
    document.getElementById(targetId).classList.add('active');
  }
};
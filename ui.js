// 画面表示の更新やタブ切り替えを担当するモジュールです
const UIManager = {

  // 【機能1】アプリ全体の画面を最新のデータで描き直す関数です
  renderAll: function(data, progress, message, chartSummary, chartMode) {
    // 1. ヘッダーのコース名を書き換えます
    const headerEl = document.getElementById('header-course-name');
    headerEl.textContent = progress.courseName;

    // 2. 励ましメッセージカードを書き換えます
    const msgEl = document.getElementById('encouragement-msg');
    msgEl.textContent = message;

    // 選択中コース専用の履歴・累計歩数・ワープ開始距離を取得します
    const cStats = StorageManager.getCourseStats(data.currentCourseId, data);

    // 3. 現在の到達地点（街の名前・コース距離・コース歩数）を書き換えます
    const lp = progress.latestPoint;
    document.getElementById('latest-point-name').textContent = lp.name;
    document.getElementById('total-km').textContent = progress.currentKm + ' km';
    const stepsStr = cStats.totalSteps.toLocaleString() + ' 歩';
    document.getElementById('total-steps').textContent = stepsStr;

    // 4. 名所と特産品を書き換えます
    document.getElementById('latest-spot').textContent = lp.spot;
    document.getElementById('latest-specialty').textContent = lp.specialty;

    // 5. 地域の話題がある場合は表示し、空白なら行ごと隠します
    const topicRow = document.getElementById('latest-topic-row');
    const topicSpan = document.getElementById('latest-topic');
    if (topicRow && topicSpan) {
      if (lp.topic && lp.topic.trim() !== '') {
        topicSpan.textContent = lp.topic;
        topicRow.style.display = 'block';
      } else {
        topicSpan.textContent = '';
        topicRow.style.display = 'none';
      }
    }

    // 6. 期間別の歩数グラフと切り替えボタンを描画します
    const mode = chartMode || 'day';
    this.updateChartButtons(mode);
    this.renderChart(chartSummary, mode);

    // 7. コース通過チェックリスト（ワープ開始距離を考慮して到達日付を計算）を描画します
    const reachedMap = WalkLogic.calcPointReachedDates(
      data.currentCourseId,
      cStats.history,
      data.strideCm,
      cStats.startKm
    );
    this.renderPointList(data.currentCourseId, progress.currentKm, reachedMap);

    // 8. 設定画面の選択状態（コース・歩幅・ワープ候補一覧）を反映させます
    document.getElementById('select-course').value = data.currentCourseId;
    document.getElementById('input-stride').value = data.strideCm;
    this.updateWarpOptions(data.currentCourseId, cStats.startKm);
  },

  // 【機能2-1】グラフ期間切替ボタンの見た目とタイトルを更新する関数です
  updateChartButtons: function(mode) {
    const titleEl = document.getElementById('chart-title');
    if (titleEl) {
      if (mode === 'week') {
        titleEl.textContent = '歩数グラフ（週別・直近7週）';
      } else if (mode === 'month') {
        titleEl.textContent = '歩数グラフ（月別・直近6ヶ月）';
      } else if (mode === 'half') {
        titleEl.textContent = '歩数グラフ（半年別推移）';
      } else {
        titleEl.textContent = '歩数グラフ（日別・直近7日）';
      }
    }

    // 選択中のボタンだけを緑色にし、他を白色に戻します
    const btns = document.querySelectorAll('.chart-mode-btn');
    for (let i = 0; i < btns.length; i++) {
      const btn = btns.item(i);
      const bMode = btn.getAttribute('data-mode');
      if (bMode === mode) {
        btn.style.background = '#2e6f40';
        btn.style.color = '#ffffff';
        btn.style.borderColor = '#2e6f40';
      } else {
        btn.style.background = '#ffffff';
        btn.style.color = '#333333';
        btn.style.borderColor = '#cccccc';
      }
    }
  },

  // 【機能2-2】期間別の歩数グラフを描画する関数です
  renderChart: function(summaryList, mode) {
    // グラフを表示するHTMLの箱を取得します
    const container = document.getElementById('step-chart');
    container.innerHTML = '';

    // まだ記録が1件もない場合は案内メッセージを表示します
    if (!summaryList || summaryList.length === 0) {
      container.innerHTML = '<p class="empty-text">まだ記録がありません</p>';
      return;
    }

    // 期間モードに応じた最小基準歩数を設定します
    let baseMax = 10000;
    if (mode === 'week') {
      baseMax = 50000;
    } else if (mode === 'month') {
      baseMax = 200000;
    } else if (mode === 'half') {
      baseMax = 1000000;
    }

    // グラフの高さを揃えるため最大歩数を探します
    let maxSteps = baseMax;
    for (let i = 0; i < summaryList.length; i++) {
      const item = summaryList.at(i);
      if (item && item.steps > maxSteps) {
        maxSteps = item.steps;
      }
    }

    // 1本ずつ棒グラフのパーツを作って追加します
    for (let i = 0; i < summaryList.length; i++) {
      const item = summaryList.at(i);
      if (!item) {
        continue;
      }
      // 棒の高さ（最大100px）を計算します
      const barHeight = Math.max(4, Math.round((item.steps / maxSteps) * 100));
      // ラベル文字列を取得します（無い場合は日付から生成します）
      const labelText = item.label || item.date.slice(5).replace('-', '/');

      // 1本分の列を作るdiv要素を作成します
      const col = document.createElement('div');
      col.className = 'chart-bar-item';

      // 歩数ラベル・緑色の棒・期間ラベルを組み立てます
      let html = '<span class="chart-val">';
      html += item.steps.toLocaleString() + '</span>';
      html += '<div class="chart-bar" style="height: ';
      html += barHeight + 'px;"></div>';
      html += '<span class="chart-date">' + labelText + '</span>';
      col.innerHTML = html;

      container.appendChild(col);
    }
  },
  // 【機能3】コース内の全地点と到達状況・到達日付けを描画する関数です
  renderPointList: function(courseId, currentKm, reachedMap) {
    // リストを表示するul要素を取得します
    const listEl = document.getElementById('point-list');
    listEl.innerHTML = '';

    // 選択中のコースの地点リストを取得します
    const course = Reflect.get(MASTER_DATA, courseId) || MASTER_DATA.course1;
    const points = course.points;
    const dateMap = reachedMap || {};

    // 各地点を1行ずつリストに追加します
    for (let i = 0; i < points.length; i++) {
      const pt = points.at(i);
      if (!pt) {
        continue;
      }
      // 現在の累計距離が地点の距離以上なら到達済みと判定します
      const isPassed = currentKm >= pt.km;
      // 道中イベント地点かどうかも共通エンジンで判定します
      const isEv = CourseHelper.isEvent(pt);
      // 到達日付（例: "2026-11-22"）があればスラッシュ形式に変換します
      const rawDate = Reflect.get(dateMap, String(pt.id));
      const dateStr = rawDate ? rawDate.replace(/-/g, '/') : '';

      // 1行分のli要素を作成します（イベント行はeventクラスを追加します）
      const li = document.createElement('li');
      let cls = 'point-item';
      if (isEv) {
        cls += ' event';
      }
      if (isPassed) {
        cls += ' passed';
      }
      li.className = cls;

      // イベント行の場合は左端に小さなオレンジバッジを付けます
      const tagHtml = isEv ? '<span class="event-tag">🚩イベント</span>' : '';

      // 右側に表示するステータス文字（到達日付け＋距離）を決めます
      let statusText = '未到達（' + pt.km + 'km）';
      if (isPassed) {
        if (dateStr) {
          statusText = '✅ ' + dateStr + '（' + pt.km + 'km）';
        } else {
          statusText = '✅ 到達済（' + pt.km + 'km）';
        }
      }

      // 左側に街の名前（＋イベントタグ）、右側にステータスを配置します
      li.innerHTML = '<span>' + tagHtml + pt.name + '</span>' +
        '<span style="flex-shrink:0;">' + statusText + '</span>';
      listEl.appendChild(li);
    }
  },

  // 【機能4-1】設定画面のコース選択プルダウンを生成する関数です
  initCourseOptions: function() {
    const selectEl = document.getElementById('select-course');
    selectEl.innerHTML = '';

    // MASTER_DATAに登録されているコースIDを取り出します
    const courseIds = Object.keys(MASTER_DATA);
    for (let i = 0; i < courseIds.length; i++) {
      const id = courseIds.at(i);
      const course = Reflect.get(MASTER_DATA, id);
      if (!course) {
        continue;
      }
      const option = document.createElement('option');
      option.value = id;
      option.textContent = course.name;
      selectEl.appendChild(option);
    }
  },

  // 【機能4-2】設定画面のワープ（途中スタート）地点プルダウンを生成する関数です
  updateWarpOptions: function(courseId, currentStartKm) {
    const warpSelect = document.getElementById('select-warp-point');
    if (!warpSelect) {
      return;
    }
    warpSelect.innerHTML = '';

    // 対象コースの全地点リストを取り出します
    const course = Reflect.get(MASTER_DATA, courseId) || MASTER_DATA.course1;
    const points = course.points;
    const baseKm = (typeof currentStartKm === 'number') ? currentStartKm : 0;

    for (let i = 0; i < points.length; i++) {
      const pt = points.at(i);
      if (!pt) {
        continue;
      }
      const opt = document.createElement('option');
      opt.value = String(pt.km);
      const isEv = CourseHelper.isEvent(pt);

      // 0km地点・通常宿場・イベント地点それぞれ分かりやすく表記します
      if (pt.km === 0) {
        opt.textContent = '0km：' + pt.name + '（最初から）';
      } else if (isEv) {
        opt.textContent = pt.km + 'km：　└ ' + pt.name;
      } else {
        opt.textContent = pt.km + 'km：' + pt.name;
      }

      // 現在設定中のワープ開始距離と一致する項目を選択状態にします
      if (pt.km === baseKm) {
        opt.selected = true;
      }
      warpSelect.appendChild(opt);
    }
  },

  // 【機能5-1】枠の中に「2026/11/22（日）」の形式で日付と曜日を表示する関数です
  updateDateDisplay: function() {
    const inputEl = document.getElementById('input-date');
    const dispEl = document.getElementById('input-date-display');
    if (!inputEl || !dispEl) {
      return;
    }
    const val = inputEl.value;
    if (!val) {
      dispEl.textContent = '';
      return;
    }
    // "YYYY-MM-DD" を分解してローカル日付として確実に生成します
    const parts = val.split('-');
    if (parts.length !== 3) {
      dispEl.textContent = '';
      return;
    }
    const y = Number(parts.at(0));
    const m = Number(parts.at(1));
    const d = Number(parts.at(2));
    const dt = new Date(y, m - 1, d);
    // 曜日の文字一覧を文字列から取得します
    const weekChars = '日月火水木金土';
    const wChar = weekChars.charAt(dt.getDay());
    // 枠の中に「2026/11/22（日）」の形式で表示します
    const slashDate = val.replace(/-/g, '/');
    dispEl.textContent = slashDate + '（' + wChar + '）';
  },

  // 【機能5-2】日付入力欄に今日の日付を自動セットし、曜日連動を設定する関数です
  setTodayDate: function() {
    const inputEl = document.getElementById('input-date');
    if (!inputEl) {
      return;
    }
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    inputEl.value = yyyy + '-' + mm + '-' + dd;

    // 初期表示の「2026/11/22（日）」を枠内に反映します
    this.updateDateDisplay();

    // 日付が変更された時にも枠内の表示を自動更新します
    if (!inputEl.dataset.weekReady) {
      inputEl.dataset.weekReady = 'true';
      inputEl.addEventListener('change', () => {
        this.updateDateDisplay();
      });
    }
  },

  // 【機能6】タブボタンが押された時に画面を切り替える関数です
  switchTab: function(targetId) {
    // すべてのタブボタンの強調を外し、押されたボタンだけ強調します
    const buttons = document.querySelectorAll('.tab-btn');
    for (let i = 0; i < buttons.length; i++) {
      const btn = buttons.item(i);
      btn.classList.remove('active');
      if (btn.getAttribute('data-target') === targetId) {
        btn.classList.add('active');
      }
    }

    // すべてのタブ画面を一度非表示にします
    const contents = document.querySelectorAll('.tab-content');
    for (let i = 0; i < contents.length; i++) {
      contents.item(i).classList.remove('active');
    }

    // 指定されたタブ画面だけを表示します
    document.getElementById(targetId).classList.add('active');
  }
};
// --- ui.js ここまで ---
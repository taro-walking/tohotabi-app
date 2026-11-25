// 計算・位置判定・期間別集計を担当するモジュールです
const WalkLogic = {

  // 【機能1】累計歩数と歩幅(cm)から累計歩行距離(km)を計算する関数です
  calculateDistanceKm: function(totalSteps, strideCm) {
    // 歩数に歩幅(cm)を掛けて総移動距離(cm)を出します
    const totalCm = totalSteps * strideCm;
    // 100,000で割ってキロメートルに換算します
    const rawKm = totalCm / 100000;
    // 小数点第2位までに丸めて返します
    return Math.round(rawKm * 100) / 100;
  },

  // 【機能2】現在のコースと累計距離から到達状況や次の目的地を判定する関数です
  evaluateProgress: function(courseId, totalSteps, strideCm, startKm) {
    // 選択されたコースのマスターデータを取得します
    const course = Reflect.get(MASTER_DATA, courseId) || MASTER_DATA.course1;
    const points = course.points;
    // ワープ開始距離(km)が指定されていれば数値として受け取ります（初期値0）
    const baseKm = (typeof startKm === 'number') ? startKm : 0;
    // 実際に歩いた距離(km)を計算し、ワープ開始距離と合算します
    const walkedKm = this.calculateDistanceKm(totalSteps, strideCm);
    const currentKm = Math.round((baseKm + walkedKm) * 100) / 100;

    // 通過済み地点リストと次の目的地を用意します
    const passedPoints = new Array();
    let nextPoint = null;

    // スタート地点からゴール地点まで順番に距離をチェックします
    for (let i = 0; i < points.length; i++) {
      const point = points.at(i);
      if (!point) {
        continue;
      }
      if (currentKm >= point.km) {
        passedPoints.push(point);
      } else {
        nextPoint = point;
        break;
      }
    }

    // 最新到達地点とゴール地点を取得します
    const latestPoint = passedPoints.at(passedPoints.length - 1);
    const goalPoint = points.at(points.length - 1);
    const isGoal = currentKm >= goalPoint.km;

    // 次の目的地までの残り距離と残り歩数を計算します
    let remainingKm = 0;
    let remainingSteps = 0;
    if (!isGoal && nextPoint) {
      remainingKm = Math.round((nextPoint.km - currentKm) * 100) / 100;
      remainingSteps = Math.ceil((remainingKm * 100000) / strideCm);
    }

    // 計算と判定の結果をまとめて返します
    return {
      courseName: course.name,
      currentKm: currentKm,
      startKm: baseKm,
      goalKm: goalPoint.km,
      passedPoints: passedPoints,
      latestPoint: latestPoint,
      nextPoint: nextPoint,
      isGoal: isGoal,
      remainingKm: remainingKm,
      remainingSteps: remainingSteps
    };
  },

  // 【機能3】判定結果をもとに励ましメッセージを作成する関数です
  createEncouragementMessage: function(progress) {
    if (progress.isGoal) {
      const name = progress.latestPoint.name;
      return 'おめでとうございます！「' + name + '」に到達し、コースを完全制覇しました！';
    }
    const nextName = progress.nextPoint.name;
    const stepsStr = progress.remainingSteps.toLocaleString();
    const kmStr = progress.remainingKm;
    return '次の目的地「' + nextName + '」まで、あと ' + stepsStr + ' 歩（' + kmStr + ' km）です！';
  },

  // 【機能4】各地点に何月何日に到達したかを履歴から逆算する関数です
  calcPointReachedDates: function(courseId, history, strideCm, startKm) {
    const course = Reflect.get(MASTER_DATA, courseId) || MASTER_DATA.course1;
    const points = course.points;
    // ワープ開始距離(km)を受け取ります（初期値0）
    const baseKm = (typeof startKm === 'number') ? startKm : 0;
    // 地点IDごとの到達日付を入れる箱です
    const reachedMap = {};

    // 履歴を日付順（古い→新しい）に並べ替えたコピーを作ります
    const sorted = history.slice().sort(function(a, b) {
      return a.date.localeCompare(b.date);
    });

    // 履歴が1件も無ければ空のまま返します
    if (sorted.length === 0) {
      return reachedMap;
    }

    // 履歴を古い順に足し上げながら各地点の基準距離を超えた日を特定します
    let accSteps = 0;
    for (let i = 0; i < sorted.length; i++) {
      const rec = sorted.at(i);
      if (!rec) {
        continue;
      }
      accSteps += rec.steps;
      const walkedKm = this.calculateDistanceKm(accSteps, strideCm);
      const accKm = Math.round((baseKm + walkedKm) * 100) / 100;

      for (let j = 0; j < points.length; j++) {
        const pt = points.at(j);
        if (!pt) {
          continue;
        }
        // ワープ開始地点より手前の地点は日付を付けず「到達済」表示にします
        if (pt.km <= baseKm && baseKm > 0) {
          continue;
        }
        const key = String(pt.id);
        // まだ到達日が未記録で、累計距離が地点距離に達していれば日付を記録します
        if (!Reflect.get(reachedMap, key) && accKm >= pt.km) {
          Reflect.set(reachedMap, key, rec.date);
        }
      }
    }
    return reachedMap;
  },

  // 【機能5】日別の合計歩数データを集計する基本関数です
  aggregateDailySteps: function(history, maxDays) {
    const dailyMap = {};

    // 履歴データを1件ずつ取り出して日付ごとに足し算します
    for (let i = 0; i < history.length; i++) {
      const record = history.at(i);
      if (!record) {
        continue;
      }
      const prev = Reflect.get(dailyMap, record.date) || 0;
      Reflect.set(dailyMap, record.date, prev + record.steps);
    }

    // 日付順（古い→新しい）に並べ替えます
    const sortedDates = Object.keys(dailyMap).sort();
    const targetDates = maxDays ? sortedDates.slice(-maxDays) : sortedDates;

    // グラフ表示用の配列に作り直して返します
    const result = new Array();
    for (let i = 0; i < targetDates.length; i++) {
      const dStr = targetDates.at(i);
      const shortLabel = dStr.slice(5).replace('-', '/');
      result.push({
        label: shortLabel,
        date: dStr,
        steps: Reflect.get(dailyMap, dStr) || 0
      });
    }
    return result;
  },

  // 【機能6】指定された期間モード（day / week / month / half）で歩数を集計する関数です
  aggregateByPeriod: function(history, mode) {
    // 日別（直近7日）の場合は既存の関数をそのまま使います
    if (mode === 'day' || !mode) {
      return this.aggregateDailySteps(history, 7);
    }

    // 期間キーごとに歩数を合算するための箱です
    const groupMap = {};

    for (let i = 0; i < history.length; i++) {
      const rec = history.at(i);
      if (!rec || !rec.date) {
        continue;
      }
      const parts = rec.date.split('-');
      if (parts.length !== 3) {
        continue;
      }
      const y = Number(parts.at(0));
      const m = Number(parts.at(1));
      const d = Number(parts.at(2));

      let key = '';
      if (mode === 'week') {
        // その週の月曜日の日付をキーにします
        const dt = new Date(y, m - 1, d);
        const dayOfWeek = dt.getDay();
        const diffToMon = (dayOfWeek === 0) ? -6 : (1 - dayOfWeek);
        dt.setDate(dt.getDate() + diffToMon);
        const wy = dt.getFullYear();
        const wm = String(dt.getMonth() + 1).padStart(2, '0');
        const wd = String(dt.getDate()).padStart(2, '0');
        key = wy + '-' + wm + '-' + wd;
      } else if (mode === 'month') {
        // 年月（YYYY-MM）をキーにします
        key = parts.at(0) + '-' + parts.at(1);
      } else if (mode === 'half') {
        // 半期（YYYY-1上期 / YYYY-2下期）をキーにします
        const halfCode = (m <= 6) ? '1' : '2';
        key = parts.at(0) + '-' + halfCode;
      }

      if (key) {
        const prev = Reflect.get(groupMap, key) || 0;
        Reflect.set(groupMap, key, prev + rec.steps);
      }
    }

    // キーを古い順に並べ、表示件数を絞ります
    const sortedKeys = Object.keys(groupMap).sort();
    const limit = (mode === 'half') ? 6 : 7;
    const targetKeys = sortedKeys.slice(-limit);

    // グラフ用のラベルと合計歩数の配列にして返します
    const result = new Array();
    for (let i = 0; i < targetKeys.length; i++) {
      const k = targetKeys.at(i);
      let label = k;
      if (mode === 'week') {
        label = k.slice(5).replace('-', '/') + '週';
      } else if (mode === 'month') {
        label = k.slice(2, 4) + '/' + Number(k.slice(5)) + '月';
      } else if (mode === 'half') {
        const yy = k.slice(2, 4);
        const term = k.endsWith('1') ? '上期' : '下期';
        label = yy + term;
      }
      result.push({
        label: label,
        date: k,
        steps: Reflect.get(groupMap, k) || 0
      });
    }
    return result;
  }
};
// --- logic.js ここまで ---
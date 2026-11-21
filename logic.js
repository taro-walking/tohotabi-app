// 計算・位置判定の機能をひとまとめにしたオブジェクト（部品）を作成します
const WalkLogic = {

  // 【機能1】累計歩数と歩幅(cm)から、累計歩行距離(km)を計算する関数
  calculateDistanceKm: function(totalSteps, strideCm) {
    // 歩数に歩幅(cm)を掛けて、総移動距離をセンチメートル単位で出します
    const totalCm = totalSteps * strideCm;
    // 1km = 100,000cm なので、100,000で割ってキロメートルに換算します
    const rawKm = totalCm / 100000;
    // 小数点第2位まで表示するために、100倍して四捨五入してから100で割ります
    return Math.round(rawKm * 100) / 100;
  },

  // 【機能2】現在のコースと累計距離から、到達状況や次の目的地を判定する関数
  evaluateProgress: function(courseId, totalSteps, strideCm) {
    // 選択されたコースのマスターデータを取得します（見つからない場合はcourse1を使います）
    const course = MASTER_DATA[courseId] || MASTER_DATA['course1'];
    // コース内の通過地点リスト（配列）を取り出します
    const points = course.points;
    // 現在の累計歩行距離(km)を計算します
    const currentKm = this.calculateDistanceKm(totalSteps, strideCm);

    // すでに通過（到達）した地点を入れるための空リストを用意します
    const passedPoints = [];
    // 次に目指す地点を入れておく変数を用意します（最初はnull＝未設定）
    let nextPoint = null;

    // スタート地点からゴール地点まで、1つずつ順番に距離をチェックします（ループ処理）
    for (let i = 0; i < points.length; i++) {
      // i番目の地点データを取り出します
      const point = points[i];
      // 現在の累計距離が、その地点の基準距離(km)以上かどうか判定します
      if (currentKm >= point.km) {
        // 到達しているので、通過済みリストに追加します（通り過ぎてもすべて記録されます）
        passedPoints.push(point);
      } else {
        // まだ到達していない最初の地点が見つかったら、それを「次の目的地」にセットします
        nextPoint = point;
        // これ以降の地点も未到達なので、ループを終了します
        break;
      }
    }

    // 通過済みリストの「一番最後の要素」を、現在到達している最新地点として取り出します
    const latestPoint = passedPoints[passedPoints.length - 1];
    // ゴール地点（リストの最後の地点）のデータを取得します
    const goalPoint = points[points.length - 1];
    // 現在の距離がゴール距離以上なら「ゴール達成（true）」と判定します
    const isGoal = currentKm >= goalPoint.km;

    // 次の目的地までの残り距離(km)と残り歩数を計算するための変数を初期値0で用意します
    let remainingKm = 0;
    let remainingSteps = 0;

    // まだゴールしておらず、次の目的地が存在する場合の計算です
    if (!isGoal && nextPoint) {
      // 次の地点までの距離から現在距離を引き、小数点第2位までに丸めます
      remainingKm = Math.round((nextPoint.km - currentKm) * 100) / 100;
      // 残り距離(km)をセンチメートルに直し、歩幅(cm)で割って切り上げ（Math.ceil）します
      remainingSteps = Math.ceil((remainingKm * 100000) / strideCm);
    }

    // 計算と判定の結果を1つのオブジェクトにまとめて呼び出し元に返します
    return {
      // コース名（例：「① 宮城県内ルート（仙台〜気仙沼）」）
      courseName: course.name,
      // 現在の累計距離(km)
      currentKm: currentKm,
      // ゴールまでの総距離(km)
      goalKm: goalPoint.km,
      // 通過済みの全地点リスト（配列）
      passedPoints: passedPoints,
      // 一番新しく到達した地点のデータ（名所や特産品もここに入っています）
      latestPoint: latestPoint,
      // 次に目指す地点のデータ（ゴール済みの場合は null）
      nextPoint: nextPoint,
      // ゴール済みかどうかのフラグ（true または false）
      isGoal: isGoal,
      // 次の地点までの残り距離(km)
      remainingKm: remainingKm,
      // 次の地点までの残り歩数
      remainingSteps: remainingSteps
    };
  },

  // 【機能3】判定結果をもとに、画面に表示する「励ましメッセージ」を作成する関数
  createEncouragementMessage: function(progress) {
    // もしゴールを達成していた場合のお祝いメッセージです
    if (progress.isGoal) {
      // ゴール地点の名前を含めた達成メッセージを返します
      return 'おめでとうございます！「' + progress.latestPoint.name + '」に到達し、コースを完全制覇しました！';
    }
    // まだ途中の場合は、次の地点名と残り歩数・残り距離を組み合わせたメッセージを返します
    return '次の目的地「' + progress.nextPoint.name + '」まで、あと ' + progress.remainingSteps.toLocaleString() + ' 歩（' + progress.remainingKm + ' km）です！';
  },

  // 【機能4】歩数履歴の配列から、日別の合計歩数データを集計する関数（グラフ表示用）
  aggregateDailySteps: function(history, maxDays) {
    // 日付をキーにして歩数を合算するための空の箱（連想配列）を用意します
    const dailyMap = {};

    // 履歴データを1件ずつ取り出して日付ごとに足し算します
    for (let i = 0; i < history.length; i++) {
      // i番目の記録を取り出します
      const record = history[i];
      // まだその日付の箱がなければ、0で初期化します
      if (!dailyMap[record.date]) {
        // 初期値0をセットします
        dailyMap[record.date] = 0;
      }
      // その日付の歩数に今回の歩数を加算します
      dailyMap[record.date] += record.steps;
    }

    // 合算した日付の一覧を取り出し、日付順（古い→新しい）に並べ替えます
    const sortedDates = Object.keys(dailyMap).sort();

    // 表示する最大日数（例：直近7日分）が指定されていれば、後ろからその日数分だけ切り出します
    const targetDates = maxDays ? sortedDates.slice(-maxDays) : sortedDates;

    // グラフ描画で使いやすい「{ date: 日付, steps: 合計歩数 }」のリストに作り直して返します
    return targetDates.map(function(dateStr) {
      // 1日分のオブジェクトを返します
      return {
        // 日付文字列（例："2026-11-21"）
        date: dateStr,
        // その日の合計歩数
        steps: dailyMap[dateStr]
      };
    });
  }
};
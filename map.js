// 外部ライブラリを使わず、国土地理院の地図タイルとSVG図形でルートを描画する自作地図エンジンです
const MapManager = {
  // 現在のズーム倍率を記憶しておく変数です（nullの時はコース全体が収まる倍率を自動計算します）
  currentZoom: null,
  // 前回表示していたコースIDを記憶しておく変数です（コース変更時にズームをリセットするため）
  lastCourseId: null,
  // 直近の描画パラメータを保存しておき、拡大・縮小ボタンが押された時に再描画できるようにします
  lastParams: null,

  // 【内部計算1】緯度・経度(lat, lng)とズーム倍率(zoom)から、世界地図上のピクセル座標(x, y)を計算する関数
  latLngToPixel: function(lat, lng, zoom) {
    // ズーム倍率に応じた地図全体のピクセル幅を計算します（1タイル=256px）
    const scale = 256 * Math.pow(2, zoom);
    // 経度を0〜1の範囲に正規化してX座標を出します
    const x = ((lng + 180) / 360) * scale;
    // 緯度をメルカトル図法の計算式でY座標に変換します
    const rad = (lat * Math.PI) / 180;
    const y = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * scale;
    // 計算したXとYのピクセル位置を返します
    return { x: x, y: y };
  },

  // 【操作機能】「＋（拡大）」「－（縮小）」「全体」ボタンが押された時の処理です
  changeZoom: function(delta) {
    // まだ一度も地図が描かれていなければ何もしません
    if (!this.lastParams) {
      return;
    }
    // deltaが0の場合は「全体表示」ボタンが押されたので、自動ズーム(null)に戻します
    if (delta === 0) {
      this.currentZoom = null;
    } else {
      // 現在のズーム倍率に +1 または -1 します（最小5倍〜最大15倍の範囲に制限します）
      const nextZoom = this.currentZoom + delta;
      if (nextZoom >= 5 && nextZoom <= 15) {
        this.currentZoom = nextZoom;
      }
    }
    // 保存しておいた最新のコースと進行状況で地図を描き直します
    this.updateMap(this.lastParams.courseId, this.lastParams.progress);
  },

  // 【メイン機能】現在のコースと到達状況に合わせて、地図背景・ルート線・ピンを描画する関数
  updateMap: function(courseId, progress) {
    // 拡大・縮小ボタンから再描画できるように引数を保存しておきます
    this.lastParams = { courseId: courseId, progress: progress };

    // もしコースが切り替わっていたら、ズーム倍率を初期状態（全体表示）に戻します
    if (this.lastCourseId !== courseId) {
      this.currentZoom = null;
      this.lastCourseId = courseId;
    }

    // 地図を描画するHTMLの枠（route-map）を取得します
    const container = document.getElementById('route-map');
    if (!container) {
      return;
    }

    // 地図枠の現在の横幅と高さを取得します（iPhone等で読み込み直後に0になるのを防ぐため最低300pxを確保）
    const width = container.clientWidth > 0 ? container.clientWidth : 320;
    const height = container.clientHeight > 0 ? container.clientHeight : 280;

    // 選択中のコースデータと各地点リストを取得します
    const course = MASTER_DATA[courseId] || MASTER_DATA['course1'];
    const points = course.points;

    // 緯度・経度が設定されている有効な地点だけを抽出します
    const validPoints = [];
    for (let i = 0; i < points.length; i++) {
      if (typeof points[i].lat === 'number' && typeof points[i].lng === 'number') {
        validPoints.push(points[i]);
      }
    }

    // 有効な座標が1つもない場合は案内を出して終了します
    if (validPoints.length === 0) {
      container.innerHTML = '<p style="padding:20px; text-align:center;">座標データがありません</p>';
      return;
    }

    // 1. コース全体の端から端までの緯度・経度を調べます
    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
    for (let i = 0; i < validPoints.length; i++) {
      const p = validPoints[i];
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lng < minLng) minLng = p.lng;
      if (p.lng > maxLng) maxLng = p.lng;
    }

    // ズーム倍率が未指定（全体表示）なら、コース全体が収まる倍率を自動計算します
    let isAutoZoom = false;
    if (this.currentZoom === null) {
      isAutoZoom = true;
      let autoZoom = 8;
      for (let z = 11; z >= 5; z--) {
        const topLeft = this.latLngToPixel(maxLat, minLng, z);
        const bottomRight = this.latLngToPixel(minLat, maxLng, z);
        if ((bottomRight.x - topLeft.x) < (width - 80) && (bottomRight.y - topLeft.y) < (height - 80)) {
          autoZoom = z;
          break;
        }
      }
      this.currentZoom = autoZoom;
    }

    const zoom = this.currentZoom;

    // 地図の中心座標を決めます（全体表示時はコースの中央、拡大時は「現在到達地点」を中心にして見やすくします）
    let centerLat = (minLat + maxLat) / 2;
    let centerLng = (minLng + maxLng) / 2;
    if (!isAutoZoom && typeof progress.latestPoint.lat === 'number') {
      centerLat = progress.latestPoint.lat;
      centerLng = progress.latestPoint.lng;
    }

    // 中心地点の世界ピクセル座標を計算します
    const centerPx = this.latLngToPixel(centerLat, centerLng, zoom);
    // 地図枠の左上隅にあたる世界ピクセル座標を計算します
    const originX = centerPx.x - width / 2;
    const originY = centerPx.y - height / 2;

    // 2. 背景となる「国土地理院の標準地図タイル画像」を敷き詰めるHTMLを組み立てます
    let html = '';
    const startTileX = Math.floor(originX / 256);
    const endTileX = Math.floor((originX + width) / 256);
    const startTileY = Math.floor(originY / 256);
    const endTileY = Math.floor((originY + height) / 256);

    // 必要な範囲のタイル画像を1枚ずつ絶対配置で並べます
    for (let tx = startTileX; tx <= endTileX; tx++) {
      for (let ty = startTileY; ty <= endTileY; ty++) {
        const left = Math.round(tx * 256 - originX);
        const top = Math.round(ty * 256 - originY);
        const tileUrl = 'https://gsi.go.jp' + zoom + '/' + tx + '/' + ty + '.png';
        html += '<img src="' + tileUrl + '" alt="" style="position:absolute; left:' + left + 'px; top:' + top + 'px; width:256px; height:256px; pointer-events:none; opacity:0.88;">';
      }
    }

    // 3. 各地点の画面上の(x, y)座標を計算し、ルート線とピンのSVG図形を作ります
    const allCoords = [];
    const passedCoords = [];
    let svgMarkers = '';

    for (let i = 0; i < validPoints.length; i++) {
      const pt = validPoints[i];
      const px = this.latLngToPixel(pt.lat, pt.lng, zoom);
      const x = Math.round(px.x - originX);
      const y = Math.round(px.y - originY);

      allCoords.push(x + ',' + y);

      const isPassed = progress.currentKm >= pt.km;
      const isLatest = (pt.id === progress.latestPoint.id);

      if (isPassed) {
        passedCoords.push(x + ',' + y);
      }

      const fill = isLatest ? '#ff3b30' : (isPassed ? '#2e6f40' : '#888888');
      const radius = isLatest ? 8 : 5;

      svgMarkers += '<circle cx="' + x + '" cy="' + y + '" r="' + radius + '" fill="' + fill + '" stroke="#ffffff" stroke-width="2" />';

      // ズーム倍率10以上の拡大時はすべての街名を表示し、広域時は現在地・スタート・ゴールを表示します
      if (zoom >= 10 || isLatest || i === 0 || i === validPoints.length - 1) {
        const textColor = isLatest ? '#d93025' : '#222222';
        const fontWeight = isLatest ? 'bold' : 'normal';
        svgMarkers += '<text x="' + (x + 10) + '" y="' + (y + 4) + '" font-size="11" font-weight="' + fontWeight + '" fill="' + textColor + '" stroke="#ffffff" stroke-width="3" paint-order="stroke">' + pt.name + '</text>';
      }
    }

    // 4. SVG全体（全ルートのグレー点線 ＋ 歩いた区間の緑実線 ＋ 地点ピンと名前）を組み立てます
    let svgHtml = '<svg width="' + width + '" height="' + height + '" style="position:absolute; left:0; top:0; pointer-events:none;">';
    if (allCoords.length >= 2) {
      svgHtml += '<polyline points="' + allCoords.join(' ') + '" fill="none" stroke="#666666" stroke-width="3" stroke-dasharray="5,5" />';
    }
    if (passedCoords.length >= 2) {
      svgHtml += '<polyline points="' + passedCoords.join(' ') + '" fill="none" stroke="#2e6f40" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />';
    }
    svgHtml += svgMarkers;
    svgHtml += '</svg>';

    // 5. 右上に「＋（拡大）」「－（縮小）」「全体」の操作ボタンを配置します
    const controlsHtml =
      '<div style="position:absolute; right:8px; top:8px; display:flex; flex-direction:column; gap:4px; z-index:5;">' +
        '<button type="button" onclick="MapManager.changeZoom(1)" style="width:32px; height:32px; font-size:18px; font-weight:bold; background:#ffffff; border:1px solid #999; border-radius:6px; box-shadow:0 1px 3px rgba(0,0,0,0.2);">＋</button>' +
        '<button type="button" onclick="MapManager.changeZoom(-1)" style="width:32px; height:32px; font-size:18px; font-weight:bold; background:#ffffff; border:1px solid #999; border-radius:6px; box-shadow:0 1px 3px rgba(0,0,0,0.2);">－</button>' +
        '<button type="button" onclick="MapManager.changeZoom(0)" style="width:32px; height:24px; font-size:10px; font-weight:bold; background:#ffffff; border:1px solid #999; border-radius:6px; box-shadow:0 1px 3px rgba(0,0,0,0.2);">全体</button>' +
      '</div>';

    // 6. 左上に現在のズーム倍率、右下に国土地理院の出典表記を配置します
    const zoomBadgeHtml = '<div style="position:absolute; left:6px; top:6px; background:rgba(255,255,255,0.85); font-size:10px; padding:2px 6px; border-radius:4px; color:#333;">倍率: ' + zoom + '</div>';
    const creditHtml = '<div style="position:absolute; right:4px; bottom:2px; background:rgba(255,255,255,0.85); font-size:9px; padding:1px 4px; border-radius:3px; color:#333;">出典:国土地理院</div>';

    // 組み立てたすべての要素を地図枠の中に反映します
    container.innerHTML = html + svgHtml + controlsHtml + zoomBadgeHtml + creditHtml;
  }
};
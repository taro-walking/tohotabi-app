// 外部ライブラリを使わず、国土地理院の地図タイルとSVG図形でルートを描画する自作地図エンジンです
const MapManager = {

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

  // 【メイン機能】現在のコースと到達状況に合わせて、地図背景・ルート線・ピンを描画する関数
  updateMap: function(courseId, progress) {
    // 地図を描画するHTMLの枠（route-map）を取得します
    const container = document.getElementById('route-map');
    if (!container) {
      return;
    }

    // 地図枠の現在の横幅と高さを取得します（横幅が0の場合は標準の340pxを使います）
    const width = container.clientWidth || 340;
    const height = container.clientHeight || 280;

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

    // 1. コース全体の中心となる緯度・経度と、全体が収まる最適なズーム倍率(zoom)を自動計算します
    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
    for (let i = 0; i < validPoints.length; i++) {
      const p = validPoints[i];
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lng < minLng) minLng = p.lng;
      if (p.lng > maxLng) maxLng = p.lng;
    }
    // コースの真ん中の緯度・経度を求めます
    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;

    // ズーム倍率を11から5まで下げながら、コース全体が枠内に収まる倍率を探します
    let bestZoom = 8;
    for (let z = 11; z >= 5; z--) {
      const topLeft = this.latLngToPixel(maxLat, minLng, z);
      const bottomRight = this.latLngToPixel(minLat, maxLng, z);
      // 上下左右に60pxの余白を残して枠内に収まるか判定します
      if ((bottomRight.x - topLeft.x) < (width - 80) && (bottomRight.y - topLeft.y) < (height - 80)) {
        bestZoom = z;
        break;
      }
    }

    // 中心地点の世界ピクセル座標を計算します
    const centerPx = this.latLngToPixel(centerLat, centerLng, bestZoom);
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
        // 画面上の表示位置（左から何px、上から何px）を計算します
        const left = Math.round(tx * 256 - originX);
        const top = Math.round(ty * 256 - originY);
        // 国土地理院の公式標準地図タイルのURLです
        const tileUrl = 'https://gsi.go.jp' + bestZoom + '/' + tx + '/' + ty + '.png';
        // 画像を配置するimgタグを追加します（万が一オフラインでも崩れないようaltは空にします）
        html += '<img src="' + tileUrl + '" alt="" style="position:absolute; left:' + left + 'px; top:' + top + 'px; width:256px; height:256px; pointer-events:none; opacity:0.85;">';
      }
    }

    // 3. 各地点の画面上の(x, y)座標を計算し、ルート線とピンのSVG図形を作ります
    const allCoords = [];
    const passedCoords = [];
    let svgMarkers = '';

    for (let i = 0; i < validPoints.length; i++) {
      const pt = validPoints[i];
      // 世界ピクセル座標から枠内の相対位置(x, y)に変換します
      const px = this.latLngToPixel(pt.lat, pt.lng, bestZoom);
      const x = Math.round(px.x - originX);
      const y = Math.round(px.y - originY);

      // 全ルートの座標リストに追加します
      allCoords.push(x + ',' + y);

      // 通過済みか・最新到達地点かを判定します
      const isPassed = progress.currentKm >= pt.km;
      const isLatest = (pt.id === progress.latestPoint.id);

      if (isPassed) {
        passedCoords.push(x + ',' + y);
      }

      // ピンの色と大きさを決めます（最新地点は赤色・大きめ、通過済は緑、未到達はグレー）
      const fill = isLatest ? '#ff3b30' : (isPassed ? '#2e6f40' : '#888888');
      const radius = isLatest ? 8 : 5;

      // 丸いピンを描画するSVGタグを追加します
      svgMarkers += '<circle cx="' + x + '" cy="' + y + '" r="' + radius + '" fill="' + fill + '" stroke="#ffffff" stroke-width="2" />';

      // 最新到達地点またはスタート・ゴールの場合は、地図上に街の名前ラベルを表示します
      if (isLatest || i === 0 || i === validPoints.length - 1) {
        // ラベルの文字色と太さを設定します（最新地点は赤枠の吹き出し風ラベル）
        const textColor = isLatest ? '#d93025' : '#222222';
        const fontWeight = isLatest ? 'bold' : 'normal';
        // 白い縁取りを付けて地図の上でも文字がくっきり読めるようにします
        svgMarkers += '<text x="' + (x + 10) + '" y="' + (y + 4) + '" font-size="11" font-weight="' + fontWeight + '" fill="' + textColor + '" stroke="#ffffff" stroke-width="3" paint-order="stroke">' + pt.name + '</text>';
      }
    }

    // 4. SVG全体（全ルートのグレー点線 ＋ 歩いた区間の緑実線 ＋ 地点ピンと名前）を組み立てます
    let svgHtml = '<svg width="' + width + '" height="' + height + '" style="position:absolute; left:0; top:0; pointer-events:none;">';
    // 全ルートをグレーの点線で結びます
    if (allCoords.length >= 2) {
      svgHtml += '<polyline points="' + allCoords.join(' ') + '" fill="none" stroke="#666666" stroke-width="3" stroke-dasharray="5,5" />';
    }
    // すでに歩いた区間を濃い緑色の太線で重ねて結びます
    if (passedCoords.length >= 2) {
      svgHtml += '<polyline points="' + passedCoords.join(' ') + '" fill="none" stroke="#2e6f40" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />';
    }
    // ピンと文字ラベルを追加します
    svgHtml += svgMarkers;
    svgHtml += '</svg>';

    // 5. 国土地理院の出典表記（利用規約に基づく右下クレジット）を追加します
    const creditHtml = '<div style="position:absolute; right:4px; bottom:2px; background:rgba(255,255,255,0.8); font-size:9px; padding:1px 4px; border-radius:3px; color:#333;">出典:国土地理院</div>';

    // 組み立てた地図背景・ルート線・ピン・出典表記を地図枠の中に一括反映します
    container.innerHTML = html + svgHtml + creditHtml;
  }
};
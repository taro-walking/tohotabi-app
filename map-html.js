// 地図上のタイル・線・ピン・ボタンのHTMLを作るモジュールです
const MapHtml = {
  // 国土地理院タイルのHTMLを組み立てます
  buildTiles: function(zoom, originX, originY, width, height) {
    // URLを分割して安全に組み立てます
    const p1 = 'https:' + '//cyberjapandata.';
    const p2 = 'gsi.go.jp' + '/xyz/std/';
    const base = p1 + p2;
    let html = '';

    // 画面範囲のタイル番号を計算します
    const sX = Math.floor(originX / 256);
    const eX = Math.floor((originX + width) / 256);
    const sY = Math.floor(originY / 256);
    const eY = Math.floor((originY + height) / 256);

    // 必要なタイル画像を並べるタグを作ります
    for (let tx = sX; tx <= eX; tx++) {
      for (let ty = sY; ty <= eY; ty++) {
        const left = Math.round(tx * 256 - originX);
        const top = Math.round(ty * 256 - originY);
        const url = base + zoom + '/' + tx + '/' + ty + '.png';
        html += '<img src="' + url + '" alt="" ';
        html += 'style="position:absolute; left:' + left + 'px; ';
        html += 'top:' + top + 'px; width:256px; height:256px; ';
        html += 'pointer-events:none;">';
      }
    }
    return html;
  },

  // ルート線のSVGタグを組み立てます
  buildLines: function(allCoords, passedCoords, width, height) {
    let svg = '<svg width="' + width + '" height="' + height + '" ';
    svg += 'style="position:absolute; left:0; top:0; ';
    svg += 'pointer-events:none; z-index:2;">';

    // コース全体の点線を描画します
    if (allCoords.length >= 2) {
      svg += '<polyline points="' + allCoords.join(' ') + '" ';
      svg += 'fill="none" stroke="#888888" stroke-width="4" ';
      svg += 'stroke-dasharray="6,4" />';
    }
    // 通過済みの緑色の実線を描画します
    if (passedCoords.length >= 2) {
      svg += '<polyline points="' + passedCoords.join(' ') + '" ';
      svg += 'fill="none" stroke="#2e6f40" stroke-width="5" />';
    }
    svg += '</svg>';
    return svg;
  },

  // 地点ピン・地名ラベル・吹き出しを組み立てます
  buildPins: function(points, zoom, originX, originY, width, height, progress, selectedId) {
    const allCoords = new Array();
    const passedCoords = new Array();
    let pins = '';
    let popup = '';

    for (let i = 0; i < points.length; i++) {
      const pt = points.at(i);
      const px = MapCalc.latLngToPixel(pt.lat, pt.lng, zoom);
      const x = Math.round(px.x - originX);
      const y = Math.round(px.y - originY);

      allCoords.push(x + ',' + y);
      const isPassed = progress.currentKm >= pt.km;
      const isLatest = (pt.id === progress.latestPoint.id);
      const isSel = (pt.id === selectedId);
      const isEv = CourseHelper.isEvent(pt);

      if (isPassed) {
        passedCoords.push(x + ',' + y);
      }

      // 画面付近にあるピンだけHTML化します
      if (x >= -20 && x <= width + 20 && y >= -20 && y <= height + 20) {
        // 通常地点とイベント地点で色・形を明確に区分します
        let bg = isPassed ? '#2e6f40' : '#ffcc00';
        if (isEv) {
          bg = isPassed ? '#0f766e' : '#ff9500';
        }
        if (isLatest) {
          bg = '#ff3b30';
        }
        // 選択中のピンは青い太枠、未通過ピンは黒枠でくっきりさせます
        const bd = isSel ? '#007aff' : ((!isLatest && !isPassed) ? '#333333' : '#ffffff');
        const baseSz = isEv ? 12 : 14;
        const sz = isSel ? 20 : (isLatest ? 20 : baseSz);
        const off = sz / 2;
        const zIdx = isSel ? 5 : (isLatest ? 4 : (isEv ? 2 : 3));
        // イベント地点はひし形（角丸2px＋45度回転）、通常地点は丸型にします
        const radius = isEv ? '2px' : '50%';
        const rot = isEv ? 'transform:rotate(45deg); ' : '';

        // ブラウザ標準装飾に邪魔されないdiv要素でタップ可能なピンを作ります
        pins += '<div role="button" data-point-id="' + pt.id + '" ';
        pins += 'style="position:absolute; left:' + (x - off) + 'px; ';
        pins += 'top:' + (y - off) + 'px; width:' + sz + 'px; ';
        pins += 'height:' + sz + 'px; border-radius:' + radius + '; ';
        pins += rot + 'background:' + bg + '; border:2px solid ' + bd + '; ';
        pins += 'box-sizing:border-box; z-index:' + zIdx + '; cursor:pointer;">';
        pins += '</div>';

        // 現在地または拡大時（ズーム11以上）のみ地名ラベルを表示します
        if (isLatest || zoom >= 11) {
          const fw = isLatest ? 'bold' : 'normal';
          const col = isLatest ? '#d93025' : (isEv ? '#9a3412' : '#111111');
          pins += '<div style="position:absolute; ';
          pins += 'left:' + (x + off + 5) + 'px; top:' + (y - 8) + 'px; ';
          pins += 'font-size:11px; font-weight:' + fw + '; ';
          pins += 'color:' + col + '; background:rgba(255,255,255,0.88); ';
          pins += 'padding:0 3px; border-radius:3px; ';
          pins += 'pointer-events:none; white-space:nowrap; z-index:3;">';
          pins += pt.name + '</div>';
        }
      }

      // 選択中の地点情報を地図下部の固定カードに表示します
      if (isSel) {
        const cardBd = isEv ? '#e67e22' : '#2e6f40';
        const titleCol = isEv ? '#c2410c' : '#2e6f40';
        const evTag = isEv
          ? '<span style="background:#ffedd5; color:#c2410c; font-size:10px; ' +
            'padding:1px 5px; border-radius:4px; margin-right:4px;">🚩イベント</span>'
          : '';
        popup = '<div style="position:absolute; left:8px; right:8px; ';
        popup += 'bottom:44px; background:rgba(255,255,255,0.96); ';
        popup += 'border:1.5px solid ' + cardBd + '; border-radius:8px; ';
        popup += 'padding:6px 10px; font-size:11px; z-index:6; ';
        popup += 'box-shadow:0 2px 6px rgba(0,0,0,0.2); ';
        popup += 'pointer-events:none;">';
        popup += '<div style="display:flex; justify-content:space-between; ';
        popup += 'align-items:center; gap:6px;">';
        popup += '<span style="font-weight:bold; color:' + titleCol + ';">';
        popup += evTag + pt.name + ' (' + pt.km + 'km)</span>';
        popup += '<button type="button" data-guide-id="' + pt.id + '" ';
        popup += 'style="pointer-events:auto; background:' + cardBd + '; ';
        popup += 'color:#ffffff; border:none; border-radius:5px; ';
        popup += 'padding:3px 8px; font-size:11px; font-weight:bold; ';
        popup += 'cursor:pointer; flex-shrink:0;">📖 写真・ガイド</button></div>';
        popup += '<div style="margin-top:2px;">🏯 ' + pt.spot + '</div>';
        popup += '<div>🍱 ' + pt.specialty + '</div></div>';
      }
    }

    const lines = this.buildLines(allCoords, passedCoords, width, height);
    return lines + pins + popup;
  },

  // 操作ボタンと地理院クレジットのHTMLを組み立てます
  buildControls: function() {
    const st = 'background:rgba(255,255,255,0.92); border:1px solid #999; ' +
      'border-radius:6px; font-weight:bold; color:#222; cursor:pointer;';

    // 右上の拡大・縮小ボタンです
    let html = '<div style="position:absolute; right:8px; top:8px; ';
    html += 'display:flex; flex-direction:column; gap:6px; z-index:5;">';
    html += '<button type="button" data-action="zoomIn" ';
    html += 'style="' + st + ' width:34px; height:34px; font-size:18px;">';
    html += '＋</button>';
    html += '<button type="button" data-action="zoomOut" ';
    html += 'style="' + st + ' width:34px; height:34px; font-size:18px;">';
    html += '－</button></div>';

    // 右下の現在地・全体ボタンです
    html += '<div style="position:absolute; right:8px; bottom:8px; ';
    html += 'display:flex; gap:6px; z-index:5;">';
    html += '<button type="button" data-action="focusCurrent" ';
    html += 'style="' + st + ' padding:6px 10px; font-size:12px;">';
    html += '📍 現在地</button>';
    html += '<button type="button" data-action="fitAll" ';
    html += 'style="' + st + ' padding:6px 10px; font-size:12px;">';
    html += '🗺️ 全体</button></div>';

    // 左下の地理院クレジットです
    html += '<div style="position:absolute; left:6px; bottom:4px; ';
    html += 'font-size:9px; color:#333; padding:1px 4px; ';
    html += 'background:rgba(255,255,255,0.75); border-radius:3px; ';
    html += 'z-index:5; pointer-events:none;">地理院タイル</div>';

    return html;
  }
};
// --- map-html.js ここまで ---
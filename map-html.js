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

      if (isPassed) {
        passedCoords.push(x + ',' + y);
      }

      // 画面付近にあるピンだけHTML化します
      if (x >= -20 && x <= width + 20 && y >= -20 && y <= height + 20) {
        const bg = isLatest ? '#ff3b30' : (isPassed ? '#2e6f40' : '#777');
        const sz = isLatest ? 20 : 14;
        const off = sz / 2;
        const zIdx = isLatest ? 4 : 3;

        // タップ可能な丸いピンボタンです
        pins += '<button type="button" data-point-id="' + pt.id + '" ';
        pins += 'style="position:absolute; left:' + (x - off) + 'px; ';
        pins += 'top:' + (y - off) + 'px; width:' + sz + 'px; ';
        pins += 'height:' + sz + 'px; border-radius:50%; ';
        pins += 'background:' + bg + '; border:2px solid #fff; ';
        pins += 'z-index:' + zIdx + '; padding:0; cursor:pointer;">';
        pins += '</button>';

        // 地名ラベルです
        const fw = isLatest ? 'bold' : 'normal';
        const col = isLatest ? '#d93025' : '#111111';
        pins += '<div style="position:absolute; ';
        pins += 'left:' + (x + off + 4) + 'px; top:' + (y - 8) + 'px; ';
        pins += 'font-size:11px; font-weight:' + fw + '; ';
        pins += 'color:' + col + '; background:rgba(255,255,255,0.8); ';
        pins += 'padding:0 3px; border-radius:3px; ';
        pins += 'pointer-events:none; white-space:nowrap; z-index:3;">';
        pins += pt.name + '</div>';

        // 選択中の吹き出しです
        if (isSel) {
          const pLeft = Math.max(8, Math.min(width - 190, x - 90));
          const pTop = (y < 95) ? (y + off + 8) : (y - off - 78);
          popup += '<div style="position:absolute; ';
          popup += 'left:' + pLeft + 'px; top:' + pTop + 'px; ';
          popup += 'width:182px; background:rgba(255,255,255,0.96); ';
          popup += 'border:1px solid #2e6f40; border-radius:8px; ';
          popup += 'padding:6px 8px; font-size:11px; z-index:6; ';
          popup += 'pointer-events:none;">';
          popup += '<div style="font-weight:bold; color:#2e6f40;">';
          popup += pt.name + ' (' + pt.km + 'km)</div>';
          popup += '<div>🏯 ' + pt.spot + '</div>';
          popup += '<div>🍱 ' + pt.specialty + '</div></div>';
        }
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
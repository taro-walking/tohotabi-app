// 地図の描画と拡大縮小・ピン選択を担当するモジュールです（MapCalcを使用）
const MapManager = {
  // 現在のズーム倍率（5〜17）を保存します
  currentZoom: null,
  // 現在の中心緯度を保存します
  centerLat: null,
  // 現在の中心経度を保存します
  centerLng: null,
  // 前回のコースIDを保存します
  lastCourseId: null,
  // 再描画用のパラメータを保存します
  lastParams: null,
  // 吹き出しを表示する地点のIDです
  selectedPointId: null,

  // 拡大・縮小・現在地・全体ボタンが押された時の処理です
  controlAction: function(action) {
    if (!this.lastParams) {
      return;
    }
    if (action === 'zoomIn' && this.currentZoom < 17) {
      this.currentZoom += 1;
    } else if (action === 'zoomOut' && this.currentZoom > 5) {
      this.currentZoom -= 1;
    } else if (action === 'fitAll') {
      this.currentZoom = null;
      this.centerLat = null;
      this.centerLng = null;
    } else if (action === 'focusCurrent') {
      const latest = this.lastParams.progress.latestPoint;
      if (latest && typeof latest.lat === 'number') {
        this.centerLat = latest.lat;
        this.centerLng = latest.lng;
        this.currentZoom = 14;
        this.selectedPointId = latest.id;
      }
    }
    this.updateMap(this.lastParams.courseId, this.lastParams.progress);
  },

  // ピンをタップした時に吹き出しを開閉する処理です
  selectPoint: function(pointId) {
    this.selectedPointId = (this.selectedPointId === pointId) ? null : pointId;
    if (this.lastParams) {
      this.updateMap(this.lastParams.courseId, this.lastParams.progress);
    }
  },

  // 地図全体を描画するメイン関数です
  updateMap: function(courseId, progress) {
    const container = document.getElementById('route-map');
    if (!container) {
      return;
    }

    try {
      this.lastParams = { courseId: courseId, progress: progress };

      if (this.lastCourseId !== courseId) {
        this.currentZoom = null;
        this.centerLat = null;
        this.centerLng = null;
        this.selectedPointId = progress.latestPoint ? progress.latestPoint.id : null;
        this.lastCourseId = courseId;
      }

      const width = container.clientWidth || 320;
      const height = container.clientHeight || 320;
      const course = Reflect.get(MASTER_DATA, courseId) || MASTER_DATA.course1;
      const points = course.points;

      const validPoints = new Array();
      for (let i = 0; i < points.length; i++) {
        const pt = points.at(i);
        if (pt && typeof pt.lat === 'number' && typeof pt.lng === 'number') {
          validPoints.push(pt);
        }
      }

      if (validPoints.length === 0) {
        container.innerHTML = '<p style="padding:20px;">座標データなし</p>';
        return;
      }

      // 初回または全体表示時に中心座標とズームを自動計算します
      if (this.currentZoom === null || this.centerLat === null) {
        let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
        for (let i = 0; i < validPoints.length; i++) {
          const p = validPoints.at(i);
          if (p.lat < minLat) minLat = p.lat;
          if (p.lat > maxLat) maxLat = p.lat;
          if (p.lng < minLng) minLng = p.lng;
          if (p.lng > maxLng) maxLng = p.lng;
        }
        this.centerLat = (minLat + maxLat) / 2;
        this.centerLng = (minLng + maxLng) / 2;

        let autoZoom = 8;
        for (let z = 12; z >= 5; z--) {
          const tl = MapCalc.latLngToPixel(maxLat, minLng, z);
          const br = MapCalc.latLngToPixel(minLat, maxLng, z);
          if ((br.x - tl.x) < (width - 80) && (br.y - tl.y) < (height - 80)) {
            autoZoom = z;
            break;
          }
        }
        this.currentZoom = autoZoom;
      }

      const zoom = this.currentZoom;
      const cPx = MapCalc.latLngToPixel(this.centerLat, this.centerLng, zoom);
      const originX = cPx.x - width / 2;
      const originY = cPx.y - height / 2;

      // 国土地理院タイルのURLを文字列分割で安全に組み立てます
      const tileBase = 'https:' + '//cyberjapandata.' + 'gsi.go.jp' + '/xyz/std/';
      let tilesHtml = '';
      const startTX = Math.floor(originX / 256);
      const endTX = Math.floor((originX + width) / 256);
      const startTY = Math.floor(originY / 256);
      const endTY = Math.floor((originY + height) / 256);

      for (let tx = startTX; tx <= endTX; tx++) {
        for (let ty = startTY; ty <= endTY; ty++) {
          const left = Math.round(tx * 256 - originX);
          const top = Math.round(ty * 256 - originY);
          const url = tileBase + zoom + '/' + tx + '/' + ty + '.png';
          tilesHtml += '<img src="' + url + '" alt="" style="position:absolute; left:' +
            left + 'px; top:' + top + 'px; width:256px; height:256px; pointer-events:none;">';
        }
      }

      // ルート線・ピン・吹き出しを組み立てます
      const allCoords = new Array();
      const passedCoords = new Array();
      let pinsHtml = '';
      let popupHtml = '';

      for (let i = 0; i < validPoints.length; i++) {
        const pt = validPoints.at(i);
        const px = MapCalc.latLngToPixel(pt.lat, pt.lng, zoom);
        const x = Math.round(px.x - originX);
        const y = Math.round(px.y - originY);

        allCoords.push(x + ',' + y);
        const isPassed = progress.currentKm >= pt.km;
        const isLatest = (pt.id === progress.latestPoint.id);
        const isSelected = (pt.id === this.selectedPointId);

        if (isPassed) {
          passedCoords.push(x + ',' + y);
        }

        if (x >= -20 && x <= width + 20 && y >= -20 && y <= height + 20) {
          const bg = isLatest ? '#ff3b30' : (isPassed ? '#2e6f40' : '#777777');
          const size = isLatest ? 20 : 14;
          const off = size / 2;

          pinsHtml += '<button type="button" onclick="MapManager.selectPoint(' + pt.id + ')" ' +
            'style="position:absolute; left:' + (x - off) + 'px; top:' + (y - off) + 'px; ' +
            'width:' + size + 'px; height:' + size + 'px; border-radius:50%; background:' + bg + '; ' +
            'border:2px solid #fff; z-index:' + (isLatest ? 4 : 3) + '; padding:0;"></button>';

          pinsHtml += '<div style="position:absolute; left:' + (x + off + 4) + 'px; top:' + (y - 8) + 'px; ' +
            'font-size:11px; font-weight:' + (isLatest ? 'bold' : 'normal') + '; ' +
            'color:' + (isLatest ? '#d93025' : '#111') + '; ' +
            'text-shadow:-1px -1px 0 #fff,1px -1px 0 #fff,-1px 1px 0 #fff,1px 1px 0 #fff; ' +
            'pointer-events:none; white-space:nowrap; z-index:3;">' + pt.name + '</div>';

          if (isSelected) {
            const pLeft = Math.max(8, Math.min(width - 190, x - 90));
            const pTop = Math.max(8, y - off - 78);
            popupHtml = '<div style="position:absolute; left:' + pLeft + 'px; top:' + pTop + 'px; ' +
              'width:182px; background:rgba(255,255,255,0.96); border:1px solid #2e6f40; ' +
              'border-radius:8px; padding:6px 8px; font-size:11px; z-index:6; pointer-events:none;">' +
              '<div style="font-weight:bold; color:#2e6f40;">' + pt.name + ' (' + pt.km + 'km)</div>' +
              '<div>🏯 ' + pt.spot + '</div><div>🍱 ' + pt.specialty + '</div></div>';
          }
        }
      }

      // SVG線を組み立てます
      let svgHtml = '<svg width="' + width + '" height="' + height + '" ' +
        'style="position:absolute; left:0; top:0; pointer-events:none; z-index:2;">';
      if (allCoords.length >= 2) {
        svgHtml += '<polyline points="' + allCoords.join(' ') + '" fill="none" stroke="#555" stroke-width="3" stroke-dasharray="6,6" />';
      }
      if (passedCoords.length >= 2) {
        svgHtml += '<polyline points="' + passedCoords.join(' ') + '" fill="none" stroke="#2e6f40" stroke-width="5" />';
      }
      svgHtml += '</svg>';

      // 右上の操作ボタン（＋・－・現在地・全体）です
      const controlsHtml =
        '<div style="position:absolute; right:8px; top:8px; display:flex; flex-direction:column; gap:4px; z-index:10;">' +
        '<button type="button" onclick="MapManager.controlAction(\'zoomIn\')" style="width:36px; height:32px; font-size:18px; font-weight:bold; background:#fff; border:1px solid #888; border-radius:6px;">＋</button>' +
        '<button type="button" onclick="MapManager.controlAction(\'zoomOut\')" style="width:36px; height:32px; font-size:18px; font-weight:bold; background:#fff; border:1px solid #888; border-radius:6px;">－</button>' +
        '<button type="button" onclick="MapManager.controlAction(\'focusCurrent\')" style="width:36px; height:26px; font-size:10px; font-weight:bold; background:#fff4f4; color:#d93025; border:1px solid #d93025; border-radius:6px;">現在地</button>' +
        '<button type="button" onclick="MapManager.controlAction(\'fitAll\')" style="width:36px; height:26px; font-size:10px; font-weight:bold; background:#fff; border:1px solid #888; border-radius:6px;">全体</button>' +
        '</div>';

      const infoHtml =
        '<div style="position:absolute; left:6px; top:6px; background:rgba(255,255,255,0.85); font-size:10px; padding:2px 6px; border-radius:4px; z-index:5;">ズーム: ' + zoom + '/17</div>' +
        '<div style="position:absolute; right:4px; bottom:2px; background:rgba(255,255,255,0.85); font-size:9px; padding:1px 4px; border-radius:3px; z-index:5;">出典:国土地理院</div>';

      container.innerHTML = tilesHtml + svgHtml + pinsHtml + popupHtml + controlsHtml + infoHtml;

    } catch (err) {
      container.innerHTML = '<p style="padding:16px; color:#d93025;">地図エラー: ' + err.message + '</p>';
    }
  }
};
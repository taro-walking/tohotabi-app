// 緯度経度変換と進行方向オフセットを計算するモジュールです
const MapCalc = {
  // 緯度・経度からピクセル座標(x, y)を計算します
  latLngToPixel: function(lat, lng, zoom) {
    // ズーム倍率に応じた地図全体の横幅を出します
    const scale = 256 * Math.pow(2, zoom);
    // 経度をX座標に変換します
    const x = ((lng + 180) / 360) * scale;
    // 緯度をラジアンに変換します
    const rad = (lat * Math.PI) / 180;
    // メルカトル図法でY座標を出します
    const sinLat = Math.tan(rad) + 1 / Math.cos(rad);
    const y = ((1 - Math.log(sinLat) / Math.PI) / 2) * scale;
    // 計算結果を返します
    return { x: x, y: y };
  },

  // ピクセル座標(x, y)から緯度・経度へ逆変換します
  pixelToLatLng: function(x, y, zoom) {
    // ズーム倍率に応じた地図全体の横幅を出します
    const scale = 256 * Math.pow(2, zoom);
    // X座標から経度を計算します
    const lng = (x / scale) * 360 - 180;
    // Y座標から緯度を計算します
    const n = Math.PI - (2 * Math.PI * y) / scale;
    const expDiff = Math.exp(n) - Math.exp(-n);
    const lat = (180 / Math.PI) * Math.atan(0.5 * expDiff);
    // 計算結果を返します
    return { lat: lat, lng: lng };
  },

  // 進行方向に合わせて現在地を端寄りに置く中心座標を出します
  calcFocusedCenter: function(points, latest, zoom, height) {
    // 現在地のインデックス番号を探します
    let idx = -1;
    for (let i = 0; i < points.length; i++) {
      const pt = points.at(i);
      if (pt && pt.id === latest.id) {
        idx = i;
        break;
      }
    }

    // 次の地点（ゴール時は前の地点）との緯度差を出します
    let latDiff = 0;
    if (idx >= 0 && idx + 1 < points.length) {
      const nextPt = points.at(idx + 1);
      if (nextPt && typeof nextPt.lat === 'number') {
        latDiff = nextPt.lat - latest.lat;
      }
    } else if (idx > 0) {
      const prevPt = points.at(idx - 1);
      if (prevPt && typeof prevPt.lat === 'number') {
        latDiff = latest.lat - prevPt.lat;
      }
    }

    // 北向きなら下端寄り、南向きなら上端寄りにずらします
    let offsetY = 0;
    if (latDiff > 0) {
      offsetY = -Math.round(height * 0.25);
    } else if (latDiff < 0) {
      offsetY = Math.round(height * 0.25);
    }

    // ずらした中心ピクセル座標から緯度・経度を返します
    const px = this.latLngToPixel(latest.lat, latest.lng, zoom);
    return this.pixelToLatLng(px.x, px.y + offsetY, zoom);
  }
};
// --- map-calc.js ここまで ---
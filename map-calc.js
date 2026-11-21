// 緯度・経度と画面上のピクセル座標を相互変換する計算専用モジュールです
const MapCalc = {
  // 緯度・経度から世界地図上のピクセル座標(x, y)を計算します
  latLngToPixel: function(lat, lng, zoom) {
    // ズーム倍率に応じた地図全体の横幅（1タイル256px）を出します
    const scale = 256 * Math.pow(2, zoom);
    // 経度をX座標に変換します
    const x = ((lng + 180) / 360) * scale;
    // 緯度をラジアンに変換します
    const rad = (lat * Math.PI) / 180;
    // メルカトル図法の計算式でY座標を出します
    const sinLat = Math.tan(rad) + 1 / Math.cos(rad);
    const y = ((1 - Math.log(sinLat) / Math.PI) / 2) * scale;
    // 計算結果を返します
    return { x: x, y: y };
  },

  // 世界地図上のピクセル座標(x, y)から緯度・経度へ逆変換します
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
  }
};
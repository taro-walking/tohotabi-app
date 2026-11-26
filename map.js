// 地図の操作イベントと全体描画を制御するモジュールです
const MapManager = {
  // 現在のズーム倍率（5〜17）です
  currentZoom: null,
  // 現在の中心緯度と経度です
  centerLat: null,
  centerLng: null,
  // 前回のコースIDと描画パラメータです
  lastCourseId: null,
  lastParams: null,
  // 吹き出しを表示する地点のIDです
  selectedPointId: null,
  // イベント設定済みフラグとドラッグ状態変数です
  isEventsReady: false,
  isPointerDown: false,
  hasMoved: false,
  startX: 0,
  startY: 0,
  lastX: 0,
  lastY: 0,

  // 進行方向に合わせて現在地を端寄りに配置します
  applyDirectionFocus: function(zoom) {
    if (!this.lastParams) {
      return;
    }
    const box = document.getElementById('route-map');
    const h = box ? (box.clientHeight || 300) : 300;
    const cid = this.lastParams.courseId;
    const course = Reflect.get(MASTER_DATA, cid) || MASTER_DATA.course1;
    const latest = this.lastParams.progress.latestPoint;
    if (!latest || typeof latest.lat !== 'number') {
      return;
    }
    const c = MapCalc.calcFocusedCenter(course.points, latest, zoom, h);
    this.centerLat = c.lat;
    this.centerLng = c.lng;
  },

  // 拡大・縮小・現在地・全体ボタンの処理です
  controlAction: function(action) {
    if (!this.lastParams) {
      return;
    }
    if (action === 'zoomIn' && this.currentZoom < 17) {
      // 1段階拡大し、現在地が見失われないよう位置を整えます
      this.currentZoom += 1;
      this.applyDirectionFocus(this.currentZoom);
    } else if (action === 'zoomOut' && this.currentZoom > 5) {
      // 1段階縮小します
      this.currentZoom -= 1;
    } else if (action === 'fitAll') {
      // 全体表示に戻します
      this.currentZoom = null;
      this.centerLat = null;
      this.centerLng = null;
    } else if (action === 'focusCurrent') {
      // 現在地へズーム14で移動します
      const latest = this.lastParams.progress.latestPoint;
      if (latest && typeof latest.lat === 'number') {
        this.currentZoom = 14;
        this.applyDirectionFocus(this.currentZoom);
        this.selectedPointId = latest.id;
      }
    }
    this.updateMap(this.lastParams.courseId, this.lastParams.progress);
  },

  // ピンタップ時の吹き出し開閉です
  selectPoint: function(pointId) {
    this.selectedPointId = (this.selectedPointId === pointId) ? null : pointId;
    if (this.lastParams) {
      this.updateMap(this.lastParams.courseId, this.lastParams.progress);
    }
  },

  // ドラッグ移動とタップのイベントを登録します
  setupEvents: function(box) {
    if (this.isEventsReady) {
      return;
    }
    this.isEventsReady = true;
    box.style.touchAction = 'none';

    // 押し始めの処理です
    const onStart = (x, y) => {
      this.isPointerDown = true;
      this.hasMoved = false;
      this.startX = x;
      this.startY = y;
      this.lastX = x;
      this.lastY = y;
    };

    // ドラッグ移動中の処理です
    const onMove = (x, y) => {
      if (!this.isPointerDown || !this.lastParams || this.centerLat === null) {
        return;
      }
      if (Math.abs(x - this.startX) >= 5 || Math.abs(y - this.startY) >= 5) {
        this.hasMoved = true;
      }
      if (!this.hasMoved) {
        return;
      }
      const dx = x - this.lastX;
      const dy = y - this.lastY;
      const z = this.currentZoom;
      const cPx = MapCalc.latLngToPixel(this.centerLat, this.centerLng, z);
      const next = MapCalc.pixelToLatLng(cPx.x - dx, cPx.y - dy, z);
      this.centerLat = next.lat;
      this.centerLng = next.lng;
      this.lastX = x;
      this.lastY = y;
      this.updateMap(this.lastParams.courseId, this.lastParams.progress);
    };

    // 離した時の処理です
    const onEnd = () => {
      this.isPointerDown = false;
    };

    // スマホのタッチイベントを登録します
    box.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        const t = e.touches.item(0);
        if (t) {
          onStart(t.clientX, t.clientY);
        }
      }
    }, { passive: true });

    box.addEventListener('touchmove', (e) => {
      if (this.isPointerDown && e.touches.length === 1) {
        e.preventDefault();
        const t = e.touches.item(0);
        if (t) {
          onMove(t.clientX, t.clientY);
        }
      }
    }, { passive: false });

    box.addEventListener('touchend', onEnd);
    box.addEventListener('touchcancel', onEnd);

    // PCのマウスイベントを登録します
    box.addEventListener('mousedown', (e) => {
      onStart(e.clientX, e.clientY);
    });
    box.addEventListener('mousemove', (e) => {
      if (this.isPointerDown) {
        onMove(e.clientX, e.clientY);
      }
    });
    box.addEventListener('mouseup', onEnd);
    box.addEventListener('mouseleave', onEnd);
    // ボタンとピンのタップを判定します（divピンにも対応）
    box.addEventListener('click', (e) => {
      if (this.hasMoved) {
        this.hasMoved = false;
        return;
      }
      if (!(e.target instanceof Element)) {
        return;
      }
      // 通常のbutton要素またはピン用のdiv要素を取得します
      const btn = e.target.closest('button, div');
      if (!btn) {
        return;
      }
      // ミニカード内の「写真・ガイド」ボタンが押された時の処理です
      const guideId = btn.getAttribute('data-guide-id');
      if (guideId && this.lastParams && typeof GuideModal !== 'undefined') {
        GuideModal.open(this.lastParams.courseId, Number(guideId));
        return;
      }
      const action = btn.getAttribute('data-action');
      if (action) {
        this.controlAction(action);
        return;
      }
      const pid = btn.getAttribute('data-point-id');
      if (pid) {
        this.selectPoint(Number(pid));
      }
    });
  },

  // 地図全体を描画するメイン関数です
  updateMap: function(courseId, progress) {
    const box = document.getElementById('route-map');
    if (!box) {
      return;
    }
    this.setupEvents(box);

    try {
      this.lastParams = { courseId: courseId, progress: progress };
      if (this.lastCourseId !== courseId) {
        this.currentZoom = null;
        this.centerLat = null;
        this.centerLng = null;
        const lp = progress.latestPoint;
        this.selectedPointId = lp ? lp.id : null;
        this.lastCourseId = courseId;
      }

      const w = box.clientWidth || 320;
      const h = box.clientHeight || 300;
      const course = Reflect.get(MASTER_DATA, courseId) || MASTER_DATA.course1;
      const points = course.points;

      // 座標がある地点を抽出します
      const valid = new Array();
      for (let i = 0; i < points.length; i++) {
        const pt = points.at(i);
        if (pt && typeof pt.lat === 'number' && typeof pt.lng === 'number') {
          valid.push(pt);
        }
      }
      if (valid.length === 0) {
        box.innerHTML = '<p style="padding:20px;">座標データなし</p>';
        return;
      }

      // 初回または全体表示時に中心とズームを計算します
      if (this.currentZoom === null || this.centerLat === null) {
        let minLat = 90;
        let maxLat = -90;
        let minLng = 180;
        let maxLng = -180;
        for (let i = 0; i < valid.length; i++) {
          const p = valid.at(i);
          if (p.lat < minLat) minLat = p.lat;
          if (p.lat > maxLat) maxLat = p.lat;
          if (p.lng < minLng) minLng = p.lng;
          if (p.lng > maxLng) maxLng = p.lng;
        }
        this.centerLat = (minLat + maxLat) / 2;
        this.centerLng = (minLng + maxLng) / 2;

        let autoZ = 8;
        for (let z = 12; z >= 5; z--) {
          const tl = MapCalc.latLngToPixel(maxLat, minLng, z);
          const br = MapCalc.latLngToPixel(minLat, maxLng, z);
          if ((br.x - tl.x) < (w - 80) && (br.y - tl.y) < (h - 80)) {
            autoZ = z;
            break;
          }
        }
        this.currentZoom = autoZ;
      }

      // 画面左上のピクセル基準点を計算します
      const z = this.currentZoom;
      const cPx = MapCalc.latLngToPixel(this.centerLat, this.centerLng, z);
      const ox = cPx.x - w / 2;
      const oy = cPx.y - h / 2;

      // 各モジュールのHTMLを結合して表示します
      const tiles = MapHtml.buildTiles(z, ox, oy, w, h);
      const pins = MapHtml.buildPins(valid, z, ox, oy, w, h, progress, this.selectedPointId);
      const ctrls = MapHtml.buildControls();
      box.innerHTML = tiles + pins + ctrls;

    } catch (err) {
      const msg = (err instanceof Error) ? err.message : String(err);
      box.innerHTML = '<p style="padding:12px; color:#d93025;">エラー: ' + msg + '</p>';
    }
  }
};
// --- map.js ここまで --- 
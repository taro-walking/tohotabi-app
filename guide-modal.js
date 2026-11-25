// 地点クリック時に開く「写真＋観光ガイド（スマホ1画面ポップアップ）」モジュールです
const GuideModal = {
  // モーダル用のHTML要素が作成済みかどうかのフラグです
  isInitialized: false,

  // 【内部補助】ポップアップ用の外枠HTMLを初回だけ画面に追加する関数です
  _ensureModal: function() {
    if (this.isInitialized) {
      return;
    }
    this.isInitialized = true;

    // 背景を暗く覆うオーバーレイ要素を作成します
    const overlay = document.createElement('div');
    overlay.id = 'guide-modal-overlay';
    overlay.style.cssText = 'display:none; position:fixed; inset:0; ' +
      'background:rgba(0,0,0,0.68); z-index:9999; ' +
      'align-items:center; justify-content:center; padding:10px;';

    // スマホ1画面に収まる白いカード枠を作成します
    const card = document.createElement('div');
    card.id = 'guide-modal-card';
    card.style.cssText = 'width:100%; max-width:420px; max-height:94vh; ' +
      'background:#ffffff; border-radius:14px; overflow-y:auto; ' +
      'box-shadow:0 8px 24px rgba(0,0,0,0.35); padding:12px 14px; ' +
      'box-sizing:border-box; position:relative;';

    // カードの中身を入れる専用コンテナを追加します
    const body = document.createElement('div');
    body.id = 'guide-modal-body';
    card.appendChild(body);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    // 黒い背景部分をタップした時はポップアップを閉じます
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this.close();
      }
    });
  },

  // 【機能1】指定されたコースと地点IDの観光ガイドポップアップを開く関数です
  open: function(courseId, pointId) {
    this._ensureModal();

    // 対象コースと対象地点のデータを取得します
    const course = Reflect.get(MASTER_DATA, courseId) || MASTER_DATA.course1;
    const points = course.points || [];
    let targetPt = null;
    for (let i = 0; i < points.length; i++) {
      const p = points.at(i);
      if (p && p.id === pointId) {
        targetPt = p;
        break;
      }
    }
    if (!targetPt) {
      return;
    }

    // 現在の到達状況と到達日付を計算します
    const data = StorageManager.loadData();
    const cStats = StorageManager.getCourseStats(courseId, data);
    const progress = WalkLogic.evaluateProgress(
      courseId,
      cStats.totalSteps,
      data.strideCm,
      cStats.startKm
    );
    const reachedMap = WalkLogic.calcPointReachedDates(
      courseId,
      cStats.history,
      data.strideCm,
      cStats.startKm
    );

    // 到達済みか未到達かのステータスバッジを作ります
    const isPassed = progress.currentKm >= targetPt.km;
    const rawDate = Reflect.get(reachedMap, String(targetPt.id));
    let badgeHtml = '';
    if (isPassed) {
      const dateLabel = rawDate ? rawDate.replace(/-/g, '/') + ' 到達' : '到達済み';
      badgeHtml = '<span style="display:inline-block; background:#e6f4ea; ' +
        'color:#1e7e34; font-size:0.75rem; font-weight:bold; ' +
        'padding:2px 8px; border-radius:10px;">✅ ' + dateLabel + '</span>';
    } else {
      const diffKm = Math.round((targetPt.km - progress.currentKm) * 10) / 10;
      badgeHtml = '<span style="display:inline-block; background:#fff7ed; ' +
        'color:#c2410c; font-size:0.75rem; font-weight:bold; ' +
        'padding:2px 8px; border-radius:10px;">🚩 未到達（あと ' + diffKm + ' km）</span>';
    }

    // 写真リスト（guidePhotos配列、または従来のimg単体）を組み立てます
    const photoList = new Array();
    if (Array.isArray(targetPt.guidePhotos) && targetPt.guidePhotos.length > 0) {
      for (let i = 0; i < targetPt.guidePhotos.length; i++) {
        const item = targetPt.guidePhotos.at(i);
        if (item && item.file) {
          photoList.push(item);
        }
      }
    } else if (targetPt.img && targetPt.img.trim() !== '') {
      photoList.push({ file: targetPt.img.trim() });
    }

    // 写真エリアのHTMLを生成します（キャプション無しで上下にコンパクト表示）
    let photosHtml = '';
    if (photoList.length > 0) {
      for (let i = 0; i < photoList.length; i++) {
        const pItem = photoList.at(i);
        const imgPath = 'images/' + pItem.file;
        photosHtml += '<div class="guide-photo-box" data-file="' + pItem.file + '" ' +
          'style="margin:6px 0; border-radius:8px; overflow:hidden; ' +
          'background:#f8fafc; border:1px solid #cbd5e1;">' +
          '<img src="' + imgPath + '" alt="' + targetPt.name + '" ' +
          'style="width:100%; max-height:155px; object-fit:cover; display:block;">' +
          '</div>';
      }
    } else {
      photosHtml = '<div style="margin:8px 0; padding:18px 10px; ' +
        'border-radius:8px; background:#f8fafc; border:1px dashed #cbd5e1; ' +
        'text-align:center; color:#64748b; font-size:0.82rem;">' +
        '🖼️ 浮世絵・現在写真 準備中<br><span style="font-size:0.72rem;">' +
        '（imagesフォルダに画像を追加すると表示されます）</span></div>';
    }

    // 詳細な歴史・紀行コメント（10行以内に収まるスッキリ表示）を作ります
    const commentText = (targetPt.guideComment && targetPt.guideComment.trim() !== '')
      ? targetPt.guideComment.trim()
      : (targetPt.topic || '');

    let commentHtml = '';
    if (commentText !== '') {
      commentHtml = '<div style="margin-top:8px; background:#fffbeb; ' +
        'border-radius:8px; padding:9px 11px; border:1px solid #fde68a;">' +
        '<div style="font-weight:bold; color:#92400e; font-size:0.8rem; ' +
        'margin-bottom:3px;">📜 当時の面影と現在の状況</div>' +
        '<div style="font-size:0.84rem; color:#1f2937; line-height:1.48;">' +
        commentText + '</div></div>';
    }

    // ポップアップ全体のHTMLを流し込みます
    const bodyEl = document.getElementById('guide-modal-body');
    bodyEl.innerHTML =
      '<div style="display:flex; justify-content:space-between; align-items:center; gap:6px;">' +
      '<span style="font-size:0.78rem; color:#6b7280; font-weight:bold;">' +
      'スタートから ' + targetPt.km + ' km地点</span>' + badgeHtml + '</div>' +
      '<h2 style="margin:3px 0 4px 0; font-size:1.15rem; color:#111827;">' +
      targetPt.name + '</h2>' +
      photosHtml +
      commentHtml +
      '<button type="button" id="btn-close-guide-modal" ' +
      'style="width:100%; margin-top:10px; padding:10px; background:#2e6f40; ' +
      'color:#ffffff; border:none; border-radius:8px; font-size:0.95rem; ' +
      'font-weight:bold; cursor:pointer;">✕ 閉じる</button>';

    // 画像ファイルがまだ存在しない場合のエラー自動切替を登録します
    const boxes = bodyEl.querySelectorAll('.guide-photo-box');
    for (let i = 0; i < boxes.length; i++) {
      const box = boxes.item(i);
      const img = box.querySelector('img');
      const fName = box.getAttribute('data-file') || '';
      if (img) {
        img.onerror = function() {
          box.style.padding = '12px 8px';
          box.style.textAlign = 'center';
          box.innerHTML = '<div style="color:#64748b; font-size:0.8rem;">' +
            '🖼️ 画像準備中（images/' + fName + '）</div>';
        };
      }
    }

    // 「✕ 閉じる」ボタンに閉じる処理を登録します
    const closeBtn = document.getElementById('btn-close-guide-modal');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.close();
      });
    }

    // ポップアップを表示します
    const overlay = document.getElementById('guide-modal-overlay');
    if (overlay) {
      overlay.style.display = 'flex';
    }
  },

  // 【機能2】ポップアップを閉じる関数です
  close: function() {
    const overlay = document.getElementById('guide-modal-overlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
  }
};
// --- guide-modal.js ここまで ---
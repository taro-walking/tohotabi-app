// 全コース共通のデータ判定・自動補完を行う共通エンジンです
const CourseHelper = {

  // 【機能1】指定された地点が「道中イベント（関所・峠・絶景等）」か判定します
  isEvent: function(point) {
    // pointが存在し、kindプロパティが 'event' ならtrueを返します
    return Boolean(point && point.kind === 'event');
  },

  // 【機能2】指定されたコースの種別（tokaido / road / sightseeing）を取得します
  getCategory: function(course) {
    // コースデータにcategoryが指定されていれば小文字で返します
    if (course && typeof course.category === 'string') {
      const cat = course.category.trim().toLowerCase();
      if (cat === 'tokaido' || cat === 'sightseeing' || cat === 'road') {
        return cat;
      }
    }
    // 省略時やそれ以外は標準の道路路線（road）として扱います
    return 'road';
  },

  // 【機能3】指定された地点の写真ファイル名一覧（images/内）を自動生成します
  getPhotoFiles: function(point) {
    // 結果を入れる空の配列を用意します
    const files = new Array();
    if (!point) {
      return files;
    }

    // 1. 新形式（photo: "c2_01" の短縮指定）がある場合は _old と _now を自動生成します
    if (point.photo && point.photo.trim() !== '') {
      const base = point.photo.trim();
      files.push(base + '_old.jpg');
      files.push(base + '_now.jpg');
      return files;
    }

    // 2. 従来の guidePhotos 配列形式にも対応します（互換性維持）
    if (Array.isArray(point.guidePhotos) && point.guidePhotos.length > 0) {
      for (let i = 0; i < point.guidePhotos.length; i++) {
        const item = point.guidePhotos.at(i);
        if (item && item.file) {
          files.push(item.file);
        }
      }
      return files;
    }

    // 3. 単体画像（img）指定がある場合にも対応します
    if (point.img && point.img.trim() !== '') {
      files.push(point.img.trim());
    }
    return files;
  },

  // 【機能4】コース種別に応じたガイド窓の見出しラベルを返します
  getGuideTitles: function(course) {
    // コース種別を判定します
    const cat = this.getCategory(course);
    // ① 東海道五十三次モードの場合
    if (cat === 'tokaido') {
      return {
        mainTitle: '📜 当時の面影と現在の状況',
        extraTitle: '💡 歴史豆知識・今の街歩き'
      };
    }
    // ③ 観光地を徒歩巡りモードの場合
    if (cat === 'sightseeing') {
      return {
        mainTitle: '🗺️ 観光スポット案内',
        extraTitle: '💡 見どころ・散策ヒント'
      };
    }
    // ② その他の道路路線（標準）モードの場合
    return {
      mainTitle: '📍 この街の見どころ・話題',
      extraTitle: '💡 ご当地・道中メモ'
    };
  },

  // 【機能5】起動時に全コース（MASTER_DATA）の地点IDを1から順番に自動採番します
  normalizeAllCourses: function() {
    // MASTER_DATAが未定義なら何もしません
    if (typeof MASTER_DATA === 'undefined' || !MASTER_DATA) {
      return;
    }
    // 登録されている全コースIDを取り出します
    const courseIds = Object.keys(MASTER_DATA);
    for (let i = 0; i < courseIds.length; i++) {
      const cid = courseIds.at(i);
      const course = Reflect.get(MASTER_DATA, cid);
      if (!course || !Array.isArray(course.points)) {
        continue;
      }
      // 地点の並び順どおりに 1, 2, 3... と連番IDを自動セットします
      for (let j = 0; j < course.points.length; j++) {
        const pt = course.points.at(j);
        if (pt) {
          pt.id = j + 1;
        }
      }
    }
  }
};
// --- course-helper.js ここまで ---
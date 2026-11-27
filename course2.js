// コース2（東海道五十三次：日本橋〜京都・三条大橋）の4分割データを統合します
const COURSE_2_DATA = {
  // 画面に表示する2つ目のコースの名前です
  name: "② 東海道五十三次ルート（日本橋〜京都）",
  // 東海道五十三次の自動表示モードを指定します
  category: "tokaido",
  // 4分割された地点リスト（パート1〜パート4）を順番に1つに結合します
  points: [].concat(
    COURSE_2_PART1,
    COURSE_2_PART2,
    COURSE_2_PART3,
    COURSE_2_PART4
  )
// コース2の定義を閉じます
};
// --- course2.js ここまで ---
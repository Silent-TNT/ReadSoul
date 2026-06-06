/** 浏览器中打开微信读书：桌面走官网，移动端尝试唤起 App */
export function getWeReadOpenUrl(): string {
  if (typeof navigator === "undefined") return "https://weread.qq.com/";
  const ua = navigator.userAgent;
  const isMobile = /iPhone|iPad|iPod|Android/i.test(ua);
  if (isMobile) {
    return "https://weread.qq.com/";
  }
  return "https://weread.qq.com/web/shelf";
}

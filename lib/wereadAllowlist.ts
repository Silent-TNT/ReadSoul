/** 微信读书网关 api_name 白名单（与 lib/weread.ts 保持一致） */
export const WEREAD_API_ALLOWLIST = new Set([
  "/readdata/detail",
  "/shelf/sync",
  "/book/bookmarklist",
  "/review/list/mine",
  "/user/notebooks",
]);

export function isAllowedWereadApi(apiName: string): boolean {
  return WEREAD_API_ALLOWLIST.has(apiName);
}

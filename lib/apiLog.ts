/** 结构化 API 错误日志（部署平台 stdout 可检索） */
export function logApiError(
  route: string,
  status: number,
  message: string,
  extra?: Record<string, unknown>
) {
  console.error(
    JSON.stringify({
      level: "error",
      route,
      status,
      message,
      ts: new Date().toISOString(),
      ...extra,
    })
  );
}

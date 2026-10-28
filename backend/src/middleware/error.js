// 包裹 async 控制器，把 reject 转给 error 中间件
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// 统一错误出口：业务 Error 带 statusCode 则透传，否则 500
export function errorHandler(err, req, res, _next) {
  const status = err.statusCode || 500;
  if (status >= 500) console.error('[error]', err);
  res.status(status).json({ error: err.message || '服务器内部错误' });
}

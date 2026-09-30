export function notFound(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `Rota não encontrada: ${req.method} ${req.path}` } });
}

export function errorHandler(error, _req, res, _next) {
  console.error(error);
  const status = error.statusCode || 500;
  res.status(status).json({
    error: {
      code: status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR',
      message: status >= 500 ? 'Erro interno do servidor.' : error.message
    }
  });
}

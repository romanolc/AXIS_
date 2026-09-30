export function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const error = new Error('Dados inválidos.');
      error.statusCode = 400;
      error.details = result.error.flatten();
      return next(error);
    }
    req[source] = result.data;
    next();
  };
}

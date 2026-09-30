export const round = (value, digits = 1) => Number(Number(value).toFixed(digits));
export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const nowIso = () => new Date().toISOString();

export function sendData(res, data, status = 200) {
  return res.status(status).json({ data });
}

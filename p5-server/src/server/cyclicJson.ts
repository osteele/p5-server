import express from 'express';

export function cyclicJsonBodyMiddleware() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const textware = express.text({ type: 'application/json' });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (req: any, _res: any, next: any) =>
    textware(req, _res, _req => {
      req.body = parseCyclicJson(req.body);
      next();
    });
}

const hasOwnProperty = Object.prototype.hasOwnProperty;
const scopeKey = '$__p5_server:circular';
const defKey = '$__p5_server:def';
const refKey = '$__p5_server:ref';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseCyclicJson(json: string) {
  const value = JSON.parse(json);
  if (!(typeof value === 'object' && hasOwnProperty.call(value, scopeKey))) return value;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const defs: any[] = [];
  return resolve(value[scopeKey]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function resolve(value: any) {
    if (value && typeof value === 'object') {
      if (hasOwnProperty.call(value, defKey)) {
        value = value[defKey];
        defs.push(value);
      } else if (hasOwnProperty.call(value, refKey)) {
        return defs[value[refKey]];
      }
      for (const key in value) {
        value[key] = resolve(value[key]);
      }
    } else if (Array.isArray(value)) {
      for (const i in value) {
        value[i] = resolve(value[i]);
      }
    }
    return value;
  }
}

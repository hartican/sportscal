import { measurementReload } from '../../../lib/measurement-reload.mjs';

export function GET(request: Request) {
  return measurementReload(request);
}

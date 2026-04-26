import { db } from './db';

const API_URL = 'https://api.kasirgratisan.my.id/webhook/kasir-gratisan/latest-version';
const TIMEOUT_MS = 5000;

export async function checkVersion(): Promise<void> {
  // Disabled legacy ping to avoid sending data to third-party servers
  // We will replace this with Google Analytics if requested.
  return;
}

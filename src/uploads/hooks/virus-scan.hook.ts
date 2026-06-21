export interface VirusScanHook {
  scan(buffer: Buffer): Promise<void>;
}

export class NoOpVirusScanHook implements VirusScanHook {
  async scan(_buffer: Buffer): Promise<void> {
    // No-op stub — replace with a real AV engine in production
  }
}

// Telemetria local para balanceamento (tempo até 1ª ferramenta, mortes por hora) — item 022 P2.
export class LocalTelemetryTracker {
  private startTime = Date.now();
  private firstToolTime: number | null = null;
  private deathsCount = 0;

  public recordFirstToolCrafted(): void {
    if (this.firstToolTime === null) {
      this.firstToolTime = (Date.now() - this.startTime) / 1000;
    }
  }

  public recordDeath(): void {
    this.deathsCount++;
  }

  public getTimeToFirstToolSeconds(): number | null {
    return this.firstToolTime;
  }

  public getDeathsPerHour(): number {
    const elapsedHours = Math.max(0.001, (Date.now() - this.startTime) / (1000 * 3600));
    return this.deathsCount / elapsedHours;
  }
}

export const noisePhase = {
  value: 0,
  active: false,
};

export function setSharedNoisePhase(value: number) {
  noisePhase.value = Math.min(1, Math.max(0, value));
  noisePhase.active = true;
}

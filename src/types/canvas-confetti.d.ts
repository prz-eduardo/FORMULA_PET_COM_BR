declare module 'canvas-confetti' {
  type ConfettiOptions = {
    particleCount?: number;
    spread?: number;
    origin?: { x?: number; y?: number };
    ticks?: number;
  };
  const confetti: (opts?: ConfettiOptions) => void;
  export default confetti;
}

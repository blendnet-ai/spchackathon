import { Player } from "@/components/audio/player";
import { useRef } from "react";

const SAMPLE_RATE = 24000;

type AudioPlayerParams = {
  onLastBufferComplete?: () => void;
};

export default function useAudioPlayer({
  onLastBufferComplete,
}: AudioPlayerParams = {}) {
  const audioPlayer = useRef<Player>();
  const playbackTimeoutRef = useRef<NodeJS.Timeout>();
  const queuedDurationRef = useRef(0);
  const lastPlayTimeRef = useRef(Date.now());

  const reset = () => {
    console.log("reset");
    audioPlayer.current = new Player();
    audioPlayer.current.init(SAMPLE_RATE);
    if (playbackTimeoutRef.current) {
      clearTimeout(playbackTimeoutRef.current);
    }
    queuedDurationRef.current = 0;
    lastPlayTimeRef.current = Date.now();
  };

  const play = (
    base64Audio: string,
    isLastBuffer: boolean = false,
    updateDurationOnly: boolean = false
  ) => {
    console.log("play", base64Audio);
    if (!base64Audio) return;
    const cleanedString = base64Audio.replace(/\s/g, "");
    const binary = atob(cleanedString);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const pcmData = new Int16Array(bytes.buffer);

    const now = Date.now();
    const timeSinceLastPlay = now - lastPlayTimeRef.current;
    queuedDurationRef.current = Math.max(
      0,
      queuedDurationRef.current - timeSinceLastPlay
    );

    const bufferDurationMs = (pcmData.length / SAMPLE_RATE) * 1000;
    queuedDurationRef.current += bufferDurationMs;
    lastPlayTimeRef.current = now;

    if (!updateDurationOnly) {
      console.log("play pcmData");

      audioPlayer.current?.play(pcmData);
    }

    // If this is the last buffer, set up a timeout for when all queued audio finishes
    if (isLastBuffer) {
      if (playbackTimeoutRef.current) {
        clearTimeout(playbackTimeoutRef.current);
      }

      playbackTimeoutRef.current = setTimeout(() => {
        onLastBufferComplete?.();
      }, queuedDurationRef.current);
    }
    console.log("queuedDurationRef.current", queuedDurationRef.current);
  };

  const stop = () => {
    audioPlayer.current?.stop();
    if (playbackTimeoutRef.current) {
      clearTimeout(playbackTimeoutRef.current);
    }
    queuedDurationRef.current = 0;
    lastPlayTimeRef.current = Date.now();
  };

  return { reset, play, stop };
}

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DeviceLiveSnapshot, SerialBridgeStatus } from '../types';
import {
  applyPmvEvent,
  createInitialLiveSnapshot,
  extractPmvJsonLines,
} from '../utils/parsePmvTelemetry';

const BAUD_RATE = 115200;
const MAX_LOG_LINES = 40;

type SerialPortLike = {
  readable: ReadableStream<Uint8Array> | null;
  open: (opts: { baudRate: number }) => Promise<void>;
  close: () => Promise<void>;
};

type SerialLike = {
  requestPort: () => Promise<SerialPortLike>;
};

function getNavigatorSerial(): SerialLike | undefined {
  return (navigator as Navigator & { serial?: SerialLike }).serial;
}

export function useDeviceSerialBridge() {
  const [status, setStatus] = useState<SerialBridgeStatus>('disconnected');
  const [liveState, setLiveState] = useState<DeviceLiveSnapshot | null>(null);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const portRef = useRef<SerialPortLike | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const abortRef = useRef(false);
  const bufferRef = useRef('');

  const appendLog = useCallback((line: string) => {
    setLogLines((prev) => [...prev.slice(-(MAX_LOG_LINES - 1)), line]);
  }, []);

  const pushEvents = useCallback((raw: string) => {
    const { events, rest } = extractPmvJsonLines(bufferRef.current + raw);
    bufferRef.current = rest;
    if (!events.length) return;
    setLiveState((prev) => {
      const base = prev ?? createInitialLiveSnapshot();
      return events.reduce(applyPmvEvent, base);
    });
  }, []);

  const readLoop = useCallback(
    async (port: SerialPortLike) => {
      if (!port.readable) return;
      const reader = port.readable.getReader();
      readerRef.current = reader;
      const decoder = new TextDecoder();

      try {
        while (!abortRef.current) {
          const { value, done } = await reader.read();
          if (done) break;
          if (!value?.length) continue;
          const chunk = decoder.decode(value, { stream: true });
          appendLog(chunk.replace(/\r/g, '').trimEnd());
          pushEvents(chunk);
        }
      } catch (err) {
        if (!abortRef.current) {
          const msg = err instanceof Error ? err.message : 'Serial read failed';
          setError(msg);
          setStatus('disconnected');
        }
      } finally {
        try {
          reader.releaseLock();
        } catch {
          // already released
        }
        readerRef.current = null;
      }
    },
    [appendLog, pushEvents],
  );

  const disconnect = useCallback(async () => {
    abortRef.current = true;
    bufferRef.current = '';

    try {
      if (readerRef.current) {
        await readerRef.current.cancel();
      }
    } catch {
      // ignore
    }

    try {
      if (portRef.current) {
        await portRef.current.close();
      }
    } catch {
      // ignore
    }

    portRef.current = null;
    readerRef.current = null;
    setStatus('disconnected');
    setLiveState(null);
  }, []);

  const connect = useCallback(async () => {
    const serial = getNavigatorSerial();
    if (!serial) {
      setError('เบราว์เซอร์ไม่รองรับ Web Serial (ใช้ Chrome/Edge บน localhost)');
      return;
    }

    setError(null);
    setStatus('connecting');

    try {
      await disconnect();
      abortRef.current = false;

      const port = await serial.requestPort();
      await port.open({ baudRate: BAUD_RATE });
      portRef.current = port;
      setLiveState(createInitialLiveSnapshot());
      setStatus('live');
      appendLog('[serial] connected @ 115200');
      void readLoop(port);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'เชื่อมต่อไม่สำเร็จ';
      if (!msg.toLowerCase().includes('cancel')) {
        setError(msg);
      }
      setStatus('disconnected');
      setLiveState(null);
    }
  }, [appendLog, disconnect, readLoop]);

  useEffect(() => {
    return () => {
      void disconnect();
    };
  }, [disconnect]);

  const isLive = status === 'live';

  return {
    status,
    isLive,
    liveState,
    logLines,
    error,
    connect,
    disconnect,
    serialSupported: typeof getNavigatorSerial() !== 'undefined',
  };
}

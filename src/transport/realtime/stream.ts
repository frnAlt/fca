"use strict";
/**
 * Builds a duplex stream over WebSocket for MQTT: proxy for writes, PassThrough for reads.
 * Handles ping/pong, liveness timeout, and clean shutdown.
 */
import Duplexify from "duplexify";
import { PassThrough, Writable } from "stream";

interface DuplexStream extends NodeJS.ReadWriteStream {
  setWritable: (stream: NodeJS.WritableStream) => void;
  setReadable: (stream: NodeJS.ReadableStream) => void;
  emit: (event: string, ...args: Loose[]) => boolean;
  on: (event: string, listener: (...args: Loose[]) => void) => this;
  end: () => this;
  destroy: (error?: Error) => this;
  destroyed?: boolean;
}

type DuplexifyCtor = new (
  writable?: NodeJS.WritableStream,
  readable?: NodeJS.ReadableStream,
  options?: Record<string, Loose>
) => DuplexStream;

const DuplexifyCtor = Duplexify as unknown as DuplexifyCtor;

interface NodeSocketLike {
  readyState: number;
  send: (data: Buffer | string, cb?: (error?: Error | null) => void) => void;
  close: () => void;
  terminate?: () => void;
  ping?: () => void;
  on?: (event: string, listener: (...args: Loose[]) => void) => void;
  off?: (event: string, listener: (...args: Loose[]) => void) => void;
  addEventListener?: (event: string, listener: (...args: Loose[]) => void) => void;
  removeEventListener?: (event: string, listener: (...args: Loose[]) => void) => void;
  onopen?: ((...args: Loose[]) => void) | null;
  onmessage?: ((...args: Loose[]) => void) | null;
  onerror?: ((...args: Loose[]) => void) | null;
  onclose?: ((...args: Loose[]) => void) | null;
}

interface ProxyWritable extends Writable {
  setTarget: (socket: NodeSocketLike | null) => void;
  hardEnd: () => void;
}

const PING_INTERVAL_MS = 30000;
const LIVENESS_CHECK_MS = 10000;
const LIVENESS_MAX_IDLE_MS = 65000;

function buildProxy(): ProxyWritable {
  let target: NodeSocketLike | null = null;
  let ended = false;

  const proxy = new Writable({
    autoDestroy: true,
    write(chunk, _enc, callback) {
      if (ended || this.destroyed) return callback();
      const socket = target;
      if (socket && socket.readyState === 1) {
        try {
          socket.send(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk), callback);
        } catch (error) {
          callback(error as Error);
        }
      } else {
        callback();
      }
    },
    writev(chunks, callback) {
      if (ended || this.destroyed) return callback();
      const socket = target;
      if (!socket || socket.readyState !== 1) return callback();
      try {
        for (const item of chunks) {
          socket.send(Buffer.isBuffer(item.chunk) ? item.chunk : Buffer.from(item.chunk));
        }
        callback();
      } catch (error) {
        callback(error as Error);
      }
    },
    final(callback) {
      ended = true;
      const socket = target;
      target = null;
      if (socket && (socket.readyState === 0 || socket.readyState === 1)) {
        try {
          if (typeof socket.terminate === "function") socket.terminate();
          else socket.close();
        } catch { }
      }
      callback();
    }
  }) as ProxyWritable;

  proxy.setTarget = (socket: NodeSocketLike | null) => {
    if (ended) return;
    target = socket;
  };

  proxy.hardEnd = () => {
    ended = true;
    target = null;
  };

  return proxy;
}

function buildStream(
  options: Record<string, Loose>,
  webSocket: NodeSocketLike,
  proxy: ProxyWritable
): DuplexStream {
  const readable = new PassThrough();
  const stream = new DuplexifyCtor(undefined, undefined, {
    end: false,
    autoDestroy: true,
    ...(options || {})
  });
  const noopWritable = new Writable({ write(_chunk, _enc, callback) { callback(); } });

  let socket: NodeSocketLike | null = webSocket;
  let pingTimer: NodeJS.Timeout | null = null;
  let livenessTimer: NodeJS.Timeout | null = null;
  let lastActivity = Date.now();
  let attached = false;
  let style: "node" | "dom" | "prop" = "prop";
  let closed = false;

  const toBuffer = (data: Loose): Buffer => {
    if (Buffer.isBuffer(data)) return data;
    if (data instanceof ArrayBuffer) return Buffer.from(data);
    if (ArrayBuffer.isView(data)) {
      return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
    }
    return Buffer.from(String(data));
  };

  const swapToNoopWritable = () => {
    try {
      stream.setWritable(noopWritable);
    } catch { }
  };

  const onOpen = () => {
    if (closed || !socket) return;
    proxy.setTarget(socket);
    stream.setWritable(proxy);
    stream.setReadable(readable);
    stream.emit("connect");
    lastActivity = Date.now();

    if (pingTimer) clearInterval(pingTimer);
    if (livenessTimer) clearInterval(livenessTimer);

    pingTimer = setInterval(() => {
      if (!socket || socket.readyState !== 1) return;
      if (typeof socket.ping === "function") {
        try { socket.ping(); } catch { }
      } else {
        try { socket.send("ping"); } catch { }
      }
    }, PING_INTERVAL_MS);

    livenessTimer = setInterval(() => {
      if (!socket || socket.readyState !== 1) return;
      if (Date.now() - lastActivity > LIVENESS_MAX_IDLE_MS) {
        try {
          if (typeof socket.terminate === "function") socket.terminate();
          else socket.close();
        } catch { }
      }
    }, LIVENESS_CHECK_MS);
  };

  const onMessage = (data: Loose) => {
    lastActivity = Date.now();
    const payload =
      style === "dom" &&
        typeof data === "object" &&
        data !== null &&
        "data" in (data as Record<string, Loose>)
        ? (data as Record<string, Loose>).data
        : data;
    readable.write(toBuffer(payload));
  };

  const onPong = () => {
    lastActivity = Date.now();
  };

  const detach = (ws: NodeSocketLike | null) => {
    if (!attached || !ws) return;
    attached = false;

    if (style === "node" && typeof ws.off === "function") {
      ws.off("open", onOpen);
      ws.off("message", onMessage);
      ws.off("error", onError);
      ws.off("close", onClose);
      ws.off("pong", onPong);
      return;
    }

    if (style === "dom" && typeof ws.removeEventListener === "function") {
      ws.removeEventListener("open", onOpen);
      ws.removeEventListener("message", onMessage);
      ws.removeEventListener("error", onError);
      ws.removeEventListener("close", onClose);
      return;
    }

    ws.onopen = null;
    ws.onmessage = null;
    ws.onerror = null;
    ws.onclose = null;
  };

  const cleanup = () => {
    if (closed) return;
    closed = true;

    if (pingTimer) clearInterval(pingTimer);
    if (livenessTimer) clearInterval(livenessTimer);
    pingTimer = null;
    livenessTimer = null;

    proxy.hardEnd();
    swapToNoopWritable();

    if (socket) {
      detach(socket);
      try {
        if (socket.readyState === 1) {
          if (typeof socket.terminate === "function") socket.terminate();
          else socket.close();
        }
      } catch { }
      socket = null;
    }

    readable.end();
  };

  const onError = (error: Loose) => {
    cleanup();
    stream.destroy(error instanceof Error ? error : new Error(String(error)));
  };

  const onClose = () => {
    cleanup();
    stream.end();
    if (!stream.destroyed) stream.destroy();
  };

  const attach = (ws: NodeSocketLike | null) => {
    if (attached || !ws) return;
    attached = true;

    if (typeof ws.on === "function" && typeof ws.off === "function") {
      style = "node";
      ws.on("open", onOpen);
      ws.on("message", onMessage);
      ws.on("error", onError);
      ws.on("close", onClose);
      ws.on("pong", onPong);
      return;
    }

    if (typeof ws.addEventListener === "function" && typeof ws.removeEventListener === "function") {
      style = "dom";
      ws.addEventListener("open", onOpen);
      ws.addEventListener("message", onMessage);
      ws.addEventListener("error", onError);
      ws.addEventListener("close", onClose);
      return;
    }

    style = "prop";
    ws.onopen = onOpen;
    ws.onmessage = onMessage;
    ws.onerror = onError;
    ws.onclose = onClose;
  };

  attach(socket);
  if (socket && socket.readyState === 1) onOpen();

  stream.on("prefinish", swapToNoopWritable);
  stream.on("finish", cleanup);
  stream.on("close", cleanup);
  proxy.on("close", swapToNoopWritable);

  return stream;
}

export = {
  buildProxy,
  buildStream
};


// In-memory live streaming state management (zero persistence to database)
// When stream ends, all comments, viewers, signals, and session state are purged immediately from memory.

export interface LiveStreamComment {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  message: string;
  timestamp: number;
}

export interface LivePinnedProduct {
  id?: string;
  title: string;
  price: string;
  dimensions?: string;
  photoUrl?: string;
  description?: string;
}

export interface LiveStreamSession {
  id: string;
  hostId: string;
  hostName: string;
  hostAvatar: string;
  title: string;
  pinnedProduct?: LivePinnedProduct | null;
  startedAt: number;
  comments: LiveStreamComment[];
  // Viewers currently connected (userId -> metadata)
  viewers: Map<string, { id: string; name: string; avatar: string; joinedAt: number }>;
}

// Active streams kept only in volatile RAM
const activeStreams = new Map<string, LiveStreamSession>();

export function getActiveStreamsSummary() {
  const list: any[] = [];
  activeStreams.forEach((stream) => {
    list.push({
      id: stream.id,
      hostId: stream.hostId,
      hostName: stream.hostName,
      hostAvatar: stream.hostAvatar,
      title: stream.title,
      pinnedProduct: stream.pinnedProduct,
      startedAt: stream.startedAt,
      viewerCount: stream.viewers.size,
    });
  });
  return list;
}

export function getStreamSession(streamId: string): LiveStreamSession | undefined {
  return activeStreams.get(streamId);
}

export function createStreamSession(params: {
  id: string;
  hostId: string;
  hostName: string;
  hostAvatar: string;
  title: string;
  pinnedProduct?: LivePinnedProduct | null;
}): LiveStreamSession {
  // End any existing stream by this host first to ensure clean state
  for (const [id, s] of activeStreams.entries()) {
    if (s.hostId === params.hostId) {
      activeStreams.delete(id);
    }
  }

  const session: LiveStreamSession = {
    id: params.id,
    hostId: params.hostId,
    hostName: params.hostName,
    hostAvatar: params.hostAvatar,
    title: params.title || "Live Jual Beli Batu Mulia",
    pinnedProduct: params.pinnedProduct || null,
    startedAt: Date.now(),
    comments: [],
    viewers: new Map(),
  };

  activeStreams.set(session.id, session);
  return session;
}

export function endStreamSession(streamId: string): boolean {
  if (activeStreams.has(streamId)) {
    // Explicitly clear all maps and arrays to guarantee zero persistence & garbage collection
    const stream = activeStreams.get(streamId);
    if (stream) {
      stream.comments.length = 0;
      stream.viewers.clear();
      stream.pinnedProduct = null;
    }
    activeStreams.delete(streamId);
    return true;
  }
  return false;
}

export function addCommentToStream(
  streamId: string,
  comment: Omit<LiveStreamComment, "id" | "timestamp">
): LiveStreamComment | null {
  const stream = activeStreams.get(streamId);
  if (!stream) return null;

  const newComment: LiveStreamComment = {
    id: `lc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    senderId: comment.senderId,
    senderName: comment.senderName,
    senderAvatar: comment.senderAvatar,
    message: comment.message,
    timestamp: Date.now(),
  };

  // Keep max 100 recent live comments in memory buffer
  stream.comments.push(newComment);
  if (stream.comments.length > 100) {
    stream.comments.shift();
  }

  return newComment;
}

export function updatePinnedProduct(streamId: string, product: LivePinnedProduct | null): boolean {
  const stream = activeStreams.get(streamId);
  if (!stream) return false;
  stream.pinnedProduct = product;
  return true;
}

export function addViewerToStream(
  streamId: string,
  viewer: { id: string; name: string; avatar: string }
): number {
  const stream = activeStreams.get(streamId);
  if (!stream) return 0;
  stream.viewers.set(viewer.id, {
    ...viewer,
    joinedAt: Date.now(),
  });
  return stream.viewers.size;
}

export function removeViewerFromStream(streamId: string, viewerId: string): number {
  const stream = activeStreams.get(streamId);
  if (!stream) return 0;
  stream.viewers.delete(viewerId);
  return stream.viewers.size;
}

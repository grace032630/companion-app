export type RoomDeepLinkTarget =
  | { pathname: '/room' }
  | { pathname: '/room'; params: { roomId: string } };

type LinkParam = string | string[] | undefined;

function firstValue(value: LinkParam): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function createRoomReturnTo(roomId: LinkParam): string {
  const value = firstValue(roomId)?.trim();
  return value ? `/room?roomId=${encodeURIComponent(value)}` : '/room';
}

export function parseRoomReturnTo(value: LinkParam): RoomDeepLinkTarget | null {
  const returnTo = firstValue(value);
  if (!returnTo) return null;

  try {
    const baseUrl = 'https://companion.invalid';
    const url = new URL(returnTo, baseUrl);
    if (url.origin !== baseUrl || url.pathname !== '/room') return null;

    const roomId = url.searchParams.get('roomId')?.trim();
    return roomId ? { pathname: '/room', params: { roomId } } : { pathname: '/room' };
  } catch {
    return null;
  }
}

export function serializeRoomTarget(target: RoomDeepLinkTarget): string {
  return 'params' in target ? createRoomReturnTo(target.params.roomId) : '/room';
}

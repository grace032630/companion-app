import { supabase } from './supabase';

type LineKnockNotificationResponse = {
  requestId?: string;
};

/**
 * Requests a LINE knock notification from the authenticated server boundary.
 *
 * TODO: Deploy the `line-knock-notification` Supabase Edge Function. It must
 * authorize the caller, resolve the target user's server-side LINE identity,
 * and send through the Messaging API using Supabase project secrets.
 */
export async function requestLineKnockNotification(targetUserId: string, roomId: string) {
  if (!targetUserId || !roomId) {
    throw new Error('targetUserId and roomId are required');
  }

  const { data, error } = await supabase.functions.invoke<LineKnockNotificationResponse>(
    'line-knock-notification',
    { body: { targetUserId, roomId } },
  );

  if (error) throw error;
  return data;
}


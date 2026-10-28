import { createClient } from '@supabase/supabase-js';

// এখানে আপনার আসল URL এবং কপি করা Anon Key সরাসরি বসিয়ে দেওয়া হয়েছে
const supabaseUrl = "https://supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF4ZXd4ZXBpYXZ3d2lmaHFicHRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMxMzM4NzUsImV4cCI6MjEwODcwOTg3NX0.M5qZuuB7xMc0BE2LofXCCldMTqrXdzFqPEg3iKVc0NA";

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);

export const functionsUrl = `${supabaseUrl}/functions/v1`;

export async function callFunction<T>(name: string, body: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? supabaseAnonKey;
  const res = await fetch(`${functionsUrl}/${name}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: supabaseAnonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json || (typeof json === 'object' && 'error' in json)) {
    throw new Error(json?.error ?? 'Something went wrong. Please try again.');
  }
  return json as T;
}

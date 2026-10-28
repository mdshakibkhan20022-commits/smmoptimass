import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Category, Provider, Service, ServiceSource } from '@/lib/types';

export type AdminCatalog = {
  categories: Category[];
  services: Service[];
  sources: Record<number, ServiceSource>;
  providers: Provider[];
};

async function fetchAll<T>(table: string, order: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select('*').order(order).range(from, from + 999);
    if (error) throw error;
    out.push(...((data as T[]) ?? []));
    if (!data || data.length < 1000) return out;
  }
}

export function useAdminCatalog() {
  const [data, setData] = useState<AdminCatalog | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [categories, services, sources, providers] = await Promise.all([
        fetchAll<Category>('categories', 'sort_order'),
        fetchAll<Service>('services', 'id'),
        fetchAll<ServiceSource>('service_sources', 'service_id'),
        fetchAll<Provider>('providers', 'name'),
      ]);
      setData({ categories, services, providers, sources: Object.fromEntries(sources.map((s) => [s.service_id, s])) });
      setError(null);
    } catch (e) {
      console.error(e);
      setError('Could not load services.');
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, error, reload };
}

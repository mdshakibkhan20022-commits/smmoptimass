import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Category, Service } from '@/lib/types';

export function useCatalog() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [c, s] = await Promise.all([
      supabase.from('categories').select('*').eq('active', true).order('sort_order').order('name'),
      supabase.from('services').select('*').eq('active', true).order('sort_order').order('id'),
    ]);
    if (c.error || s.error) {
      console.error(c.error ?? s.error);
      setError('Could not load services. Please refresh the page.');
    } else {
      const cats = c.data as Category[];
      const ids = new Set(cats.map((x) => x.id));
      setCategories(cats);
      setServices((s.data as Service[]).filter((x) => ids.has(x.category_id)));
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { categories, services, loading, error, reload: load };
}

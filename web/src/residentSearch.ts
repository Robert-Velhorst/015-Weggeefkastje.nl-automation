import { PRODUCT_CATEGORIES } from '../../src/categories';

export { PRODUCT_CATEGORIES };
export const PROVINCES = ['Drenthe', 'Flevoland', 'Fryslân', 'Gelderland', 'Groningen', 'Limburg', 'Noord-Brabant', 'Noord-Holland', 'Overijssel', 'Utrecht', 'Zeeland', 'Zuid-Holland'];
export interface SearchState { query: string; category: string[]; province: string; sort: 'address' | 'recent'; page: number; view: 'list' | 'map' }

export function readSearchState(): SearchState {
  const params = new URLSearchParams(window.location.search);
  const page = Number(params.get('page') ?? 1);
  return {
    query: (params.get('query') ?? '').slice(0, 240),
    category: [...new Set(params.getAll('category').filter((value) => value === 'unknown' || PRODUCT_CATEGORIES.includes(value as typeof PRODUCT_CATEGORIES[number])))],
    province: PROVINCES.includes(params.get('province') ?? '') ? params.get('province')! : '',
    sort: params.get('sort') === 'recent' ? 'recent' : 'address',
    page: Number.isInteger(page) && page > 0 && page <= 100000 ? page : 1,
    view: params.get('view') === 'map' ? 'map' : 'list',
  };
}

export function searchParams(state: SearchState, paging = false): URLSearchParams {
  const params = new URLSearchParams();
  if (state.query.trim()) params.set('query', state.query.trim());
  state.category.forEach((category) => params.append('category', category));
  if (state.province) params.set('province', state.province);
  if (state.sort === 'recent') params.set('sort', state.sort);
  if (paging) { params.set('page', String(state.page)); params.set('limit', '12'); }
  return params;
}

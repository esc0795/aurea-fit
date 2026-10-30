import PocketBase, { type RecordModel } from 'pocketbase';
import { mockCategories, mockProducts } from '../data/mockData';

export interface Category extends RecordModel {
  name: string;
  slug: string;
}

export type SizesStock = Record<string, number | string>;

export interface Product extends RecordModel {
  name: string;
  slug: string;
  price: number;
  description: string;
  sizes_stock: SizesStock;
  images: string[];
  active: boolean;
  category: string;
  expand?: {
    category?: Category;
    [key: string]: unknown;
  };
}

/**
 * Determine whether to operate in Mock Mode:
 * 1. If PUBLIC_USE_MOCK is explicitly 'true'
 * 2. If PUBLIC_POCKETBASE_URL is not set or empty
 */
export const isMockMode =
  import.meta.env.PUBLIC_USE_MOCK === 'true' ||
  !import.meta.env.PUBLIC_POCKETBASE_URL ||
  import.meta.env.PUBLIC_POCKETBASE_URL.trim() === '';

const pocketbaseUrl = import.meta.env.PUBLIC_POCKETBASE_URL || 'http://127.0.0.1:8090';

export const pb = new PocketBase(pocketbaseUrl);
pb.autoCancellation(false);

/**
 * Generates the public URL for a product image.
 * In Mock Mode, resolves to local static assets in `/images/products/${fileName}`.
 * In Live Mode, resolves to the PocketBase files endpoint.
 */
export function getFileUrl(
  collectionId: string,
  recordId: string,
  fileName: string,
  thumb?: string
): string {
  if (!fileName) return '';

  if (isMockMode) {
    const siteBase = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');
    return `${siteBase}/images/products/${encodeURIComponent(fileName)}`;
  }

  const baseUrl = pb.baseUrl.replace(/\/+$/, '');
  const url = `${baseUrl}/api/files/${encodeURIComponent(collectionId)}/${encodeURIComponent(recordId)}/${encodeURIComponent(fileName)}`;
  return thumb ? `${url}?thumb=${encodeURIComponent(thumb)}` : url;
}

// -----------------------------------------------------------------------------
// Unified Data Provider (Abstracts PocketBase vs Mock Store)
// -----------------------------------------------------------------------------

export interface ProductsQueryOptions {
  categoryId?: string;
  categorySlug?: string;
  onlyActive?: boolean;
}

/**
 * Normalizes category names/slugs into URL-friendly standard slugs.
 * Ensures 'Bras & crops' maps cleanly to 'bras', avoiding 404 URL encode mismatches.
 */
export function slugifyCategory(nameOrSlug: string): string {
  if (!nameOrSlug) return '';
  const lower = nameOrSlug.toLowerCase().trim();
  if (lower.includes('bra')) return 'bras';
  if (lower.includes('legging')) return 'leggings';
  if (lower.includes('short')) return 'shorts';
  if (lower.includes('accesorio')) return 'accesorios';
  return lower.replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export const dataProvider = {
  /**
   * Fetches all categories sorted by name with normalized URL slugs
   */
  async getCategories(): Promise<Category[]> {
    if (isMockMode) {
      return [...mockCategories]
        .map((cat) => ({ ...cat, slug: slugifyCategory(cat.slug || cat.name) }))
        .sort((a, b) => a.name.localeCompare(b.name));
    }

    try {
      const records = await pb.collection('categories').getFullList<Category>({ sort: 'name' });
      return records.map((cat) => ({
        ...cat,
        slug: slugifyCategory(cat.slug || cat.name),
      }));
    } catch (err) {
      console.warn('⚠️ [PocketBase Provider] Error fetching categories, falling back to mock:', err);
      return [...mockCategories]
        .map((cat) => ({ ...cat, slug: slugifyCategory(cat.slug || cat.name) }))
        .sort((a, b) => a.name.localeCompare(b.name));
    }
  },

  /**
   * Fetches products with optional category and active filtering
   */
  async getProducts(options: ProductsQueryOptions = { onlyActive: true }): Promise<Product[]> {
    if (isMockMode) {
      return mockProducts.filter((p) => {
        if (options.onlyActive && !p.active) return false;
        if (options.categoryId && p.category !== options.categoryId) return false;
        if (options.categorySlug) {
          const cat = mockCategories.find((c) => c.slug.toLowerCase() === options.categorySlug?.toLowerCase());
          if (cat && p.category !== cat.id) return false;
        }
        return true;
      });
    }

    try {
      const filters: string[] = [];
      if (options.onlyActive) filters.push('active = true');
      if (options.categoryId) filters.push(`category = "${options.categoryId}"`);

      const filterStr = filters.join(' && ');

      try {
        return await pb.collection('products').getFullList<Product>({
          filter: filterStr || undefined,
          sort: '-created',
          expand: 'category',
        });
      } catch {
        return await pb.collection('products').getFullList<Product>({
          filter: filterStr || undefined,
          sort: '-id',
          expand: 'category',
        });
      }
    } catch (err) {
      console.warn('⚠️ [PocketBase Provider] Error fetching products, falling back to mock:', err);
      return mockProducts.filter((p) => {
        if (options.onlyActive && !p.active) return false;
        if (options.categoryId && p.category !== options.categoryId) return false;
        return true;
      });
    }
  },

  /**
   * Fetches a single product by slug
   */
  async getProductBySlug(slug: string): Promise<Product | null> {
    if (isMockMode) {
      const found = mockProducts.find((p) => p.slug.toLowerCase() === slug.toLowerCase());
      return found || null;
    }

    try {
      return await pb.collection('products').getFirstListItem<Product>(`slug = "${slug}" && active = true`, {
        expand: 'category',
      });
    } catch (err) {
      console.warn(`⚠️ [PocketBase Provider] Error fetching product "${slug}", falling back to mock:`, err);
      const found = mockProducts.find((p) => p.slug.toLowerCase() === slug.toLowerCase());
      return found || null;
    }
  },
};

/**
 * Cart Store & LocalStorage Synchronization for Aurea Fit
 */
export interface CartItem {
  id: string; // product id + size, e.g. "svfo5saxyjc9ysq-M"
  productId: string;
  name: string;
  slug: string;
  price: number;
  size: string;
  image: string;
  quantity: number;
}

const CART_STORAGE_KEY = 'aurea_fit_cart_v1';

export function getCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Error reading cart from localStorage:', e);
    return [];
  }
}

export function saveCart(items: CartItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('cart-updated', { detail: { items } }));
  } catch (e) {
    console.error('Error saving cart to localStorage:', e);
  }
}

export function addToCart(item: Omit<CartItem, 'id'>): CartItem[] {
  const current = getCart();
  const itemId = `${item.productId}-${item.size}`;
  const existingIdx = current.findIndex((i) => i.id === itemId);

  if (existingIdx > -1) {
    current[existingIdx].quantity += item.quantity || 1;
  } else {
    current.push({
      ...item,
      id: itemId,
      quantity: item.quantity || 1,
    });
  }

  saveCart(current);
  return current;
}

export function removeFromCart(itemId: string): CartItem[] {
  const current = getCart().filter((i) => i.id !== itemId);
  saveCart(current);
  return current;
}

export function updateQuantity(itemId: string, qty: number): CartItem[] {
  const current = getCart();
  const item = current.find((i) => i.id === itemId);
  if (item) {
    if (qty <= 0) {
      return removeFromCart(itemId);
    }
    item.quantity = qty;
    saveCart(current);
  }
  return current;
}

export function clearCart(): void {
  saveCart([]);
}

export function getCartCount(): number {
  return getCart().reduce((acc, item) => acc + item.quantity, 0);
}

export function getCartTotal(): number {
  return getCart().reduce((acc, item) => acc + item.price * item.quantity, 0);
}

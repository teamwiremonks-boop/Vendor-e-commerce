export interface B2BProduct {
  id: string;
  variantId?: string;
  storeId?: string;
  vendorId: string;
  vendorName: string;
  name: string;
  description: string;
  category: 'Ceramic' | 'Porcelain' | 'Vitrified' | 'Mosaic' | 'Marble';
  finish: 'Glossy' | 'Matte' | 'Polished' | 'Textured' | 'Satin';
  dimensions: string; // e.g. "600x600mm"
  thickness: string; // e.g. "9mm"
  originalPrice: number; // Price per Sqm
  clearancePrice: number; // Price per Sqm
  stockSqm: number; // Remaining stock in Square Metres
  moq: number; // Minimum Order Quantity in Sqm
  storeName: string;
  storeLocation: string;
  rating: number;
  grade: 'Standard (Grade A)' | 'Premium (Grade A+)' | 'Commercial Grade';
  image: string;
  skus: string;
}

export const CATEGORIES = ['All', 'Ceramic', 'Porcelain', 'Vitrified', 'Mosaic', 'Marble'];

export const B2B_CATALOG_PRODUCTS: B2BProduct[] = [];

export interface CartItem {
  product: B2BProduct;
  quantitySqm: number;
}

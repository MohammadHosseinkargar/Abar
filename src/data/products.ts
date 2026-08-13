export interface Product {
  id: string;
  slug: string;
  name: string;
  category: string;
  price: number;
  compareAt?: number;
  stock: number;
  rating: number;
  reviewsCount: number;
  material: string;
  color: string;
  sizeMm: string;
  description: string;
  specs: { label: string; value: string }[];
  featured?: boolean;
  imageUrl?: string;
  modelUrl?: string;
  images?: string[];
  models?: string[];
  availableColors?: string[];
  availableSizes?: string[];
  isBookmark?: boolean;
}

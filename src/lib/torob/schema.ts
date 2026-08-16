import { z } from "zod";

const urlList = z.array(z.string().url().max(1500)).min(1).max(100);
const uniqueList = z.array(z.string().min(1).max(200)).min(1).max(100);

export const torobProductRequestSchema = z.union([
  z.object({ page_urls: urlList }).strict(),
  z.object({ page_uniques: uniqueList }).strict(),
  z
    .object({
      page: z.number().int().min(1),
      sort: z.enum(["date_added_desc", "date_updated_desc"]),
    })
    .strict(),
]);

export type TorobProductRequest = z.infer<typeof torobProductRequestSchema>;

export type TorobProduct = {
  page_unique: string;
  page_url: string;
  product_group_id?: string;
  title: string;
  subtitle?: string;
  current_price: number;
  old_price?: number;
  availability: boolean;
  category_name?: string;
  image_links: string[];
  spec: Record<string, string | number>;
  guarantee?: string;
  short_desc?: string;
  date_added: string;
  date_updated: string;
};

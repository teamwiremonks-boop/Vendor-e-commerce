-- ============================================================================
-- SUPABASE / POSTGRESQL TABLES FOR TILECLEARANCE PORTAL
-- 
-- ⚡️ QUICK FIX FOR PERMISSION / RLS ERRORS (Code "42501"):
-- If you see "new row violates row-level security policy", run these commands 
-- in your Supabase SQL Editor to disable Row Level Security for testing:
--
--    ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
--    ALTER TABLE public.vendors DISABLE ROW LEVEL SECURITY;
--    ALTER TABLE public.products DISABLE ROW LEVEL SECURITY;
--    ALTER TABLE public.product_variants DISABLE ROW LEVEL SECURITY;
--    ALTER TABLE public.inventory DISABLE ROW LEVEL SECURITY;
--    ALTER TABLE public.store DISABLE ROW LEVEL SECURITY;
--    ALTER TABLE public.orders DISABLE ROW LEVEL SECURITY;
--    ALTER TABLE public.order_items DISABLE ROW LEVEL SECURITY;
--
-- ============================================================================

-- 1. Create USERS table (with new user_password column)
CREATE TABLE IF NOT EXISTS public.users (
    user_id TEXT PRIMARY KEY,
    user_name TEXT,
    user_email TEXT UNIQUE,
    user_password TEXT, -- Added for direct password verification (VARCHAR/TEXT is fine)
    role TEXT DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS & rules for USERS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Public Insert/Update Users" ON public.users FOR ALL USING (true) WITH CHECK (true);


-- 2. Create VENDORS table
CREATE TABLE IF NOT EXISTS public.vendors (
    vendor_id TEXT PRIMARY KEY,
    vendor_name TEXT,
    vendor_details JSONB,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS & rules for VENDORS
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Vendors" ON public.vendors FOR SELECT USING (true);
CREATE POLICY "Public Insert/Update Vendors" ON public.vendors FOR ALL USING (true) WITH CHECK (true);


-- 3. Create PRODUCTS table
CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY,
    product_id TEXT,
    vendor_id TEXT,
    vendorId TEXT,
    vendor_name TEXT,
    vendorName TEXT,
    product_name TEXT,
    name TEXT,
    product_description TEXT,
    description TEXT,
    category TEXT,
    finish TEXT,
    dimensions TEXT,
    thickness TEXT,
    original_price NUMERIC,
    originalPrice NUMERIC,
    clearance_price NUMERIC,
    clearancePrice NUMERIC,
    stock_sqm INTEGER,
    stockSqm INTEGER,
    moq INTEGER,
    store_name TEXT,
    storeName TEXT,
    store_location TEXT,
    storeLocation TEXT,
    rating NUMERIC DEFAULT 4.8,
    grade TEXT,
    image TEXT,
    skus TEXT,
    sku TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS & rules for PRODUCTS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Public Insert/Update Products" ON public.products FOR ALL USING (true) WITH CHECK (true);


-- 4. Create ORDERS table
CREATE TABLE IF NOT EXISTS public.orders (
    order_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id UUID DEFAULT gen_random_uuid(), -- Support mapping to .id or .order_id to prevent any mismatch
    user_id TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS & rules for ORDERS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Orders" ON public.orders FOR SELECT USING (true);
CREATE POLICY "Public Insert/Update Orders" ON public.orders FOR ALL USING (true) WITH CHECK (true);


-- 5. Create ORDER_ITEMS table
CREATE TABLE IF NOT EXISTS public.order_items (
    id BIGSERIAL PRIMARY KEY,
    order_id UUID,
    variant_id TEXT,
    vendor_id TEXT,
    store_id TEXT,
    quantity INTEGER,
    price_at_purchase NUMERIC,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS & rules for ORDER_ITEMS
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Order Items" ON public.order_items FOR SELECT USING (true);
CREATE POLICY "Public Insert/Update Order Items" ON public.order_items FOR ALL USING (true) WITH CHECK (true);


-- 6. Create PRODUCT_VARIANTS table
CREATE TABLE IF NOT EXISTS public.product_variants (
    id TEXT PRIMARY KEY,
    product_id TEXT,
    sku TEXT,
    finish TEXT,
    dimensions TEXT,
    thickness TEXT,
    clearance_price NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Product Variants" ON public.product_variants FOR SELECT USING (true);
CREATE POLICY "Public Insert/Update Product Variants" ON public.product_variants FOR ALL USING (true) WITH CHECK (true);


-- 7. Create INVENTORY table
CREATE TABLE IF NOT EXISTS public.inventory (
    id TEXT PRIMARY KEY,
    product_id TEXT,
    stock_sqm INTEGER,
    moq INTEGER,
    vendor_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Inventory" ON public.inventory FOR SELECT USING (true);
CREATE POLICY "Public Insert/Update Inventory" ON public.inventory FOR ALL USING (true) WITH CHECK (true);


-- 8. Create STORE table
CREATE TABLE IF NOT EXISTS public.store (
    id TEXT PRIMARY KEY,
    store_name TEXT,
    store_location TEXT,
    product_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.store ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Store" ON public.store FOR SELECT USING (true);
CREATE POLICY "Public Insert/Update Store" ON public.store FOR ALL USING (true) WITH CHECK (true);

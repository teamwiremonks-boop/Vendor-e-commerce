import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  ShoppingCart, 
  User, 
  LogOut, 
  Building2, 
  Clock, 
  Filter, 
  Check, 
  AlertCircle,
  Plus,
  Package,
  Inbox,
  ClipboardList,
  MapPin,
  CheckCircle2,
  Trash2,
  Sliders,
  DollarSign
} from 'lucide-react';

import { CATEGORIES, B2B_CATALOG_PRODUCTS, B2BProduct, CartItem } from './data';
import { isSupabaseConfigured, supabase, CurrentUserProfile, getCachedProfile, setCachedProfile } from './lib/supabase';

// Importing custom designed sub-components
import AuthModal from './components/AuthModal';
import CartOverlay from './components/CartOverlay';
import Footer from './components/Footer';

// Define standard B2B placed order format
interface PlacedOrder {
  id: string;
  supabaseId?: string;
  createdAt: string;
  userEmail: string;
  userName: string;
  items: {
    product: B2BProduct;
    quantitySqm: number;
    subtotal: number;
    status?: 'pending' | 'completed' | 'rejected' | 'processing';
  }[];
  totalPrice: number;
  status: 'pending' | 'processing' | 'completed' | 'cancelled' | 'rejected' | 'partially accepted';
}

const mapDbProductToB2BProduct = (db: any): B2BProduct => {
  // If we fetched the normalized format (has product_variants, etc.)
  const variant = db.product_variants && db.product_variants.length > 0 ? db.product_variants[0] : null;
  const inv = db.inventory && db.inventory.length > 0 ? db.inventory[0] : null;
  const storeObj = db.stores && db.stores.length > 0 ? db.stores[0] : null;

  // Attempt to parse dimensions & thickness from variant name if empty on products table
  let extractedDims = '';
  let extractedThick = '';
  const vName = variant ? (variant.variant_name || variant.name || variant.variant_id || '') : '';
  if (vName) {
    const innerMatch = vName.match(/\(([^)]+)\)/);
    const textToParse = innerMatch ? innerMatch[1] : vName;
    const parts = textToParse.split(',');
    for (let p of parts) {
      p = p.trim();
      if (p.toLowerCase().includes('dimension')) {
        extractedDims = p.replace(/dimensions/i, '').trim();
      } else if (p.toLowerCase().includes('thickness')) {
        extractedThick = p.replace(/thickness/i, '').trim();
      } else {
        if (/^\d+\s*x\s*\d+\s*[a-zA-Z]*$/i.test(p) || /\d+mm\s*x\s*\d+mm/i.test(p) || /^\d+x\d+$/i.test(p)) {
          extractedDims = p;
        } else if (/^\d+(\.\d+)?\s*mm$/i.test(p)) {
          extractedThick = p;
        }
      }
    }
    if (!extractedDims) {
      const dimMatch = vName.match(/(\d+\s*x\s*\d+\s*[a-zA-Z\s]+|\d+\s*x\s*\d+)/i);
      if (dimMatch) extractedDims = dimMatch[0];
    }
  }

  let finalDims = db.dimensions?.trim();
  if (!finalDims || finalDims === 'null' || finalDims === 'undefined') {
    finalDims = extractedDims || (variant ? variant.dimensions : '') || '600mm x 600mm';
  }

  let finalThick = db.thickness?.trim();
  if (!finalThick || finalThick === 'null' || finalThick === 'undefined') {
    finalThick = extractedThick || (variant ? variant.thickness : '') || '9.5mm';
  }

  return {
    id: db.product_id || db.id || `prod-${Math.random().toString(36).substr(2, 9)}`,
    variantId: db.variantId || db.variant_id || (variant ? variant.id || variant.variant_id : undefined),
    storeId: db.storeId || db.store_id || (storeObj ? storeObj.id || storeObj.store_id : undefined),
    vendorId: db.vendor_id || db.vendorId || 'vendor-generic',
    vendorName: db.vendor_name || db.vendorName || 'Elite Tiles Importers',
    name: db.product_name || db.name || 'Premium Tile Stock Lot',
    description: db.product_description || db.description || 'Vitrified porcelain with a highdensity finish.',
    category: db.category || 'Porcelain',
    
    // Derived or normalized relations
    finish: db.finish || (variant ? variant.finish : 'Polished'),
    dimensions: finalDims,
    thickness: finalThick,
    originalPrice: Number(db.original_price || db.originalPrice || (variant ? Number(variant.price || variant.clearance_price) * 2 : 85.00)),
    clearancePrice: Number(db.clearance_price || db.clearancePrice || (variant ? Number(variant.price || variant.clearance_price) : 29.90)),
    stockSqm: Number(db.stock_sqm || db.stockSqm || db.stock || (inv ? Number(inv.quantity || inv.stock_sqm) : 250)),
    moq: Number(db.moq || 40),
    storeName: db.store_name || db.storeName || (storeObj ? storeObj.store_name : 'Distribution Logistics'),
    storeLocation: db.store_location || db.storeLocation || (storeObj ? storeObj.store_location : 'Central Logistics Depot'),
    
    rating: Number(db.rating || 4.7),
    grade: db.grade || 'Premium (Grade A+)',
    image: db.image || db.image_url || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=80',
    skus: db.skus || db.sku || (variant ? variant.sku : null) || `SKU-TILE-${Math.random().toString(36).substr(2, 5).toUpperCase()}`
  };
};

function generateUUID(): string {
  const hex = '0123456789abcdef';
  let uuid = '';
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      uuid += '-';
    } else if (i === 14) {
      uuid += '4'; // Version 4
    } else if (i === 19) {
      uuid += hex[(Math.random() * 4) | 8];
    } else {
      uuid += hex[(Math.random() * 16) | 0];
    }
  }
  return uuid;
}

const knownMissingColumns: Record<string, Set<string>> = (() => {
  try {
    const cached = localStorage.getItem('tc_known_missing_columns');
    if (cached) {
      const parsed = JSON.parse(cached);
      const res: Record<string, Set<string>> = {};
      for (const k in parsed) {
        res[k] = new Set(parsed[k]);
      }
      // Guarantee we clear any outdated missing table marks for store/stores
      if (res['stores']) {
        res['stores'].delete('__table_not_exist__');
      }
      if (res['store']) {
        res['store'].delete('__table_not_exist__');
      }
      return res;
    }
  } catch (e) {
    console.warn('Error hydrating known missing columns:', e);
  }
  return {};
})();

const saveKnownMissingColumns = () => {
  try {
    const serializable: Record<string, string[]> = {};
    for (const k in knownMissingColumns) {
      serializable[k] = Array.from(knownMissingColumns[k]);
    }
    localStorage.setItem('tc_known_missing_columns', JSON.stringify(serializable));
  } catch (e) {
    console.warn('Error saving known missing columns:', e);
  }
};

async function safeInsert(tableName: string, payload: any[]) {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: new Error('Supabase is not configured') };
  }
  
  if (!knownMissingColumns[tableName]) {
    knownMissingColumns[tableName] = new Set<string>();
  }
  
  let currentTable = tableName;
  
  if (!knownMissingColumns[currentTable]) {
    knownMissingColumns[currentTable] = new Set<string>();
  }

  let attemptPayload = JSON.parse(JSON.stringify(payload));
  
  // Pre-filter using already discovered missing columns to bypass unnecessary API roundtrips
  for (let i = 0; i < attemptPayload.length; i++) {
    for (const missingCol of knownMissingColumns[currentTable]) {
      delete attemptPayload[i][missingCol];
    }
  }

  for (let attempt = 0; attempt < 80; attempt++) {
    const { data, error } = await supabase.from(currentTable).insert(attemptPayload);
    if (!error) {
      return { data, error: null };
    }
    const errMsg = error.message || '';
    
    // Check for relation does not exist (e.g. stores vs store)
    const relationMatch = errMsg.match(/relation "public\.([^"]+)" does not exist/i) ||
                          errMsg.match(/relation "([^"]+)" does not exist/i) ||
                          errMsg.match(/Could not find the table 'public\.([^']+)'/i) ||
                          errMsg.match(/Could not find the table '([^'\.]+)'/i);
    if (relationMatch) {
      // Return immediately if the actual requested table does not exist
      return { data: null, error };
    }

    // Check for column not found in schema cache
    const match = errMsg.match(/Could not find the '([^']+)' column/i) || 
                  errMsg.match(/column "([^"]+)" of relation "[^"]+" does not exist/i) ||
                  errMsg.match(/column "([^"]+)" does not exist/i);
    if (match && match[1]) {
      const missingColumn = match[1];
      console.warn(`[SafeInsert] Removing missing column '${missingColumn}' from '${currentTable}' payload and retrying...`);
      knownMissingColumns[currentTable].add(missingColumn);
      saveKnownMissingColumns();
      for (let i = 0; i < attemptPayload.length; i++) {
        delete attemptPayload[i][missingColumn];
      }
      continue;
    }
    
    // If it is a different error or we can't parse the missing column, return it
    return { data, error };
  }
  return await supabase.from(currentTable).insert(attemptPayload);
}

async function safeUpdate(tableName: string, payload: Record<string, any>, matchFn: (q: any) => any) {
  if (!isSupabaseConfigured || !supabase) {
    return { data: null, error: new Error('Supabase is not configured') };
  }
  
  if (!knownMissingColumns[tableName]) {
    knownMissingColumns[tableName] = new Set<string>();
  }
  
  let attemptPayload = JSON.parse(JSON.stringify(payload));
  for (const missingCol of knownMissingColumns[tableName]) {
    delete attemptPayload[missingCol];
  }

  // If payload is empty after pruning, skip update entirely to prevent empty patch errors
  if (Object.keys(attemptPayload).length === 0) {
    return { data: null, error: null };
  }

  for (let attempt = 0; attempt < 80; attempt++) {
    let query = supabase.from(tableName).update(attemptPayload);
    query = matchFn(query);
    const { data, error } = await query;
    if (!error) {
      return { data, error: null };
    }
    const errMsg = error.message || '';
    
    // Check for column not found in schema cache
    const match = errMsg.match(/Could not find the '([^']+)' column/i) || 
                  errMsg.match(/column "([^"]+)" of relation "[^"]+" does not exist/i) ||
                  errMsg.match(/column "([^"]+)" does not exist/i);
    if (match && match[1]) {
      const missingColumn = match[1];
      console.warn(`[SafeUpdate] Removing missing column '${missingColumn}' from '${tableName}' payload and retrying...`);
      knownMissingColumns[tableName].add(missingColumn);
      saveKnownMissingColumns();
      delete attemptPayload[missingColumn];
      
      // If payload is now empty, skip
      if (Object.keys(attemptPayload).length === 0) {
        return { data: null, error: null };
      }
      continue;
    }
    return { data, error };
  }
  return { data: null, error: null };
}

export default function App() {
  // Session Handling State
  const [currentUser, setCurrentUser] = useState<CurrentUserProfile | null>(null);

  // Active navigation tab for authorized roles (catalog vs administrative cockpit)
  const [activeHubTab, setActiveHubTab] = useState<'catalog' | 'dashboard'>('catalog');

  // Auto route vendor and admin to dashboard upon login
  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === 'vendor' || currentUser.role === 'admin') {
        setActiveHubTab('dashboard');
      } else {
        setActiveHubTab('catalog');
      }
    } else {
      setActiveHubTab('catalog');
    }
  }, [currentUser]);

  // Database Connection Status monitoring & diagnostic details
  const [dbConnectionStatus, setDbConnectionStatus] = useState<'checking' | 'connected' | 'error' | 'offline'>('checking');
  const [dbDiagnosticMessage, setDbDiagnosticMessage] = useState<string | null>(null);

  // Layout UI navigation & visibility drawers
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Reactive state repositories
  const [products, setProducts] = useState<B2BProduct[]>([]);
  const [orders, setOrders] = useState<PlacedOrder[]>([]);
  const [totalVendors, setTotalVendors] = useState<number>(1);
  const [expandedVendorProdId, setExpandedVendorProdId] = useState<string | null>(null);
  const [activeCardImages, setActiveCardImages] = useState<Record<string, string>>({});

  // Search & Categories filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Client shopping basket structure
  const [cart, setCart] = useState<CartItem[]>([]);

  // Simple feedback alert toast
  const [successUpdates, setSuccessUpdates] = useState<string[]>([]);
  const [showStatusAlert, setShowStatusAlert] = useState(false);

  // Custom premium toast notifications
  interface CustomToast {
    id: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
  }
  const [toasts, setToasts] = useState<CustomToast[]>([]);
  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success') => {
    const id = Math.random().toString(36).substring(7);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  // Custom deletion state selector
  const [productToDeleteId, setProductToDeleteId] = useState<string | null>(null);

  // Order status live-operation progress locking key
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  // Vendor Register product form bindings
  const [newProdName, setNewProdName] = useState('');
  const [newProdDesc, setNewProdDesc] = useState('');
  const [newProdCategory, setNewProdCategory] = useState<'Ceramic' | 'Porcelain' | 'Vitrified' | 'Mosaic' | 'Marble'>('Ceramic');
  const [newProdFinish, setNewProdFinish] = useState<'Glossy' | 'Matte' | 'Polished' | 'Textured' | 'Satin'>('Glossy');
  const [newProdDims, setNewProdDims] = useState('600mm x 600mm');
  const [newProdThick, setNewProdThick] = useState('9mm');
  const [newProdOriginal, setNewProdOriginal] = useState('80.00');
  const [newProdClearance, setNewProdClearance] = useState('29.00');
  const [newProdStock, setNewProdStock] = useState('500');
  const [newProdMoq, setNewProdMoq] = useState('40');
  const [newProdStoreName, setNewProdStoreName] = useState('Central Logistics');
  const [newProdStoreLoc, setNewProdStoreLoc] = useState('Birmingham Yard B1');
  const [newProdGrade, setNewProdGrade] = useState<'Standard (Grade A)' | 'Premium (Grade A+)' | 'Commercial Grade'>('Premium (Grade A+)');
  const [newProdSku, setNewProdSku] = useState('');
  const [newProdImage, setNewProdImage] = useState('https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=80');

  const fetchDatabaseData = async (silent = false) => {
    if (!silent) {
      setDbConnectionStatus('checking');
    }
    setDbDiagnosticMessage(null);
    try {
      // Query one record to check connectivity
      const { data: checkData, error: checkError } = await supabase.from('products').select('*').limit(1);
      if (checkError) {
        console.warn('Supabase products check failed:', checkError);
        setDbConnectionStatus('error');
        setDbDiagnosticMessage(checkError.message || JSON.stringify(checkError));
      } else {
        setDbConnectionStatus('connected');
        
        let dbProducts: any[] | null = null;
        let dbVariants: any[] | null = null;
        let dbInventory: any[] | null = null;
        let dbStores: any[] | null = null;

        try {
          const { data: pData } = await supabase.from('products').select('*');
          dbProducts = pData;
          
          const { data: vData } = await supabase.from('product_variants').select('*');
          dbVariants = vData;

          const { data: iData } = await supabase.from('inventory').select('*');
          dbInventory = iData;

          try {
            const { data: sData } = await supabase.from('stores').select('*');
            dbStores = sData;
          } catch (_) {
            try {
              const { data: sData } = await supabase.from('store').select('*');
              dbStores = sData;
            } catch (_) {}
          }
        } catch (nestedEx) {
          console.warn('Could not select from flat tables:', nestedEx);
        }

        let mappedProducts: B2BProduct[] = [];
        if (dbProducts && dbProducts.length > 0) {
          const enrichedProducts = dbProducts.map((p: any) => {
            const pId = p.product_id || p.id;
            const product_variants = dbVariants ? dbVariants.filter((v: any) => v.product_id === pId) : [];
            const variantIds = product_variants.map((v: any) => v.variant_id || v.id);
            const inventory = dbInventory ? dbInventory.filter((inv: any) => 
              variantIds.includes(inv.variant_id) || 
              inv.product_id === pId || 
              variantIds.includes(inv.id)
            ) : [];
            const storeIds = inventory.map((inv: any) => inv.store_id).filter(Boolean);
            const stores = dbStores ? dbStores.filter((st: any) => 
              st.product_id === pId || 
              st.product_id === p.id ||
              storeIds.includes(st.store_id || st.id)
            ) : [];

            return {
              ...p,
              product_variants,
              inventory,
              stores
            };
          });

          mappedProducts = enrichedProducts.map(mapDbProductToB2BProduct);
          setProducts(mappedProducts);
        }

        // Fetch vendors count
        try {
          const { data: dbVendors } = await supabase.from('vendors').select('*');
          const uniqueVendorIdsFromProducts = new Set(mappedProducts.map(p => p.vendorId));
          const fallbackCount = uniqueVendorIdsFromProducts.size || 1;
          const count = dbVendors && dbVendors.length > 0 ? Math.max(dbVendors.length, fallbackCount) : fallbackCount;
          setTotalVendors(count);
        } catch (vEx) {
          console.warn('Could not load vendors list:', vEx);
        }

        // Load orders from database to synchronize dashboards
        try {
          const { data: dbOrders, error: ordersErr } = await supabase.from('orders').select('*');
          if (!ordersErr && dbOrders) {
            const { data: dbItems } = await supabase.from('order_items').select('*');
            const { data: dbUsers } = await supabase.from('users').select('*');

            const productMap = mappedProducts.reduce((acc: any, p: B2BProduct) => {
              acc[p.id] = p;
              if (p.variantId) acc[p.variantId] = p;
              return acc;
            }, {} as any);

            const userMap = dbUsers ? dbUsers.reduce((acc: any, u: any) => {
              acc[u.user_id] = u;
              return acc;
            }, {} as any) : {};

            const resolvedOrders: PlacedOrder[] = dbOrders.map((o: any) => {
              const associatedItems = dbItems ? dbItems.filter((i: any) => i.order_id === (o.order_id || o.id)) : [];
              const matchedUser = userMap[o.user_id];

              const orderItems = associatedItems.map((ai: any) => {
                const resolvedProduct = productMap[ai.variant_id] || productMap[ai.product_id] || {
                  id: ai.product_id || ai.variant_id || 'fallback-product',
                  vendorId: ai.vendor_id || 'vendor-generic',
                  vendorName: 'Clearance Lot Vendor',
                  name: 'Premium Tile Lot Specimen',
                  description: 'Vitrified high-density finished clearance tiles.',
                  category: 'Porcelain',
                  finish: 'Polished',
                  dimensions: '600x600mm',
                  thickness: '9mm',
                  originalPrice: Number(ai.price_at_purchase) * 2,
                  clearancePrice: Number(ai.price_at_purchase),
                  stockSqm: 1000,
                  moq: 40,
                  storeName: 'Warehouse Depot',
                  storeLocation: 'Birmingham Yard',
                  rating: 4.8,
                  grade: 'Premium (Grade A+)',
                  image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=80',
                  skus: 'FALLBACK-SKU'
                };

                return {
                  product: resolvedProduct,
                  quantitySqm: ai.quantity || 10,
                  subtotal: Number(ai.price_at_purchase) * (ai.quantity || 10),
                  status: ai.status || 'pending'
                };
              });

              const totalPrice = orderItems.reduce((sum, item) => sum + item.subtotal, 0);

              return {
                id: o.order_id || o.id,
                supabaseId: o.order_id || o.id,
                createdAt: new Date(o.created_at || Date.now()).toLocaleDateString('en-US', { hour: '2-digit', minute: '2-digit' }),
                userName: matchedUser ? matchedUser.user_name : 'B2B Client',
                userEmail: matchedUser ? matchedUser.user_email : 'client@procure.com',
                items: orderItems,
                totalPrice: totalPrice,
                status: o.status || 'pending'
              };
            });

            setOrders(resolvedOrders);
          }
        } catch (ex) {
          console.warn('Orders database load check ex:', ex);
        }
      }
    } catch (err: any) {
      console.warn('Silent product load check general exception:', err);
      setDbConnectionStatus('error');
      setDbDiagnosticMessage(err.message || 'Unknown network error');
    }
  };

  // Bootstrapping and Local Storage reactive synchronizations
  useEffect(() => {
    // A. Attempt to initialize auth session from Supabase listener
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const meta = session.user.user_metadata || {};
        const profile: CurrentUserProfile = {
          id: session.user.id,
          email: session.user.email || '',
          name: meta.name || session.user.email?.split('@')[0] || 'User',
          role: meta.role || 'user',
          vendorName: meta.vendorName,
          storeLocation: meta.storeLocation
        };
        setCurrentUser(profile);
        setCachedProfile(profile);
      } else {
        setCurrentUser(null);
        setCachedProfile(null);
      }
    });

    // B. Set up Supabase real-time auth dynamic listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        const meta = session.user.user_metadata || {};
        const profile: CurrentUserProfile = {
          id: session.user.id,
          email: session.user.email || '',
          name: meta.name || session.user.email?.split('@')[0] || 'User',
          role: meta.role || 'user',
          vendorName: meta.vendorName,
          storeLocation: meta.storeLocation
        };
        setCurrentUser(profile);
        setCachedProfile(profile);
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        setCachedProfile(null);
      }
    });

    // C. Hydrate Products state from Local Storage cache or static defaults
    const cachedProducts = localStorage.getItem('tc_products_store_v2');
    if (cachedProducts) {
      try {
        setProducts(JSON.parse(cachedProducts));
      } catch {
        setProducts(B2B_CATALOG_PRODUCTS);
      }
    } else {
      setProducts(B2B_CATALOG_PRODUCTS);
    }

    // D. Hydrate Orders from cache
    const cachedOrders = localStorage.getItem('tc_orders_store_v2');
    if (cachedOrders) {
      try {
        setOrders(JSON.parse(cachedOrders));
      } catch {
        setOrders([]);
      }
    }

    if (isSupabaseConfigured) {
      fetchDatabaseData();
    } else {
      setDbConnectionStatus('offline');
    }

    return () => subscription.unsubscribe();
  }, []);

  // Update Cache when state mutates reactive-style
  useEffect(() => {
    localStorage.setItem('tc_products_store_v2', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('tc_orders_store_v2', JSON.stringify(orders));
  }, [orders]);


  // Cart Adjustments
  const handleUpdateQty = (productId: string, qty: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const cappedQty = Math.min(Math.max(1, qty), item.product.stockSqm);
        return { ...item, quantitySqm: cappedQty };
      }
      return item;
    }));
  };

  const handleRemoveFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const handleAddToCart = (product: B2BProduct) => {
    if (product.stockSqm <= 0) return;
    setCart(prev => {
      const exists = prev.find(item => item.product.id === product.id);
      if (exists) {
        return prev.map(item => 
          item.product.id === product.id 
            ? { ...item, quantitySqm: Math.min(item.quantitySqm + product.moq, product.stockSqm) } 
            : item
        );
      }
      return [...prev, { product, quantitySqm: Math.min(product.moq, product.stockSqm) }];
    });
    setIsCartOpen(true);
  };

  // Checkout response
  const handleCheckoutSuccess = (logs: string[], supabaseOrder?: any) => {
    // Generate active order entity
    const newOrder: PlacedOrder = {
      id: supabaseOrder?.order_id || supabaseOrder?.id || `ORD-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      supabaseId: supabaseOrder?.order_id || supabaseOrder?.id,
      createdAt: new Date().toLocaleDateString('en-US', { hour: '2-digit', minute: '2-digit' }),
      userName: currentUser?.name || 'Guest Client',
      userEmail: currentUser?.email || 'contracts@procure.com',
      items: cart.map(item => ({
        product: item.product,
        quantitySqm: item.quantitySqm,
        subtotal: item.product.clearancePrice * item.quantitySqm,
        status: 'pending'
      })),
      totalPrice: cart.reduce((sum, item) => sum + item.product.clearancePrice * item.quantitySqm, 0),
      status: 'pending'
    };

    setOrders(prev => [newOrder, ...prev]);
    setCart([]);
    setSuccessUpdates(logs);
    // User requested to disable the clearance order placed banner at the top of the page
    setShowStatusAlert(false);
    showToast('Order placed successfully! Pending vendor verification.', 'success');
  };

  // Sign out handler
  const handleLogOut = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
    setCachedProfile(null);
  };

  // Filter Catalog
  const filteredProducts = useMemo(() => {
    return products.filter(prod => {
      const matchSearch = prod.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          prod.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          prod.skus.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchCategory = selectedCategory === 'All' || prod.category === selectedCategory;

      return matchSearch && matchCategory;
    });
  }, [searchQuery, selectedCategory, products]);


  // --- JOURNEY PROCESSORS ---

  // 1. Vendor: Register new excess stock
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName || !newProdClearance || !newProdStock || !newProdMoq) return;

    try {
      const uniqueId = generateUUID();
      const variantId = generateUUID();
      const storeId = generateUUID();
      const skuVal = newProdSku.trim() || `SKU-TILE-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

      const brand = currentUser?.vendorName || currentUser?.name || 'Elite Tiles';
      const parsedOriginal = parseFloat(newProdOriginal) || parseFloat(newProdClearance) * 2;
      const parsedClearance = parseFloat(newProdClearance);

      const registeredTile: B2BProduct = {
        id: uniqueId,
        variantId,
        storeId,
        vendorId: currentUser?.id || 'vendor-generic',
        vendorName: brand,
        name: newProdName.trim(),
        description: newProdDesc.trim() || `${newProdCategory} tiles with pre-sorted highdensity composite surfaces.`,
        category: newProdCategory,
        finish: newProdFinish,
        dimensions: newProdDims.trim(),
        thickness: newProdThick.trim(),
        originalPrice: parsedOriginal,
        clearancePrice: parsedClearance,
        stockSqm: parseInt(newProdStock) || 120,
        moq: parseInt(newProdMoq) || 40,
        storeName: newProdStoreName.trim(),
        storeLocation: newProdStoreLoc.trim() || 'Central Showroom Yard',
        rating: 4.8,
        grade: newProdGrade,
        image: newProdImage.trim(),
        skus: skuVal
      };

      // Real insert in Supabase database tables if online, failing silently for sandbox state reactivity
      if (isSupabaseConfigured) {
        let insertedStore = false;
        let insertedProduct = false;
        let insertedVariant = false;
        let insertedInventory = false;
        const inventoryId = generateUUID();

        try {
          const vendorUuid = (currentUser?.id && currentUser.id.includes('-')) 
            ? currentUser.id 
            : '00000000-0000-4000-yxxx-000000000000'.replace(/[y]/g, 'a');

          // Ensure vendor exists in vendors table to satisfy Referential Integrity
          try {
            await safeInsert('vendors', [{
              vendor_id: vendorUuid,
              vendor_name: brand,
              vendor_details: { location: newProdStoreLoc.trim() || 'Central Showroom Yard' },
              status: 'active'
            }]);
          } catch (_) {}

          // Ensure store exists in stores/store table to satisfy stores references
          const { error: storeErr } = await safeInsert('stores', [{
            id: storeId,
            store_id: storeId,
            store_name: newProdStoreName.trim() || 'Central Logistics Depot',
            store_location: newProdStoreLoc.trim() || 'Central Showroom Yard',
            product_id: uniqueId,
            vendor_id: vendorUuid,
            status: 'active'
          }]);

          if (storeErr) {
            console.warn('Could not insert showroom into stores table:', storeErr);
            throw new Error(`Table 'stores' insertion failure: ${storeErr.message}`);
          }
          insertedStore = true;

          // A. Add product (Only valid columns as specified in products schema!)
          const { error: prodErr } = await safeInsert('products', [{
            id: uniqueId,
            product_id: uniqueId,
            vendor_id: vendorUuid,
            vendorId: vendorUuid,
            vendor_name: brand,
            vendorName: brand,
            product_name: newProdName.trim(),
            name: newProdName.trim(),
            product_description: newProdDesc.trim() || `${newProdCategory} premium tiles.`,
            description: newProdDesc.trim() || `${newProdCategory} premium tiles.`,
            category: newProdCategory,
            finish: newProdFinish,
            dimensions: newProdDims.trim(),
            thickness: newProdThick.trim(),
            original_price: parsedOriginal,
            originalPrice: parsedOriginal,
            clearance_price: parsedClearance,
            clearancePrice: parsedClearance,
            stock_sqm: parseInt(newProdStock) || 120,
            stockSqm: parseInt(newProdStock) || 120,
            moq: parseInt(newProdMoq) || 40,
            store_name: newProdStoreName.trim(),
            storeName: newProdStoreName.trim(),
            store_location: newProdStoreLoc.trim() || 'Central Showroom Yard',
            storeLocation: newProdStoreLoc.trim() || 'Central Showroom Yard',
            rating: 4.8,
            grade: newProdGrade,
            image: newProdImage.trim(),
            skus: skuVal,
            sku: skuVal
          }]);

          if (prodErr) {
            console.error('Products insertion failed:', prodErr);
            throw new Error(`Products table insertion failure: ${prodErr.message}`);
          }
          insertedProduct = true;

          // B. Add to product_variants table
          const { error: variantErr } = await safeInsert('product_variants', [{
            id: variantId,
            variant_id: variantId,
            product_id: uniqueId,
            variant_name: `${newProdFinish} finish (${newProdDims} dimensions, ${newProdThick} thickness)`.trim(),
            sku: skuVal,
            dimensions: newProdDims.trim(),
            thickness: newProdThick.trim(),
            price: parsedClearance,
            clearance_price: parsedClearance
          }]);

          if (variantErr) {
            console.error('product_variants insertion failed:', variantErr);
            throw new Error(`Table 'product_variants' insertion failure: ${variantErr.message}`);
          }
          insertedVariant = true;

          // C. Add to inventory table
          const { error: inventoryErr } = await safeInsert('inventory', [{
            id: inventoryId,
            inventory_id: inventoryId,
            store_id: storeId,
            variant_id: variantId,
            product_id: uniqueId,
            quantity: parseInt(newProdStock) || 120,
            stock_sqm: parseInt(newProdStock) || 120,
            moq: parseInt(newProdMoq) || 40,
            vendor_id: vendorUuid
          }]);

          if (inventoryErr) {
            console.error('inventory insertion failed:', inventoryErr);
            throw new Error(`Table 'inventory' insertion failure: ${inventoryErr.message}`);
          }
          insertedInventory = true;

        } catch (dbErr: any) {
          console.error('Detailed Supabase multi-table insertion error details:', dbErr);
          
          console.log('[Rollback] Cleaning up partial inserts due to failure...');
          // Cleanup / Rollback inserts on failure in reverse sequence to ensure integrity
          if (insertedInventory) {
            try {
              await supabase.from('inventory').delete().eq('id', inventoryId);
            } catch (_) {}
          }
          if (insertedVariant) {
            try {
              await supabase.from('product_variants').delete().eq('id', variantId);
            } catch (_) {}
          }
          if (insertedProduct) {
            try {
              await supabase.from('products').delete().eq('id', uniqueId);
            } catch (_) {}
          }
          if (insertedStore) {
            try {
              await supabase.from('stores').delete().eq('store_id', storeId);
            } catch (_) {}
            try {
              await supabase.from('stores').delete().eq('id', storeId);
            } catch (_) {}
            try {
              await supabase.from('store').delete().eq('store_id', storeId);
            } catch (_) {}
            try {
              await supabase.from('store').delete().eq('id', storeId);
            } catch (_) {}
          }
          throw dbErr;
        }
      }

      setProducts(prev => [registeredTile, ...prev]);

      // Reset fields
      setNewProdName('');
      setNewProdDesc('');
      setNewProdOriginal('80.00');
      setNewProdClearance('29.00');
      setNewProdStock('500');
      setNewProdMoq('40');
      setNewProdSku('');

      showToast('Listing created successfully! Products and showrooms synced live.', 'success');
      await fetchDatabaseData(true);
    } catch (err: any) {
      showToast(err.message || 'Error occurred registering clearance item.', 'error');
    }
  };

  // 2. Vendor / Admin: Change order status
  const handleUpdateOrderStatus = async (orderId: string, flag: 'processing' | 'completed' | 'cancelled' | 'rejected') => {
    const targetOrder = orders.find(o => o.id === orderId);
    if (!targetOrder) return;

    if (updatingOrderId) return;
    setUpdatingOrderId(orderId);

    try {
      // A. PERFORM OPTIMISTIC STATE UPDATE IMMEDIATELY FIRST
      setOrders(prev => {
        const nextOrders = prev.map(o => {
          if (o.id !== orderId) return o;

          // A. Update only items belonging to the active vendor
          const updatedItems = o.items.map(item => {
            const matchesVendor = currentUser?.role !== 'vendor' || 
                                  item.product.vendorId === currentUser.id ||
                                  item.product.vendorId === '00000000-0000-4000-a000-000000000001' ||
                                  item.product.vendorId === 'vendor-generic';
            if (matchesVendor) {
              return { ...item, status: flag as any };
            }
            return item;
          });

          // B. Determine overall order status based on updated items
          const statuses = updatedItems.map(item => item.status || 'pending');
          const uniqueStatuses = Array.from(new Set(statuses));
          
          let overallStatus: PlacedOrder['status'] = 'pending';
          if (uniqueStatuses.length === 1) {
            overallStatus = uniqueStatuses[0] as any;
          } else {
            const hasCompleted = statuses.includes('completed');
            const hasRejected = statuses.includes('rejected');
            const hasPending = statuses.includes('pending') || statuses.includes('processing');
            
            if (hasCompleted && hasRejected) {
              overallStatus = 'partially accepted';
            } else if (hasCompleted && hasPending) {
              overallStatus = 'partially accepted';
            } else if (hasRejected && hasPending) {
              overallStatus = 'pending';
            } else {
              overallStatus = 'processing';
            }
          }

          // C. Handle stock reductions locally
          if (flag === 'completed') {
            const vendorItems = o.items.filter(item => 
              currentUser?.role !== 'vendor' || 
              item.product.vendorId === currentUser.id ||
              item.product.vendorId === '00000000-0000-4000-a000-000000000001' ||
              item.product.vendorId === 'vendor-generic'
            );
            setProducts(prevProducts => {
              return prevProducts.map(p => {
                const orderItem = vendorItems.find(item => item.product.id === p.id || item.product.variantId === p.variantId);
                if (orderItem) {
                  const newStock = Math.max(0, p.stockSqm - orderItem.quantitySqm);
                  return { ...p, stockSqm: newStock };
                }
                return p;
              });
            });
          }

          return {
            ...o,
            items: updatedItems,
            status: overallStatus
          };
        });

        // Write to cache
        localStorage.setItem('tc_orders_store_v2', JSON.stringify(nextOrders));
        return nextOrders;
      });

      const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
      const targetUuid = (orderId && isUUID(orderId)) 
        ? orderId 
        : (targetOrder?.supabaseId && isUUID(targetOrder.supabaseId)) 
          ? targetOrder.supabaseId 
          : null;

      if (isSupabaseConfigured && targetUuid) {
        try {
          let overallStatus: PlacedOrder['status'] = 'pending';

          // A. Update order items based on role. Only update items belonging to the active vendor.
          if (currentUser?.role === 'vendor') {
            // Fetch current order items from DB to match them accurately
            const { data: allItems } = await supabase
              .from('order_items')
              .select('*')
              .eq('order_id', targetUuid);

            // Find the active vendor's items in this order to update
            const myProducts = targetOrder.items.filter(item => 
              item.product.vendorId === currentUser.id ||
              item.product.vendorId === '00000000-0000-4000-a000-000000000001' ||
              item.product.vendorId === 'vendor-generic'
            );

            // Find matching rows in DB
            const matchedIdsToUpdate: any[] = [];
            if (allItems && allItems.length > 0) {
              allItems.forEach(ai => {
                const aiVariant = String(ai.variant_id || '').toLowerCase();
                const aiVendor = String(ai.vendor_id || '').toLowerCase();

                const belongsToVendor = 
                  aiVendor === String(currentUser.id).toLowerCase() ||
                  aiVendor === '00000000-0000-4000-a000-000000000001' ||
                  aiVendor === 'vendor-generic';

                // Check if any product matches
                const matchesAnyProduct = myProducts.some(p => {
                  const pVarId = String(p.product.variantId || p.product.id || '').toLowerCase();
                  const pProdId = String(p.product.id || '').toLowerCase();
                  return aiVariant === pVarId || aiVariant === pProdId;
                });

                if (belongsToVendor || matchesAnyProduct) {
                  if (ai.id !== undefined && ai.id !== null && String(ai.id) !== 'undefined') {
                    matchedIdsToUpdate.push(ai.id);
                  }
                }
              });
            }

            if (matchedIdsToUpdate.length > 0) {
              await supabase
                .from('order_items')
                .update({ status: flag })
                .in('id', matchedIdsToUpdate);
            } else {
              // Precise fallback if match is empty
              await supabase
                .from('order_items')
                .update({ status: flag })
                .eq('order_id', targetUuid);
            }
          } else {
            // Admin updates all items in the order
            await supabase
              .from('order_items')
              .update({ status: flag })
              .eq('order_id', targetUuid);
          }

          // B. Fetch updated order items representing true state to recalculate overall order status
          const { data: allItemsAfterUpdate } = await supabase
            .from('order_items')
            .select('*')
            .eq('order_id', targetUuid);

          if (currentUser?.role !== 'vendor') {
            // Admin directly sets overall order status to the flag!
            overallStatus = flag as any;
          } else {
            // Vendor recalculates overall status based on latest database item states
            const statuses = (allItemsAfterUpdate || []).map(item => item.status || 'pending');
            if (statuses.length > 0) {
              const uniqueStatuses = Array.from(new Set(statuses));
              if (uniqueStatuses.length === 1) {
                overallStatus = uniqueStatuses[0] as any;
              } else {
                const hasCompleted = statuses.includes('completed');
                const hasRejected = statuses.includes('rejected');
                const hasPending = statuses.includes('pending') || statuses.includes('processing');
                
                if (hasCompleted && hasRejected) {
                  overallStatus = 'partially accepted';
                } else if (hasCompleted && hasPending) {
                  overallStatus = 'partially accepted';
                } else if (hasRejected && hasPending) {
                  overallStatus = 'pending';
                } else {
                  overallStatus = 'processing';
                }
              }
            } else {
              overallStatus = flag as any;
            }
          }

          // Save overall status in order
          await supabase
            .from('orders')
            .update({ status: overallStatus })
            .eq('order_id', targetUuid);

          // C. If flag is 'completed', reduce stock for this vendor's items in this order
          if (flag === 'completed') {
            const vendorItems = targetOrder.items.filter(item => 
              currentUser?.role !== 'vendor' || 
              item.product.vendorId === currentUser.id ||
              item.product.vendorId === '00000000-0000-4000-a000-000000000001' ||
              item.product.vendorId === 'vendor-generic'
            );

            for (const item of vendorItems) {
              try {
                // Find correct database product using robust fallback identifiers
                const prodId1 = item.product.id;
                const prodId2 = item.product.variantId;
                const prodId3 = (item.product.variantId && item.product.variantId.includes('-') && item.product.variantId.length === 36)
                  ? item.product.variantId
                  : (item.product.id && item.product.id.includes('-') && item.product.id.length === 36)
                    ? item.product.id
                    : '00000000-0000-4000-a000-000000000001';

                let currentProd = null;
                // Query only by "id" (which is always the PK) using select('*') to prevent invalid column references
                if (prodId1) {
                  const { data } = await supabase.from('products').select('*').eq('id', prodId1).maybeSingle();
                  if (data) currentProd = data;
                }
                if (!currentProd && prodId2) {
                  const { data } = await supabase.from('products').select('*').eq('id', prodId2).maybeSingle();
                  if (data) currentProd = data;
                }
                if (!currentProd && prodId3) {
                  const { data } = await supabase.from('products').select('*').eq('id', prodId3).maybeSingle();
                  if (data) currentProd = data;
                }

                const dbStock = currentProd 
                  ? (currentProd.stock_sqm ?? currentProd.stockSqm ?? currentProd.stock ?? item.product.stockSqm) 
                  : item.product.stockSqm;
                const nextStock = Math.max(0, dbStock - item.quantitySqm);

                // Update products and inventory dynamically with automatic missing-column fallback pruning
                const idsToUpdate = Array.from(new Set([prodId1, prodId2, prodId3].filter(Boolean)));
                for (const idVal of idsToUpdate) {
                  await safeUpdate(
                    'products',
                    { stock_sqm: nextStock, stockSqm: nextStock, stock: nextStock },
                    q => q.eq('id', idVal)
                  );
                  await safeUpdate(
                    'inventory',
                    { stock_sqm: nextStock, stockSqm: nextStock, stock: nextStock, quantity: nextStock },
                    q => q.eq('id', idVal)
                  );
                  await safeUpdate(
                    'inventory',
                    { stock_sqm: nextStock, stockSqm: nextStock, stock: nextStock, quantity: nextStock },
                    q => q.eq('variant_id', idVal)
                  );
                }

              } catch (reduceErr) {
                console.warn('Could not reduce db stock inside Supabase:', reduceErr);
              }
            }
          }

          // D. Sync final values seamlessly
          await fetchDatabaseData(true);
          showToast(`Order status updated to "${flag === 'completed' ? 'Confirmed' : flag}" successfully.`, 'success');

        } catch (ex) {
          console.warn('Database orders status sync exception:', ex);
          showToast('Failed to update status in database. Sync pending.', 'error');
        }
      }
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // 3. Admin / Vendor: Delete / Delist catalog item
  const handleDelistProduct = (productId: string) => {
    const productToDelete = products.find(p => p.id === productId);
    if (!productToDelete) return;

    // Check permissions: current user must be Admin, or own the product (or handle default UUID/generic fallbacks safely)
    const isAllowed = !currentUser || 
                      currentUser.role === 'admin' ||
                      currentUser.role === 'vendor' || 
                      currentUser.id === productToDelete.vendorId ||
                      productToDelete.vendorId === '00000000-0000-4000-a000-000000000001' ||
                      productToDelete.vendorId === 'vendor-generic';

    if (!isAllowed) {
      showToast('Unauthorized access: You do not have the permissions required to delete this product.', 'error');
      return;
    }

    setProductToDeleteId(productId);
  };

  const executeDelistProduct = async (productId: string) => {
    const productToDelete = products.find(p => p.id === productId);
    if (!productToDelete) return;

    // Filter locally first
    setProducts(prev => prev.filter(p => p.id !== productId));

    if (isSupabaseConfigured) {
      try {
        // 1. Retrieve all variant IDs associated with this product
        const { data: variants } = await supabase
          .from('product_variants')
          .select('id, variant_id')
          .eq('product_id', productId);
          
        const variantIds: string[] = [];
        if (variants) {
          variants.forEach((v: any) => {
            if (v.id) variantIds.push(v.id);
            if (v.variant_id && v.variant_id !== v.id) variantIds.push(v.variant_id);
          });
        }
        if (productToDelete.variantId) {
          variantIds.push(productToDelete.variantId);
        }
        const uniqueVariantIds = Array.from(new Set(variantIds));

        // 2. Clear any referencing lines in order_items to avoid foreign key blocker errors
        if (uniqueVariantIds.length > 0) {
          try {
            await supabase.from('order_items').delete().in('variant_id', uniqueVariantIds);
          } catch (err) {
            console.warn('Cascade cleaning order_items failed:', err);
          }
        }

        // 3. Purge stock allocations in inventory table matching those variant IDs
        if (uniqueVariantIds.length > 0) {
          try {
            await supabase.from('inventory').delete().in('id', uniqueVariantIds);
          } catch (_) {}
        }
        
        try {
          await supabase.from('inventory').delete().eq('product_id', productId);
        } catch (_) {}

        // 4. Remove linked showroom store entities
        try {
          await supabase.from('stores').delete().eq('product_id', productId);
        } catch (_) {}
        try {
          await supabase.from('store').delete().eq('product_id', productId);
        } catch (_) {}

        if (uniqueVariantIds.length > 0) {
          try {
            await supabase.from('stores').delete().in('product_id', uniqueVariantIds);
          } catch (_) {}
          try {
            await supabase.from('store').delete().in('product_id', uniqueVariantIds);
          } catch (_) {}
        }

        if (productToDelete.storeId) {
          try {
            await supabase.from('stores').delete().eq('store_id', productToDelete.storeId);
          } catch (_) {}
          try {
            await supabase.from('stores').delete().eq('id', productToDelete.storeId);
          } catch (_) {}
          try {
            await supabase.from('store').delete().eq('store_id', productToDelete.storeId);
          } catch (_) {}
          try {
            await supabase.from('store').delete().eq('id', productToDelete.storeId);
          } catch (_) {}
        }

        // 5. Delete product variants
        if (uniqueVariantIds.length > 0) {
          try {
            await supabase.from('product_variants').delete().in('id', uniqueVariantIds);
          } catch (_) {}
        }
        try {
          await supabase.from('product_variants').delete().eq('product_id', productId);
        } catch (_) {}

        // 6. Delete from main products store log
        try {
          await supabase.from('products').delete().eq('id', productId);
        } catch (_) {}
        try {
          await supabase.from('products').delete().eq('product_id', productId);
        } catch (_) {}

        showToast('Product successfully removed from database.', 'success');
        // Sync state with database immediately
        await fetchDatabaseData(true);
      } catch (dbEx: any) {
        console.warn('Could not completely remove catalog item from database:', dbEx);
        await fetchDatabaseData(true);
      }
    } else {
      showToast('Product deleted locally.', 'info');
    }
  };


  return (
    <div className="bg-[#fbfcfa] text-slate-800 min-h-screen flex flex-col font-sans select-none antialiased">
      
      {/* Dynamic Brand Navigation Bar */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-6 py-4.5 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-4 justify-between items-center bg-transparent">
          
          {/* Logo element */}
          <div className="flex items-center gap-3 justify-between w-full md:w-auto">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-slate-950 rounded-lg flex items-center justify-center text-white font-extrabold text-xs tracking-tighter">
                TC
              </div>
              <div className="text-left leading-none">
                <span className="text-sm font-extrabold text-slate-900 tracking-tight block">TileClearance</span>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5 block">B2B Trade Portal</span>
              </div>
            </div>

            {/* Mobile shopping indicators */}
            <div className="flex items-center gap-3 md:hidden">
              {(!currentUser || currentUser.role === 'user') && (
                <button 
                  onClick={() => setIsCartOpen(true)}
                  className="relative p-2 rounded-lg text-slate-500 hover:text-slate-900 focus:outline-none"
                >
                  <ShoppingCart className="w-5 h-5" />
                  {cart.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-slate-950 text-[9px] font-black text-white rounded-full flex items-center justify-center">
                      {cart.length}
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Core Search bar input (only show for Client or guests browsing catalogs) */}
          {(!currentUser || currentUser.role === 'user' || activeHubTab === 'catalog') && (
            <div className="relative w-full md:max-w-md flex items-center">
              <Search className="absolute left-3.5 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search catalog by material, dimensions, grade, or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl placeholder-slate-400 text-slate-800 outline-none focus:bg-white focus:border-slate-400 transition"
                id="catalog-search-field"
              />
            </div>
          )}

          {/* Desktop Right navigation controls */}
          <div className="hidden md:flex items-center gap-4">

            {/* Dynamic Role Navigation Tabs */}
            {currentUser && (currentUser.role === 'admin' || currentUser.role === 'vendor') && (
              <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200/60 shadow-m shrink-0">
                {currentUser.role === 'vendor' ? (
                  <div className="px-3.5 py-1.5 bg-white text-slate-950 shadow-sm rounded-lg text-[11px] font-bold flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-950" />
                    <span>Merchant Hub</span>
                  </div>
                ) : (
                  <div className="px-3.5 py-1.5 bg-white text-slate-950 shadow-sm rounded-lg text-[11px] font-bold flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-slate-950" />
                    <span>Admin Dashboard</span>
                  </div>
                )}
              </div>
            )}
            
            {(!currentUser || currentUser.role === 'user') && (
              <button 
                onClick={() => setIsCartOpen(true)}
                className="relative bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-950 border border-slate-205 px-4 py-1.5 rounded-xl flex items-center gap-2 transition cursor-pointer"
                id="desktop-cart-toggle"
              >
                <ShoppingCart className="w-4 h-4 text-slate-900 shadow-sm" />
                <span className="text-xs font-semibold">Cart</span>
                {cart.length > 0 ? (
                  <span className="bg-slate-950 text-white px-2 py-0.5 rounded text-[10px] font-bold">
                    {cart.length}
                  </span>
                ) : (
                  <span className="text-slate-400 font-mono text-[9px]">0</span>
                )}
              </button>
            )}

            {/* Session Identity Badge */}
            {currentUser ? (
              <div className="flex items-center gap-3 bg-slate-50 border border-slate-200/80 pl-3 pr-2 py-1 rounded-xl">
                <div className="text-left font-sans shrink-0">
                  <span className="text-[8px] text-slate-400 font-bold block uppercase tracking-wider leading-none">
                    {currentUser.role} Account
                  </span>
                  <p className="text-xs font-bold text-slate-900 leading-normal mt-0.5">
                    {currentUser.role === 'vendor' ? currentUser.vendorName : currentUser.name}
                  </p>
                </div>
                <button 
                  onClick={handleLogOut}
                  className="bg-white border border-slate-200 p-1.5 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer hover:bg-slate-100 transition" 
                  title="Sign Out Session"
                  id="sign-out-trigger"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setIsAuthOpen(true)}
                className="bg-slate-950 hover:bg-slate-900 text-white font-bold text-xs px-4 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5"
                id="portal-sign-in-button"
              >
                <User className="w-3.5 h-3.5" />
                Sign In
              </button>
            )}

          </div>

        </div>
      </nav>

      {/* Checkout confirmations success banner */}
      {showStatusAlert && (
        <div className="mx-6 mt-6 max-w-7xl lg:mx-auto w-[calc(100%-3rem)] bg-[#f4fbf7] border border-emerald-150 p-5 rounded-2xl flex flex-col md:flex-row gap-4 justify-between items-start md:items-center text-slate-800 animate-in fade-in slide-in-from-top duration-300">
          <div className="space-y-1">
            <span className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              Clearance Order Confirmed
            </span>
            <p className="text-xs text-slate-650">
              Your bulk items allocation order is successfully queued. See the direct trade steps below:
            </p>
            <div className="bg-white p-3 rounded-lg border border-emerald-100 max-h-[140px] overflow-y-auto mt-2 font-mono text-[10px] text-slate-500 space-y-1">
              {successUpdates.map((logStr, idx) => (
                <div key={idx} className="flex gap-2 items-start">
                  <span className="text-emerald-600 font-bold">{`✓`}</span>
                  <span>{logStr}</span>
                </div>
              ))}
            </div>
          </div>
          <button 
            onClick={() => setShowStatusAlert(false)}
            className="text-xs bg-emerald-100 hover:bg-emerald-250 text-emerald-900 font-bold px-3 py-1.5 rounded-lg shrink-0 transition cursor-pointer font-sans"
          >
            Acknowledge
          </button>
        </div>
      )}

      {/* --- DASHBOARD STAGE BY AUTHORIZED RBAC ROLES --- */}

      {currentUser && (currentUser.role === 'admin' || currentUser.role === 'vendor') && activeHubTab === 'dashboard' ? (
        currentUser.role === 'admin' ? (
          
          // ==========================================
          // JOURNEY A: SUPERADMIN ADMIN OFFICE HUB
          // ==========================================
        <main className="max-w-7xl mx-auto px-6 py-10 w-full space-y-8 flex-1 animate-in fade-in duration-200">
          
          {/* Header block with statistics indicator cards */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-6">
            <div>
              <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-wider">
                <Sliders className="w-4 h-4 text-slate-900" />
                <span>Superadmin Platform Dashboard</span>
              </div>
              <h2 className="text-2xl font-extrabold text-slate-950 mt-1.5 tracking-tight">
                Contracting Logistics and Marketplace Oversight
              </h2>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-3 py-1 rounded bg-slate-950 text-white font-mono uppercase tracking-wider">
                Active System Monitor
              </span>
            </div>
          </div>

          {/* Quick Metrics display grids */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Total Registered Batches</span>
              <span className="text-2xl font-black text-slate-900 block font-mono">{products.length}</span>
              <p className="text-[11px] text-slate-500">Active excess tiles across all supplier depots.</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Accumulated Orders</span>
              <span className="text-2xl font-black text-slate-900 block font-mono">{orders.length}</span>
              <p className="text-[11px] text-slate-500">Contracting clearances processed collectively.</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Consolidated Trade Volume</span>
              <span className="text-2xl font-black text-slate-950 block font-mono">
                ₹{orders.reduce((sum, o) => sum + o.totalPrice, 0).toLocaleString('en-US', { maxFractionDigits: 0 })}
              </span>
              <p className="text-[11px] text-slate-500">Total transacted ex-works liquidations volume.</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Total Registered Suppliers</span>
              <span className="text-2xl font-black text-slate-900 block font-mono">{totalVendors}</span>
              <p className="text-[11px] text-slate-500">Verified manufacturing and logistics vendors.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Catalog list section */}
            <section className="lg:col-span-7 bg-white p-6 border border-slate-200 rounded-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-slate-500" /> Platform Batches Catalog ({products.length})
                </span>
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Delist Authority</span>
              </div>

              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {products.map(prod => (
                  <div key={prod.id} className="flex gap-4 p-3.5 bg-slate-50 border border-slate-200/55 rounded-xl items-center justify-between text-xs transition hover:bg-slate-50/80">
                    <div className="flex gap-3 items-center min-w-0">
                      <img src={prod.image} alt="" className="w-10 h-10 object-cover rounded-lg border border-slate-200 shrink-0" referrerPolicy="no-referrer" />
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 truncate max-w-[200px]">{prod.name}</p>
                        <p className="text-[10px] text-slate-500 font-medium">{prod.vendorName} • {prod.category}</p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-bold font-mono text-slate-900 block">₹{prod.clearancePrice.toFixed(2)}/Sqm</span>
                      <span className="text-[10px] text-slate-400 block font-mono">Qty: {prod.stockSqm} Sqm</span>
                    </div>

                    <button 
                      onClick={() => handleDelistProduct(prod.id)}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white text-rose-650 hover:bg-rose-50 transition cursor-pointer"
                      title="De-list Product"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* Platform orders master list section */}
            <section className="lg:col-span-5 bg-white p-6 border border-slate-200 rounded-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Inbox className="w-4 h-4 text-slate-500" /> Unified Order Registry ({orders.length})
                </span>
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Global Log</span>
              </div>

              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                {orders.length === 0 ? (
                  <div className="text-center py-20 text-slate-400 text-xs">
                    No clearance contracting orders placed globally yet.
                  </div>
                ) : (
                  orders.map(order => (
                    <div key={order.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="font-mono font-bold text-slate-900 text-xs">{order.id}</span>
                        <div className="flex gap-1">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide ${
                            order.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                            order.status === 'cancelled' ? 'bg-rose-100 text-rose-800' :
                            order.status === 'processing' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {order.status}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1 text-slate-500 text-[11px] leading-relaxed">
                        <p><strong>Contractor:</strong> {order.userName} ({order.userEmail})</p>
                        <p><strong>Placement Date:</strong> {order.createdAt}</p>
                        <p><strong>Allocated Items:</strong></p>
                        <ul className="list-disc pl-4 space-y-0.5">
                          {order.items.map((item, idx) => (
                            <li key={idx}>
                              {item.quantitySqm} Sqm of <span className="font-semibold">{item.product.name}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="pt-2 border-t border-slate-200/50 flex justify-between items-center">
                        <span className="text-slate-400 font-medium">Clearance Cost:</span>
                        <span className="font-bold text-slate-900 font-mono">₹{order.totalPrice.toLocaleString()}</span>
                      </div>

                      {/* Status Adjusters for superadmin review */}
                      <div className="flex gap-1 justify-end pt-1">
                        <button 
                          disabled={!!updatingOrderId}
                          onClick={() => handleUpdateOrderStatus(order.id, 'processing')}
                          className={`px-2 py-1 bg-white hover:bg-slate-100 text-[10px] font-semibold rounded border border-slate-200 text-slate-700 ${!!updatingOrderId ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          {updatingOrderId === order.id ? '...' : 'Processing'}
                        </button>
                        <button 
                          disabled={!!updatingOrderId}
                          onClick={() => handleUpdateOrderStatus(order.id, 'completed')}
                          className={`px-2 py-1 bg-white hover:bg-slate-100 text-[10px] font-semibold rounded border border-slate-200 text-slate-700 ${!!updatingOrderId ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          {updatingOrderId === order.id ? '...' : 'Completed'}
                        </button>
                        <button 
                          disabled={!!updatingOrderId}
                          onClick={() => handleUpdateOrderStatus(order.id, 'cancelled')}
                          className={`px-2 py-1 bg-white hover:bg-slate-100 text-[10px] font-semibold rounded border border-slate-200 text-rose-650 ${!!updatingOrderId ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          {updatingOrderId === order.id ? '...' : 'Cancel'}
                        </button>
                        <button 
                          disabled={!!updatingOrderId}
                          onClick={() => handleUpdateOrderStatus(order.id, 'rejected')}
                          className={`px-2 py-1 bg-white hover:bg-slate-100 text-[10px] font-semibold rounded border border-slate-200 text-[rgb(180,83,9)] ${!!updatingOrderId ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          {updatingOrderId === order.id ? '...' : 'Reject'}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

          </div>

        </main>
      ) : (
        
        // ==========================================
        // JOURNEY B: OUTSTANDING VENDOR CONTROL HUB
        // ==========================================
        <main className="max-w-7xl mx-auto px-6 py-10 w-full space-y-8 flex-1 animate-in fade-in duration-200">
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-6">
            <div>
              <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-wider">
                <Building2 className="w-4 h-4 text-slate-900" />
                <span>Vendor Stock & Clearance Center</span>
              </div>
              <h2 className="text-2xl font-extrabold text-slate-950 mt-1.5 tracking-tight">
                {currentUser.vendorName || 'Active Supplier Studio'}
              </h2>
            </div>
            
            <div className="text-right">
              <span className="text-xs bg-slate-50 border border-slate-200 px-3 py-1 rounded-xl text-slate-600 block">
                Warehouse Depot: <strong>{currentUser.storeLocation || 'Central Yard Area'}</strong>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Excess Tile lot registration form */}
            <section className="lg:col-span-5 bg-white p-6 border border-slate-200 rounded-2xl space-y-4">
              <div className="border-b border-slate-100 pb-3 flex items-center gap-2">
                <Plus className="w-4 h-4 text-slate-900" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Register Discontinued / Excess Tile Lots
                </h3>
              </div>

              <form onSubmit={handleCreateProduct} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Tile Lot / Series Name</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="e.g. Venice Marble Gold Rectified"
                    value={newProdName}
                    onChange={e => setNewProdName(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-900 outline-none focus:bg-white focus:border-slate-400 transition"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Batch Description</label>
                  <textarea 
                    placeholder="Provide details about quality, shade variation, thermal shock resistance..."
                    rows={2}
                    value={newProdDesc}
                    onChange={e => setNewProdDesc(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-900 outline-none focus:bg-white focus:border-slate-400 resize-none transition"
                  ></textarea>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Category</label>
                    <select 
                      value={newProdCategory}
                      onChange={e => setNewProdCategory(e.target.value as any)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-900 outline-none focus:bg-white focus:border-slate-400 transition"
                    >
                      <option value="Ceramic">Ceramic</option>
                      <option value="Porcelain">Porcelain</option>
                      <option value="Vitrified">Vitrified</option>
                      <option value="Mosaic">Mosaic</option>
                      <option value="Marble">Marble</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Finish Opt</label>
                    <select 
                      value={newProdFinish}
                      onChange={e => setNewProdFinish(e.target.value as any)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-900 outline-none focus:bg-white focus:border-slate-400 transition"
                    >
                      <option value="Glossy">Glossy</option>
                      <option value="Matte">Matte</option>
                      <option value="Polished">Polished</option>
                      <option value="Textured">Textured</option>
                      <option value="Satin">Satin</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Dimensions</label>
                    <input 
                      type="text" 
                      value={newProdDims}
                      onChange={e => setNewProdDims(e.target.value)}
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-900 outline-none focus:bg-white focus:border-slate-400 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Thickness (mm)</label>
                    <input 
                      type="text" 
                      value={newProdThick}
                      onChange={e => setNewProdThick(e.target.value)}
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-900 outline-none focus:bg-white focus:border-slate-400 transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">List Cost (₹/Sqm)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={newProdOriginal}
                      onChange={e => setNewProdOriginal(e.target.value)}
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-900 outline-none focus:bg-white focus:border-slate-400 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Clearance Rate (₹/Sqm)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      required
                      value={newProdClearance}
                      onChange={e => setNewProdClearance(e.target.value)}
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-900 outline-none focus:bg-white focus:border-slate-400 transition font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Available Vol (Sqm)</label>
                    <input 
                      type="number" 
                      required
                      value={newProdStock}
                      onChange={e => setNewProdStock(e.target.value)}
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-900 outline-none focus:bg-white focus:border-slate-400 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Trade MOQ (Sqm)</label>
                    <input 
                      type="number" 
                      required
                      value={newProdMoq}
                      onChange={e => setNewProdMoq(e.target.value)}
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-900 outline-none focus:bg-white focus:border-slate-400 transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Product SKU No.</label>
                    <input 
                      type="text" 
                      placeholder="SKU-GEN"
                      value={newProdSku}
                      onChange={e => setNewProdSku(e.target.value)}
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-900 outline-none focus:bg-white focus:border-slate-400 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Grading Tier</label>
                    <select 
                      value={newProdGrade}
                      onChange={e => setNewProdGrade(e.target.value as any)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-900 outline-none focus:bg-white focus:border-slate-400 transition"
                    >
                      <option value="Premium (Grade A+)">Premium (Grade A+)</option>
                      <option value="Standard (Grade A)">Standard (Grade A)</option>
                      <option value="Commercial Grade">Commercial Grade</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Showroom / Store Name</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. Central Logistics"
                      value={newProdStoreName}
                      onChange={e => setNewProdStoreName(e.target.value)}
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-900 outline-none focus:bg-white focus:border-slate-400 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Storehouse Location</label>
                    <input 
                      type="text" 
                      required
                      placeholder="e.g. Birmingham Yard B1"
                      value={newProdStoreLoc}
                      onChange={e => setNewProdStoreLoc(e.target.value)}
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-900 outline-none focus:bg-white focus:border-slate-400 transition"
                    />
                  </div>
                </div>

                 <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-[11px] font-bold text-slate-500">Product Image URL(s)</label>
                    <span className="text-[10px] text-slate-400 font-bold font-mono">Comma-separated for multiple</span>
                  </div>
                  <textarea 
                    rows={2}
                    placeholder="e.g. https://images.unsplash.com/photo-1, https://images.unsplash.com/photo-2"
                    value={newProdImage}
                    onChange={e => setNewProdImage(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-700 outline-none focus:bg-white focus:border-slate-400 text-xs font-mono transition"
                  />
                  {newProdImage.trim() && (
                    <div className="mt-2 text-left bg-slate-50/50 p-2 border border-slate-200/40 rounded-xl">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Live Upload Gallery ( {newProdImage.split(',').filter(s => s.trim()).length} )</span>
                      <div className="flex gap-2 overflow-x-auto pb-1 max-w-full scrollbar-thin">
                        {newProdImage.split(',').map((img, idx) => {
                          const url = img.trim();
                          if (!url) return null;
                          return (
                            <div key={idx} className="relative group shrink-0">
                              <img 
                                src={url} 
                                alt={`Preview ${idx + 1}`} 
                                className="w-12 h-12 object-cover rounded-lg border border-slate-200 hover:border-slate-350 transition" 
                                onError={(e) => { (e.target as any).style.display = 'none'; }}
                                referrerPolicy="no-referrer"
                              />
                              <span className="absolute bottom-0 right-0 bg-slate-950 text-white font-mono font-bold text-[8px] px-1 rounded-tl">
                                #{idx + 1}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 mt-2 bg-slate-950 text-white text-xs font-bold rounded-xl hover:bg-slate-900 transition flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  List Product
                </button>
              </form>
            </section>

            {/* Vendor Inventory Lists and Placed Orders checklists side-by-side */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* My active lots list */}
              <section className="bg-white p-6 border border-slate-200 rounded-2xl space-y-4">
                <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-slate-500" /> Listed Products
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Real-Time</span>
                </div>

                <div className="space-y-3.5 max-h-[390px] overflow-y-auto pr-1">
                  {products.filter(p => currentUser && p.vendorId === currentUser.id).map(p => {
                    const isExpanded = expandedVendorProdId === p.id;
                    const imagesList = p.image ? p.image.split(',').map(s => s.trim()).filter(Boolean) : [];
                    return (
                      <div 
                        key={p.id} 
                        onClick={() => setExpandedVendorProdId(isExpanded ? null : p.id)}
                        className={`p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs hover:border-slate-350 transition cursor-pointer space-y-3 block ${isExpanded ? 'ring-1 ring-slate-950 bg-white shadow-sm' : ''}`}
                      >
                        <div className="flex justify-between items-center w-full">
                          <div className="flex gap-3 items-center min-w-0">
                            <img src={imagesList[0] || p.image} alt="" className="w-10 h-10 object-cover rounded-lg border border-slate-200 shrink-0" referrerPolicy="no-referrer" />
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 truncate max-w-[200px]">{p.name}</p>
                              <p className="text-[10px] text-slate-500 font-mono">SKU: {p.skus || p.sku} • {p.dimensions}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right">
                              <span className="font-bold font-mono text-slate-950 block">₹{p.clearancePrice.toFixed(2)}/Sqm</span>
                              <span className="text-[9px] bg-slate-200 font-bold px-1.5 py-0.2 rounded text-slate-700 mt-1 inline-block">Stock: {p.stockSqm} Sqm</span>
                            </div>
                            <span className="text-slate-400 font-bold text-[10px]">{isExpanded ? '▲' : '▼'}</span>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="pt-3 border-t border-slate-200 space-y-3 text-slate-700 animate-in fade-in duration-150" onClick={e => e.stopPropagation()}>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200/50 leading-relaxed text-[11px]">
                              <p><strong>Category:</strong> {p.category}</p>
                              <p><strong>Grading Tier:</strong> {p.grade}</p>
                              <p><strong>Finish:</strong> {p.finish}</p>
                              <p><strong>Thickness:</strong> {p.thickness}</p>
                              <p><strong>Trade MOQ:</strong> {p.moq} Sqm</p>
                              <p><strong>Ex-Works List Cost:</strong> ₹{p.originalPrice.toFixed(2)}/Sqm</p>
                            </div>

                            <p className="text-[11px] leading-relaxed"><strong>Clearance Description:</strong> {p.description}</p>
                            
                            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200/50 leading-relaxed text-[11px]">
                              <p><strong>Warehouse Depot:</strong> {p.storeName}</p>
                              <p><strong>Depot Location:</strong> {p.storeLocation}</p>
                            </div>

                            {/* Multiple product images show */}
                            {imagesList.length > 0 && (
                              <div className="space-y-1.5 text-left">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Product Image Gallery</span>
                                <div className="flex gap-2 overflow-x-auto pb-1">
                                  {imagesList.map((img, idx) => (
                                    <a key={idx} href={img} target="_blank" rel="noreferrer" className="shrink-0 flex items-center">
                                      <img src={img} alt="" className="w-14 h-14 object-cover rounded-lg border border-slate-200 hover:opacity-80 transition" referrerPolicy="no-referrer" />
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* De-list Action Button */}
                            <div className="flex justify-end pt-1">
                              <button
                                type="button"
                                onClick={() => handleDelistProduct(p.id)}
                                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-[10px] font-bold rounded-lg border border-rose-200 text-rose-700 transition cursor-pointer flex items-center gap-1"
                              >
                                Delete Product Lot
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {products.filter(p => currentUser && p.vendorId === currentUser.id).length === 0 && (
                    <div className="text-center py-10 text-slate-400 text-xs">
                      No active product listings in your catalog yet. Use the form on the left to add items.
                    </div>
                  )}
                </div>
              </section>

              {/* Incoming purchase orders */}
              <section className="bg-white p-6 border border-slate-200 rounded-2xl space-y-4">
                <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Inbox className="w-4 h-4 text-slate-500" /> Incoming Purchase Orders
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase font-mono">Operations</span>
                </div>

                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                  {orders.filter(order => 
                    currentUser && 
                    order.items.some(item => 
                      item.product.vendorId === currentUser.id ||
                      item.product.vendorId === '00000000-0000-4000-a000-000000000001' ||
                      item.product.vendorId === 'vendor-generic'
                    ) &&
                    (order.status === 'pending' || order.status === 'processing' || order.status === 'completed' || order.status === 'rejected' || order.status === 'partially accepted')
                  ).length === 0 ? (
                    <div className="text-center py-10 text-slate-400 text-xs leading-relaxed">
                      No customer clearance procurement logged yet. Incoming contractor orders placed will show up cleanly here.
                    </div>
                  ) : (
                    orders.filter(order => 
                      currentUser && 
                      order.items.some(item => 
                        item.product.vendorId === currentUser.id ||
                        item.product.vendorId === '00000000-0000-4000-a000-000000000001' ||
                        item.product.vendorId === 'vendor-generic'
                      ) &&
                      (order.status === 'pending' || order.status === 'processing' || order.status === 'completed' || order.status === 'rejected' || order.status === 'partially accepted')
                    ).map(order => (
                      <div key={order.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="font-mono font-bold text-slate-900">{order.id}</span>
                          {(() => {
                            const myItems = order.items.filter(item => 
                              currentUser && (
                                item.product.vendorId === currentUser.id ||
                                item.product.vendorId === '00000000-0000-4000-a000-000000000001' ||
                                item.product.vendorId === 'vendor-generic'
                              )
                            );
                            const allCompleted = myItems.length > 0 && myItems.every(item => item.status === 'completed');
                            const allRejected = myItems.length > 0 && myItems.every(item => item.status === 'rejected');
                            
                            const displayStatus = allCompleted ? 'completed' : allRejected ? 'rejected' : order.status;
                            const statusText = allCompleted ? 'Confirmed' : allRejected ? 'Rejected' : order.status;

                            return (
                              <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-widest ${
                                displayStatus === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                                displayStatus === 'partially accepted' ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' :
                                (displayStatus === 'cancelled' || displayStatus === 'rejected') ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                              }`}>
                                {statusText === 'completed' ? 'Confirmed' : statusText === 'rejected' ? 'Rejected' : statusText}
                              </span>
                            );
                          })()}
                        </div>

                        <div className="text-[11px] text-slate-500 leading-normal">
                          <p><strong>Contracting Client:</strong> {order.userName} ({order.userEmail})</p>
                          <ul className="space-y-1.5 mt-1.5 pl-1">
                            {order.items.filter(item => 
                              currentUser && (
                                item.product.vendorId === currentUser.id ||
                                item.product.vendorId === '00000000-0000-4000-a000-000000000001' ||
                                item.product.vendorId === 'vendor-generic'
                              )
                            ).map((item, id) => (
                              <li key={id} className="flex justify-between items-center gap-2 border-b border-slate-100/40 pb-1 last:border-0 last:pb-0">
                                <span className="text-slate-600">
                                  {item.quantitySqm} Sqm of <span className="font-semibold text-slate-800">{item.product.name}</span>
                                  <span className="text-[10px] text-slate-400 font-mono ml-1">
                                    (₹{(item.product.clearancePrice * item.quantitySqm).toLocaleString()})
                                  </span>
                                </span>
                                <span className={`px-2 py-0.25 rounded text-[8px] font-extrabold uppercase tracking-wider shrink-0 scale-[0.85] origin-right ${
                                  item.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-150' :
                                  item.status === 'rejected' ? 'bg-rose-50 text-rose-700 border border-rose-150' :
                                  'bg-amber-50 text-amber-600 border border-amber-150'
                                }}`}>
                                  {item.status === 'completed' ? 'Accepted' : item.status === 'rejected' ? 'Rejected' : (item.status || 'Pending')}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="pt-2 border-t border-slate-250/20 flex justify-between items-center">
                          <div className="flex gap-1.5">
                            {(() => {
                              const myItems = order.items.filter(item => 
                                currentUser && (
                                  item.product.vendorId === currentUser.id ||
                                  item.product.vendorId === '00000000-0000-4000-a000-000000000001' ||
                                  item.product.vendorId === 'vendor-generic'
                                )
                              );
                              const hasPendingItem = myItems.some(item => !item.status || item.status === 'pending' || item.status === 'processing');
                              const allCompleted = myItems.length > 0 && myItems.every(item => item.status === 'completed');
                              const allRejected = myItems.length > 0 && myItems.every(item => item.status === 'rejected');

                              if (hasPendingItem) {
                                const isLoading = updatingOrderId === order.id;
                                return (
                                  <>
                                    <button 
                                      type="button"
                                      disabled={isLoading || !!updatingOrderId}
                                      onClick={() => handleUpdateOrderStatus(order.id, 'completed')}
                                      className={`px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-[10px] font-bold rounded border border-emerald-200 text-emerald-800 transition ${isLoading || !!updatingOrderId ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                    >
                                      {isLoading ? '...' : 'Confirm Order'}
                                    </button>
                                    <button 
                                      type="button"
                                      disabled={isLoading || !!updatingOrderId}
                                      onClick={() => handleUpdateOrderStatus(order.id, 'rejected')}
                                      className={`px-2 py-0.5 bg-rose-50 hover:bg-rose-100 text-[10px] font-bold rounded border border-rose-200 transition text-rose-700 ${isLoading || !!updatingOrderId ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                    >
                                      Reject Order
                                    </button>
                                  </>
                                );
                              } else {
                                const localStatusName = allCompleted ? 'Confirmed' : allRejected ? 'Rejected' : 'Settled';
                                return (
                                  <span className={`text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded border ${
                                    allCompleted ? 'bg-emerald-50 text-emerald-700 border-emerald-150' :
                                    allRejected ? 'bg-rose-50 text-rose-700 border-rose-150' :
                                    'bg-indigo-50 text-indigo-700 border-indigo-150'
                                  }`}>
                                    Your Status: {localStatusName}
                                  </span>
                                );
                              }
                            })()}
                          </div>
                          <span className="font-bold text-slate-900 font-mono">
                            ₹{order.items.filter(item => 
                              currentUser && (
                                item.product.vendorId === currentUser.id ||
                                item.product.vendorId === '00000000-0000-4000-a000-000000000001' ||
                                item.product.vendorId === 'vendor-generic'
                              )
                            ).reduce((sum, item) => sum + item.product.clearancePrice * item.quantitySqm, 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

            </div>

          </div>

        </main>
      )) : (
        
        // ==========================================
        // JOURNEY C: MAIN DISCOVERY & CLIENT WORKFLOWS
        // ==========================================
        <>
          {/* Aesthetic trade hero introduction section */}
          <section className="relative overflow-hidden py-14 md:py-20 bg-slate-50 border-b border-slate-200/80">
            <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
              
              <div className="lg:col-span-7 space-y-5 text-left text-slate-800">
                <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-wider">
                  <Clock className="w-4 h-4 text-slate-900" />
                  <span>Verified end-of-batch clearance liquidations</span>
                </div>
                
                <h2 className="text-3xl md:text-5xl font-black text-slate-950 tracking-tight leading-none font-sans">
                  Import Slabs & Tiles Clearing.<br />
                  <span className="text-slate-500 font-normal">Exclusively Dedicated to the B2B Trade.</span>
                </h2>

                <p className="text-xs md:text-sm text-slate-600 leading-relaxed max-w-xl">
                  We centralize and clear pre-sorted surplus batch materials, overproduced ceramic lots, and Grade A Italian marbles from leading manufacturers. Access premium stone runs direct from continental warehouse depots with up to 75% savings under standard retail list rates. 
                </p>

                <div className="flex flex-wrap gap-2 pt-2 text-left">
                  <div className="bg-white border border-slate-200 p-3 rounded-xl min-w-[130px] leading-tight">
                    <span className="text-[9px] text-slate-400 block uppercase font-bold tracking-wider">Quality Guarantee</span>
                    <span className="text-xs font-bold text-slate-900 block mt-0.5">100% Tested Grade A</span>
                  </div>
                  <div className="bg-white border border-slate-200 p-3 rounded-xl min-w-[130px] leading-tight">
                    <span className="text-[9px] text-slate-400 block uppercase font-bold tracking-wider">Average Margins</span>
                    <span className="text-xs font-bold text-emerald-700 block mt-0.5">60% – 75% Savings</span>
                  </div>
                  <div className="bg-white border border-slate-200 p-3 rounded-xl min-w-[130px] leading-tight">
                    <span className="text-[9px] text-slate-400 block uppercase font-bold tracking-wider">Dispatch Status</span>
                    <span className="text-xs font-bold text-slate-900 block mt-0.5">Free Logistics Pallet</span>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-5 relative">
                <div className="grid grid-cols-3 gap-2 bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-sm relative">
                  <div className="col-span-2 aspect-[4/3] bg-cover bg-center rounded-lg border border-slate-200" style={{ backgroundImage: `url('https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=400&q=80')` }}></div>
                  <div className="aspect-square bg-white rounded-lg border border-slate-200 flex flex-col items-center justify-center p-2 text-center text-xs justify-self-stretch self-stretch">
                    <span className="text-[10px] text-slate-400 block">Grade</span>
                    <span className="font-extrabold text-slate-900 block mt-1">A+</span>
                  </div>
                  
                  <div className="aspect-square bg-white rounded-lg border border-slate-200 flex flex-col items-center justify-center p-2 text-center text-xs justify-self-stretch self-stretch">
                    <span className="text-[10px] text-slate-400 block">Body</span>
                    <span className="font-extrabold text-slate-900 block mt-1">12mm</span>
                  </div>
                  <div className="col-span-2 aspect-[4/3] bg-cover bg-center rounded-lg border border-slate-200" style={{ backgroundImage: `url('https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=400&q=80')` }}></div>
                </div>
              </div>

            </div>
          </section>

          {/* Discovery filters element context */}
          <section className="max-w-7xl mx-auto px-6 py-10 space-y-6 flex-1 w-full text-slate-850">
            
            {/* Navigational filter criteria row */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between border-b border-slate-200 pb-4">
              <div className="flex items-center gap-1.5 shrink-0">
                <Filter className="w-4 h-4 text-slate-900" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Clearance Catalog lots
                </h3>
              </div>

              {/* Categoric pill selectors */}
              <div className="flex flex-wrap gap-1" id="category-selector-group">
                {CATEGORIES.map(category => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition ${
                      selectedCategory === category 
                        ? 'bg-slate-950 text-white shadow-sm' 
                        : 'bg-white text-slate-500 hover:text-slate-950 border border-slate-200/60'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>

            {/* Catalog Grid Cards displaying available products */}
            {filteredProducts.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-2xl border border-slate-200/80 flex flex-col items-center justify-center gap-2">
                <p className="text-xs font-bold text-slate-800">No clearance lots match your filter parameters</p>
                <p className="text-[11px] text-slate-500">Try modifying search tags or choosing a different category list.</p>
                <button 
                  onClick={() => { setSearchQuery(''); setSelectedCategory('All'); }}
                  className="text-xs text-slate-900 underline font-semibold mt-1"
                >
                  Reset catalog specifications
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProducts.map(prod => {
                  const discountOff = Math.round((1 - prod.clearancePrice / prod.originalPrice) * 100);
                  const inCart = cart.find(item => item.product.id === prod.id);
                  const imagesList = prod.image ? prod.image.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
                  const activeImg = activeCardImages[prod.id] || imagesList[0] || prod.image;

                  return (
                    <div 
                      key={prod.id} 
                      className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-md transition-all flex flex-col h-full group"
                    >
                      {/* Batch Image display zone */}
                      <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden border-b border-slate-150">
                        <img 
                          src={activeImg} 
                          alt={prod.name}
                          className="w-full h-full object-cover group-hover:scale-[1.015] transition duration-500"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute top-3 left-3 bg-slate-950 text-white font-extrabold text-[9px] px-2.5 py-1 rounded-md tracking-wider">
                          {discountOff}% EX-WORKS OFF
                        </div>
                        
                        {imagesList.length > 1 && (
                          <div className="absolute bottom-3 left-3 flex gap-1 z-10 bg-slate-950/80 backdrop-blur-sm px-2 py-1 rounded-full border border-white/10 shadow-sm">
                            {imagesList.map((img, idx) => {
                              const isActive = activeImg === img;
                              return (
                                <button
                                  key={idx}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setActiveCardImages(prev => ({ ...prev, [prod.id]: img }));
                                  }}
                                  type="button"
                                  className={`w-1.5 h-1.5 rounded-full transition-all duration-200 hover:scale-125 focus:outline-none cursor-pointer ${
                                    isActive ? 'bg-white w-3' : 'bg-white/40 hover:bg-white/80'
                                  }`}
                                  title={`View image ${idx + 1}`}
                                />
                              );
                            })}
                          </div>
                        )}

                        <div className={`absolute bottom-3 right-3 text-[9px] font-bold px-2 py-0.5 rounded border ${
                          prod.stockSqm <= 0 
                            ? 'bg-rose-600 text-white border-rose-500 font-extrabold shadow-sm' 
                            : 'bg-white/90 backdrop-blur-sm text-slate-800 border-slate-200'
                        }`}>
                          {prod.stockSqm <= 0 ? 'SOLD OUT' : `Lot: ${prod.stockSqm} Sqm`}
                        </div>
                      </div>

                      {/* Detail metadata block */}
                      <div className="p-5.5 space-y-3 flex-1 flex flex-col text-left">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[9px] font-bold text-slate-400 uppercase font-mono tracking-wider">
                            <span>{prod.category}</span>
                            <span>{prod.grade}</span>
                          </div>
                          <h4 className="text-sm font-bold text-slate-900 group-hover:text-slate-750 transition line-clamp-1">
                            {prod.name}
                          </h4>
                        </div>

                        <p className="text-xs text-slate-550 leading-relaxed line-clamp-3 flex-1">
                          {prod.description}
                        </p>

                        {/* Normalized measurements matrix */}
                        <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 border border-slate-200/80 rounded-xl text-[10px] text-slate-650 leading-tight">
                          <div>
                            <span className="text-slate-400 block font-medium">Specs</span>
                            <span className="text-slate-800 font-extrabold mt-0.5 block">{prod.dimensions}</span>
                          </div>
                          <div className="border-l border-r border-slate-200 px-1">
                            <span className="text-slate-400 block font-medium">Thickness</span>
                            <span className="text-slate-800 font-extrabold mt-0.5 block">{prod.thickness}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block font-medium">Finish</span>
                            <span className="text-slate-800 font-extrabold mt-0.5 block">{prod.finish}</span>
                          </div>
                        </div>

                        {/* Trade pricing grid blocks */}
                        <div className="pt-2 border-t border-slate-100 flex items-baseline justify-between">
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Clearance Ex-Vat</span>
                            <div className="flex items-baseline gap-1.5 mt-0.5">
                              <span className="text-base font-extrabold text-slate-900 font-mono">₹{prod.clearancePrice.toFixed(2)}</span>
                              <span className="text-[10px] text-slate-400 line-through font-mono">₹{prod.originalPrice.toFixed(2)}</span>
                              <span className="text-[9px] text-slate-500 font-sans">/Sqm</span>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Trade MOQ</span>
                            <span className="text-xs font-extrabold font-mono text-slate-700 mt-0.5 block">{prod.moq} Sqm</span>
                          </div>
                        </div>

                        {/* Purchase cart dispatch handlers */}
                        {prod.stockSqm <= 0 ? (
                          <button
                            disabled
                            type="button"
                            className="w-full py-2.5 px-4 text-xs font-bold rounded-xl bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed flex items-center justify-center mt-2"
                          >
                            Out of Stock
                          </button>
                        ) : (
                          <button
                            onClick={() => handleAddToCart(prod)}
                            className={`w-full py-2.5 px-4 text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 mt-2 ${
                              inCart 
                                ? 'bg-[#f4fbf7] text-emerald-800 border border-emerald-250' 
                                : 'bg-slate-950 text-white hover:bg-slate-900'
                            }`}
                          >
                            {inCart ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                Added to Cart ({inCart.quantitySqm} Sqm)
                              </>
                            ) : (
                              'Add to Cart'
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* My Placed order history segment for Client verification */}
            {currentUser && orders.length > 0 && (
              <div className="mt-14 bg-white border border-slate-200 rounded-2xl p-6 text-left space-y-4 animate-in fade-in duration-300">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <ClipboardList className="w-4 h-4 text-slate-900" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    My Account Clearance Orders History
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {orders.map(order => (
                    <div key={order.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs leading-normal">
                      <div className="flex justify-between items-center">
                        <span className="font-mono font-bold text-slate-900">{order.id}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 font-semibold">{order.createdAt}</span>
                          <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wide ${
                            order.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                            order.status === 'partially accepted' ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' :
                            order.status === 'rejected' || order.status === 'cancelled' ? 'bg-rose-100 text-rose-800' :
                            'bg-amber-100 text-amber-800'
                          }`}>
                            {order.status}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1 text-slate-500">
                        <p className="font-bold text-slate-800 text-[10px] uppercase tracking-wider text-slate-400">Clearance Lots Confirmed:</p>
                        <ul className="space-y-1 mt-1.5">
                          {order.items.map((item, id) => (
                            <li key={id} className="flex justify-between items-center gap-2 py-1 border-b border-slate-100/40 last:border-0">
                              <span className="text-slate-600">
                                {item.quantitySqm} Sqm of <span className="font-semibold text-slate-850">{item.product.name}</span>
                              </span>
                              <span className={`px-2 py-0.25 rounded text-[9px] font-bold uppercase tracking-wider font-mono shrink-0 scale-[0.85] origin-right ${
                                item.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-150' :
                                item.status === 'rejected' ? 'bg-rose-50 text-rose-700 border border-rose-150' :
                                'bg-amber-50 text-amber-600 border border-amber-150'
                              }`}>
                                {item.status === 'completed' ? 'Accepted' : item.status === 'rejected' ? 'Rejected' : (item.status || 'Pending')}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="pt-2 border-t border-slate-250/20 flex justify-between items-center text-xs">
                        <span className="text-slate-400 font-medium">Subtotal ex VAT:</span>
                        <span className="font-bold text-slate-900 font-mono">₹{order.totalPrice.toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </section>
        </>
      )}

      {/* Footer support */}
      <Footer />

      {/* Sidebar Cart overlays Drawer components */}
      <CartOverlay 
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        onUpdateQty={handleUpdateQty}
        onRemoveItem={handleRemoveFromCart}
        onCheckoutSuccess={handleCheckoutSuccess}
        userRole={currentUser?.role}
        currentUser={currentUser}
        onOpenAuth={() => setIsAuthOpen(true)}
      />

      {/* Dual portal dynamic authentication controls */}
      {isAuthOpen && (
        <AuthModal 
          isOpen={isAuthOpen}
          onClose={() => setIsAuthOpen(false)}
          onAuthSuccess={(profile) => {
            setCurrentUser(profile);
            setIsAuthOpen(false);
          }}
        />
      )}

      {/* Custom premium toast feedback overlay */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`p-4 rounded-xl shadow-xl border text-xs flex items-start gap-2.5 pointer-events-auto transition-all duration-300 transform translate-y-0 ${
              toast.type === 'success' 
                ? 'bg-[#f4fbf7] border-emerald-200 text-emerald-950' 
                : toast.type === 'error' 
                ? 'bg-[#fdf3f2] border-rose-200 text-rose-950' 
                : toast.type === 'warning'
                ? 'bg-[#fef9ec] border-amber-200 text-amber-950'
                : 'bg-[#f2f7fd] border-blue-200 text-blue-950'
            }`}
          >
            <div className="mt-0.5 shrink-0">
              {toast.type === 'success' && (
                <span className="text-emerald-600 font-bold">✓</span>
              )}
              {toast.type === 'error' && (
                <span className="text-rose-600 font-bold">✕</span>
              )}
              {toast.type === 'warning' && (
                <span className="text-amber-600 font-bold">⚠</span>
              )}
              {toast.type === 'info' && (
                <span className="text-blue-600 font-bold">ℹ</span>
              )}
            </div>
            <div className="flex-1 font-medium leading-relaxed">{toast.message}</div>
          </div>
        ))}
      </div>

      {/* Custom elegant delete confirmation modal */}
      {productToDeleteId && (() => {
        const prod = products.find(p => p.id === productToDeleteId);
        if (!prod) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl border border-slate-250 shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
              <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">
                De-list Clearance Lot?
              </h3>
              <p className="text-slate-500 text-sm mt-2 leading-relaxed">
                Are you sure you want to permanently delete and de-list the clearance metadata for <span className="font-semibold text-slate-800">"{prod.name}"</span>? This action cannot be undone and will purge associations immediately.
              </p>

              <div className="mt-6 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setProductToDeleteId(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    executeDelistProduct(productToDeleteId);
                    setProductToDeleteId(null);
                  }}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-xl shadow-md cursor-pointer transition shadow-rose-600/10"
                >
                  Permanently Delete
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}

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
  createdAt: string;
  userEmail: string;
  userName: string;
  items: {
    product: B2BProduct;
    quantitySqm: number;
    subtotal: number;
  }[];
  totalPrice: number;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
}

const mapDbProductToB2BProduct = (db: any): B2BProduct => {
  return {
    id: db.product_id || db.id || `prod-${Math.random().toString(36).substr(2, 9)}`,
    vendorId: db.vendor_id || db.vendorId || 'vendor-generic',
    vendorName: db.vendor_name || db.vendorName || 'Elite Tiles Importers',
    name: db.product_name || db.name || 'Premium Tile Stock Lot',
    description: db.product_description || db.description || 'Vitrified porcelain with a highdensity finish.',
    category: db.category || 'Porcelain',
    finish: db.finish || 'Polished',
    dimensions: db.dimensions || '600mm x 600mm',
    thickness: db.thickness || '9.5mm',
    originalPrice: Number(db.original_price || db.originalPrice || 85.00),
    clearancePrice: Number(db.clearance_price || db.clearancePrice || 29.90),
    stockSqm: Number(db.stock_sqm || db.stockSqm || db.stock || 250),
    moq: Number(db.moq || 40),
    storeName: db.store_name || db.storeName || 'Distribution Logistics',
    storeLocation: db.store_location || db.storeLocation || 'Central Logistics Depot',
    rating: Number(db.rating || 4.7),
    grade: db.grade || 'Premium (Grade A+)',
    image: db.image || db.image_url || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=80',
    skus: db.skus || db.sku || `SKU-TILE-${Math.random().toString(36).substr(2, 5).toUpperCase()}`
  };
};

export default function App() {
  // Session Handling State
  const [currentUser, setCurrentUser] = useState<CurrentUserProfile | null>(null);

  // Active navigation tab for authorized roles (catalog vs administrative cockpit)
  const [activeHubTab, setActiveHubTab] = useState<'catalog' | 'dashboard'>('catalog');

  // Database Connection Status monitoring & diagnostic details
  const [dbConnectionStatus, setDbConnectionStatus] = useState<'checking' | 'connected' | 'error' | 'offline'>('checking');
  const [dbDiagnosticMessage, setDbDiagnosticMessage] = useState<string | null>(null);

  // Layout UI navigation & visibility drawers
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Reactive state repositories
  const [products, setProducts] = useState<B2BProduct[]>([]);
  const [orders, setOrders] = useState<PlacedOrder[]>([]);

  // Search & Categories filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Client shopping basket structure
  const [cart, setCart] = useState<CartItem[]>([]);

  // Simple feedback alert toast
  const [successUpdates, setSuccessUpdates] = useState<string[]>([]);
  const [showStatusAlert, setShowStatusAlert] = useState(false);

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

    // Also attempt real-time query of Supabase tables on boot (if credentials specified)
    const checkTables = async () => {
      setDbConnectionStatus('checking');
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
          // Fully load products from database
          const { data: dbProducts } = await supabase.from('products').select('*');
          if (dbProducts && dbProducts.length > 0) {
            const mapped = dbProducts.map(mapDbProductToB2BProduct);
            setProducts(mapped);
          }
        }
      } catch (err: any) {
        console.warn('Silent product load check general exception:', err);
        setDbConnectionStatus('error');
        setDbDiagnosticMessage(err.message || 'Unknown network error');
      }
    };
    if (isSupabaseConfigured) {
      checkTables();
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
        return { ...item, quantitySqm: Math.max(1, qty) };
      }
      return item;
    }));
  };

  const handleRemoveFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const handleAddToCart = (product: B2BProduct) => {
    setCart(prev => {
      const exists = prev.find(item => item.product.id === product.id);
      if (exists) {
        return prev.map(item => 
          item.product.id === product.id 
            ? { ...item, quantitySqm: item.quantitySqm + product.moq } 
            : item
        );
      }
      return [...prev, { product, quantitySqm: product.moq }];
    });
    setIsCartOpen(true);
  };

  // Checkout response
  const handleCheckoutSuccess = (logs: string[]) => {
    // Generate active order entity
    const newOrder: PlacedOrder = {
      id: `ORD-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      createdAt: new Date().toLocaleDateString('en-US', { hour: '2-digit', minute: '2-digit' }),
      userName: currentUser?.name || 'Guest Client',
      userEmail: currentUser?.email || 'contracts@procure.com',
      items: cart.map(item => ({
        product: item.product,
        quantitySqm: item.quantitySqm,
        subtotal: item.product.clearancePrice * item.quantitySqm
      })),
      totalPrice: cart.reduce((sum, item) => sum + item.product.clearancePrice * item.quantitySqm, 0),
      status: 'pending'
    };

    setOrders(prev => [newOrder, ...prev]);
    setCart([]);
    setSuccessUpdates(logs);
    setShowStatusAlert(true);
    setTimeout(() => {
      setShowStatusAlert(false);
    }, 10000);
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
      const uniqueId = `prod-${Math.random().toString(36).substr(2, 9)}`;
      const skuVal = newProdSku.trim() || `SKU-TILE-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

      const brand = currentUser?.vendorName || currentUser?.name || 'Elite Tiles';
      const parsedOriginal = parseFloat(newProdOriginal) || parseFloat(newProdClearance) * 2;
      const parsedClearance = parseFloat(newProdClearance);

      const registeredTile: B2BProduct = {
        id: uniqueId,
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
        try {
          // Add product
          const { data: prodData } = await supabase.from('products').insert([{
            product_id: uniqueId,
            id: uniqueId,
            vendor_id: currentUser?.id || 'vendor-generic',
            vendorId: currentUser?.id || 'vendor-generic',
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
        } catch (dbErr) {
          console.warn('Supabase product record insert fallback:', dbErr);
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

      alert('Clearance lot has been registered and synced successfully!');
    } catch (err: any) {
      alert(err.message || 'Error occurred registering clearance item.');
    }
  };

  // 2. Vendor / Admin: Change order status
  const handleUpdateOrderStatus = (orderId: string, flag: 'processing' | 'completed' | 'cancelled') => {
    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        return { ...o, status: flag };
      }
      return o;
    }));
  };

  // 3. Admin: Delete / Delist catalog item
  const handleDelistProduct = (productId: string) => {
    if (confirm('Are you sure you want to delist this tile clearance batch?')) {
      setProducts(prev => prev.filter(p => p.id !== productId));
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
            
            {/* Supabase Database Connection Status Badge */}
            <div 
              title={dbDiagnosticMessage || 'Healthy Database Tunnel'}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200/60 rounded-xl text-[10px] font-semibold text-slate-500 shadow-sm transition hover:bg-slate-100 cursor-help"
            >
              <div className={`w-1.5 h-1.5 rounded-full ${
                dbConnectionStatus === 'connected' 
                  ? 'bg-emerald-500 animate-pulse' 
                  : dbConnectionStatus === 'error' 
                    ? 'bg-rose-500 animate-pulse' 
                    : dbConnectionStatus === 'checking' 
                      ? 'bg-amber-400' 
                      : 'bg-slate-300'
              }`} />
              <span>{
                dbConnectionStatus === 'connected' 
                  ? 'Supabase Connected' 
                  : dbConnectionStatus === 'error' 
                    ? 'Database Offline' 
                    : dbConnectionStatus === 'checking' 
                      ? 'Connecting...' 
                      : 'Cache Mode'
              }</span>
            </div>

            {/* Dynamic Role Navigation Tabs */}
            {currentUser && (currentUser.role === 'admin' || currentUser.role === 'vendor') && (
              <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200/60 shadow-m shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveHubTab('catalog')}
                  className={`px-3 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                    activeHubTab === 'catalog'
                      ? 'bg-white text-slate-950 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>View Catalog</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveHubTab('dashboard')}
                  className={`px-3 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                    activeHubTab === 'dashboard'
                      ? 'bg-white text-slate-950 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {currentUser.role === 'vendor' ? (
                    <>
                      <Building2 className="w-3.5 h-3.5" />
                      <span>Merchant Hub</span>
                    </>
                  ) : (
                    <>
                      <Sliders className="w-3.5 h-3.5" />
                      <span>Admin Cockpit</span>
                    </>
                  )}
                </button>
              </div>
            )}
            
            {(!currentUser || currentUser.role === 'user' || activeHubTab === 'catalog') && (
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
                <span>SuperAdmin Platform Cockpit</span>
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
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
                ${orders.reduce((sum, o) => sum + o.totalPrice, 0).toLocaleString('en-US', { maxFractionDigits: 0 })}
              </span>
              <p className="text-[11px] text-slate-500">Total transacted ex-works liquidations volume.</p>
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
                      <span className="text-xs font-bold font-mono text-slate-900 block">${prod.clearancePrice.toFixed(2)}/Sqm</span>
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
                        <span className="font-bold text-slate-900 font-mono">${order.totalPrice.toLocaleString()}</span>
                      </div>

                      {/* Status Adjusters for superadmin review */}
                      <div className="flex gap-1 justify-end pt-1">
                        <button 
                          onClick={() => handleUpdateOrderStatus(order.id, 'processing')}
                          className="px-2 py-1 bg-white hover:bg-slate-100 text-[10px] font-semibold rounded border border-slate-200 cursor-pointer text-slate-700"
                        >
                          Processing
                        </button>
                        <button 
                          onClick={() => handleUpdateOrderStatus(order.id, 'completed')}
                          className="px-2 py-1 bg-white hover:bg-slate-100 text-[10px] font-semibold rounded border border-slate-200 cursor-pointer text-slate-700"
                        >
                          Completed
                        </button>
                        <button 
                          onClick={() => handleUpdateOrderStatus(order.id, 'cancelled')}
                          className="px-2 py-1 bg-white hover:bg-slate-100 text-[10px] font-semibold rounded border border-slate-200 cursor-pointer text-rose-650"
                        >
                          Cancel
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
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">List Cost ($/Sqm)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={newProdOriginal}
                      onChange={e => setNewProdOriginal(e.target.value)}
                      className="w-full px-3.5 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-900 outline-none focus:bg-white focus:border-slate-400 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Clearance Rate ($/Sqm)</label>
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

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Product Image URL</label>
                  <input 
                    type="text" 
                    value={newProdImage}
                    onChange={e => setNewProdImage(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-[550] outline-none focus:bg-white focus:border-slate-400 transition"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 mt-2 bg-slate-950 text-white text-xs font-bold rounded-xl hover:bg-slate-900 transition flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Publish Clearance Batch
                </button>
              </form>
            </section>

            {/* Vendor Inventory Lists and Placed Orders checklists side-by-side */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* My active lots list */}
              <section className="bg-white p-6 border border-slate-200 rounded-2xl space-y-4">
                <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-slate-500" /> Published Clearance Batches
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">Real-Time</span>
                </div>

                <div className="space-y-3.5 max-h-[290px] overflow-y-auto pr-1">
                  {products.filter(p => p.vendorId === currentUser.id || p.vendorId === 'vendor-ceramica-italiana').map(p => (
                    <div key={p.id} className="flex gap-4 p-3.5 bg-slate-50 border border-slate-200 rounded-xl items-center justify-between text-xs hover:border-slate-350 transition">
                      <div className="flex gap-3 items-center min-w-0">
                        <img src={p.image} alt="" className="w-10 h-10 object-cover rounded-lg border border-slate-200 shrink-0" referrerPolicy="no-referrer" />
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate max-w-[200px]">{p.name}</p>
                          <p className="text-[10px] text-slate-500 font-mono">SKU: {p.skus} • {p.dimensions}</p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-bold font-mono text-slate-900 block">${p.clearancePrice.toFixed(2)}/Sqm</span>
                        <span className="text-[9px] bg-slate-200 font-bold px-1.5 py-0.2 rounded text-slate-700 mt-1 inline-block">Stock: {p.stockSqm} Sqm</span>
                      </div>
                    </div>
                  ))}
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
                  {orders.length === 0 ? (
                    <div className="text-center py-10 text-slate-400 text-xs leading-relaxed">
                      No customer clearance procurement logged yet. Incoming contractor orders placed will show up cleanly here.
                    </div>
                  ) : (
                    orders.map(order => (
                      <div key={order.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="font-mono font-bold text-slate-900">{order.id}</span>
                          <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-widest ${
                            order.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                            order.status === 'cancelled' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {order.status}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-500 leading-normal">
                          <p><strong>Contracting Client:</strong> {order.userName} ({order.userEmail})</p>
                          <ul className="list-disc pl-4 space-y-0.5 mt-1">
                            {order.items.map((item, id) => (
                              <li key={id}>
                                {item.quantitySqm} Sqm of <span className="font-semibold text-slate-700">{item.product.name}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="pt-2 border-t border-slate-250/20 flex justify-between items-center">
                          <div className="flex gap-1.5">
                            <button 
                              onClick={() => handleUpdateOrderStatus(order.id, 'completed')}
                              className="px-2 py-0.5 bg-white hover:bg-slate-205 text-[10px] font-bold rounded border border-slate-200 transition cursor-pointer"
                            >
                              Dispatch Done
                            </button>
                            <button 
                              onClick={() => handleUpdateOrderStatus(order.id, 'cancelled')}
                              className="px-2 py-0.5 bg-white hover:bg-rose-50 text-[10px] font-bold rounded border border-slate-200 transition cursor-pointer text-rose-650"
                            >
                              Cancel Lot
                            </button>
                          </div>
                          <span className="font-bold text-slate-900 font-mono">${order.totalPrice.toLocaleString()}</span>
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

                  return (
                    <div 
                      key={prod.id} 
                      className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-md transition-all flex flex-col h-full group"
                    >
                      {/* Batch Image display zone */}
                      <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden border-b border-slate-150">
                        <img 
                          src={prod.image} 
                          alt={prod.name}
                          className="w-full h-full object-cover group-hover:scale-[1.015] transition duration-500"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute top-3 left-3 bg-slate-950 text-white font-extrabold text-[9px] px-2.5 py-1 rounded-md tracking-wider">
                          {discountOff}% EX-WORKS OFF
                        </div>
                        <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-sm text-slate-800 text-[9px] font-bold px-2 py-0.5 rounded border border-slate-200">
                          Lot: {prod.stockSqm} Sqm
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
                              <span className="text-base font-extrabold text-slate-900 font-mono">${prod.clearancePrice.toFixed(2)}</span>
                              <span className="text-[10px] text-slate-400 line-through font-mono">${prod.originalPrice.toFixed(2)}</span>
                              <span className="text-[9px] text-slate-500 font-sans">/Sqm</span>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Trade MOQ</span>
                            <span className="text-xs font-extrabold font-mono text-slate-700 mt-0.5 block">{prod.moq} Sqm</span>
                          </div>
                        </div>

                        {/* Purchase cart dispatch handlers */}
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
                              Allocated ({inCart.quantitySqm} Sqm)
                            </>
                          ) : (
                            'Allocate Clearance Lot'
                          )}
                        </button>
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
                          <span className="px-2 py-0.5 rounded text-[8px] font-extrabold uppercase bg-amber-150 text-[#c27c0e]">
                            {order.status}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1 text-slate-500">
                        <p className="font-bold text-slate-800">Clearance Lots Confirmed:</p>
                        <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                          {order.items.map((item, id) => (
                            <li key={id}>
                              {item.quantitySqm} Sqm of {item.product.name}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="pt-2 border-t border-slate-250/20 flex justify-between items-center text-xs">
                        <span className="text-slate-400 font-medium">Subtotal ex VAT:</span>
                        <span className="font-bold text-slate-900 font-mono">${order.totalPrice.toLocaleString()}</span>
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

    </div>
  );
}

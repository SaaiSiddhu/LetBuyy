/**
 * Store Templates - Professional E-commerce Store Generator
 * Shopify-quality HTML/CSS/JS for published stores
 */

interface Product {
    id: string;
    name: string;
    description: string;
    price: number;
    mrp?: number;
    images: string[];
    category?: string;
    sellerId: string;
}

interface StoreConfig {
    id: string;
    name: string;
    tagline: string;
    logoUrl?: string;
    bannerUrl?: string;
    themeId: string;
    themeCustomization?: {
        primaryColor?: string;
        secondaryColor?: string;
        accentColor?: string;
        fontFamily?: string;
    };
    sellerId: string;
    subdomain: string;
}

export function generateStoreHtml(store: StoreConfig, products: Product[]): string {
    const theme = store.themeCustomization || {};
    const primary = theme.primaryColor || "#6366f1";
    const secondary = theme.secondaryColor || "#8b5cf6";
    const accent = theme.accentColor || "#f59e0b";
    const font = theme.fontFamily || "Inter";

    const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
    // Get unique categories

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${esc(store.name)} | Shop Online</title>
    <meta name="description" content="${esc(store.tagline)}">
    <meta property="og:title" content="${esc(store.name)}">
    <meta property="og:description" content="${esc(store.tagline)}">
    ${store.logoUrl ? `<meta property="og:image" content="${store.logoUrl}">` : ""}
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=${font.replace(/ /g, "+")}:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
:root{--primary:${primary};--secondary:${secondary};--accent:${accent};--bg:#0a0a0f;--surface:#12121a;--surface2:#1a1a25;--surface3:#252532;--text:#fff;--muted:#9ca3af;--border:rgba(255,255,255,0.08);--font:'${font}',sans-serif;--radius:16px;--shadow:0 25px 50px -12px rgba(0,0,0,0.5)}
*{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth}
body{font-family:var(--font);background:var(--bg);color:var(--text);line-height:1.6;overflow-x:hidden}
a{color:inherit;text-decoration:none}
button{font-family:inherit;cursor:pointer;border:none;background:none}
img{max-width:100%;display:block}

/* Announcement Bar */
.announce{background:linear-gradient(90deg,var(--primary),var(--secondary));padding:10px;text-align:center;font-size:13px;font-weight:500}

/* Header */
.header{position:sticky;top:0;z-index:100;background:rgba(10,10,15,0.85);backdrop-filter:blur(20px);border-bottom:1px solid var(--border)}
.header-inner{max-width:1400px;margin:0 auto;padding:16px 24px;display:flex;align-items:center;justify-content:space-between;gap:24px}
.logo{display:flex;align-items:center;gap:12px}
.logo img{width:48px;height:48px;border-radius:12px;object-fit:cover}
.logo h1{font-size:1.5rem;font-weight:700;background:linear-gradient(135deg,var(--primary),var(--secondary));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.nav{display:flex;gap:32px}
.nav a{font-size:14px;font-weight:500;color:var(--muted);transition:color .2s}
.nav a:hover{color:var(--text)}
.header-actions{display:flex;gap:16px;align-items:center}
.search-btn,.cart-btn{width:44px;height:44px;border-radius:12px;background:var(--surface2);display:flex;align-items:center;justify-content:center;transition:all .2s}
.search-btn:hover,.cart-btn:hover{background:var(--surface3)}
.cart-btn{position:relative}
.cart-count{position:absolute;top:-4px;right:-4px;width:20px;height:20px;background:var(--accent);border-radius:50%;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center}

/* Hero */
.hero{position:relative;min-height:600px;display:flex;align-items:center;overflow:hidden}
.hero-bg{position:absolute;inset:0;background:linear-gradient(135deg,var(--primary),var(--secondary));opacity:.15}
.hero-img{position:absolute;inset:0;opacity:.3}
.hero-img img{width:100%;height:100%;object-fit:cover}
.hero::after{content:'';position:absolute;bottom:0;left:0;right:0;height:200px;background:linear-gradient(to top,var(--bg),transparent)}
.hero-content{position:relative;z-index:2;max-width:1400px;margin:0 auto;padding:80px 24px;width:100%}
.hero-badge{display:inline-flex;align-items:center;gap:8px;padding:8px 16px;background:rgba(255,255,255,0.1);border-radius:100px;font-size:13px;font-weight:500;margin-bottom:24px;border:1px solid rgba(255,255,255,0.1)}
.hero h2{font-size:clamp(2.5rem,6vw,4.5rem);font-weight:800;line-height:1.1;margin-bottom:20px;max-width:700px}
.hero p{font-size:1.25rem;color:var(--muted);max-width:500px;margin-bottom:32px}
.hero-btns{display:flex;gap:16px;flex-wrap:wrap}
.btn{padding:16px 32px;border-radius:12px;font-size:15px;font-weight:600;transition:all .3s}
.btn-primary{background:linear-gradient(135deg,var(--primary),var(--secondary));color:#fff}
.btn-primary:hover{transform:translateY(-2px);box-shadow:0 20px 40px rgba(99,102,241,0.3)}
.btn-outline{background:transparent;border:2px solid rgba(255,255,255,0.2);color:#fff}
.btn-outline:hover{background:rgba(255,255,255,0.1);border-color:rgba(255,255,255,0.3)}

/* Section */
.section{padding:80px 24px;max-width:1400px;margin:0 auto}
.section-header{text-align:center;margin-bottom:48px}
.section-header h3{font-size:2.5rem;font-weight:700;margin-bottom:12px}
.section-header p{color:var(--muted);font-size:1.1rem}

/* Categories */
.cats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px}
.cat-card{position:relative;height:180px;border-radius:var(--radius);overflow:hidden;cursor:pointer}
.cat-card::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,var(--primary),var(--secondary));opacity:.8;transition:opacity .3s}
.cat-card:hover::before{opacity:.9}
.cat-card span{position:relative;z-index:2;display:flex;height:100%;align-items:center;justify-content:center;font-size:1.25rem;font-weight:600}

/* Products Grid */
.products-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:24px}
.product-card{background:var(--surface);border-radius:var(--radius);overflow:hidden;transition:all .3s;border:1px solid var(--border)}
.product-card:hover{transform:translateY(-8px);box-shadow:var(--shadow);border-color:var(--primary)}
.product-img{position:relative;height:300px;overflow:hidden;background:var(--surface2)}
.product-img img{width:100%;height:100%;object-fit:cover;transition:transform .5s}
.product-card:hover .product-img img{transform:scale(1.08)}
.product-badge{position:absolute;top:12px;left:12px;padding:6px 12px;background:var(--accent);border-radius:8px;font-size:12px;font-weight:600}
.product-actions{position:absolute;bottom:12px;right:12px;display:flex;gap:8px;opacity:0;transform:translateY(10px);transition:all .3s}
.product-card:hover .product-actions{opacity:1;transform:translateY(0)}
.product-action-btn{width:40px;height:40px;background:rgba(255,255,255,0.95);border-radius:10px;display:flex;align-items:center;justify-content:center;color:#000}
.product-info{padding:20px}
.product-cat{font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px}
.product-name{font-size:1rem;font-weight:600;margin-bottom:8px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.product-price{display:flex;align-items:center;gap:10px;margin-bottom:16px}
.price-now{font-size:1.35rem;font-weight:700;color:var(--primary)}
.price-was{font-size:0.95rem;color:var(--muted);text-decoration:line-through}
.add-btn{width:100%;padding:14px;background:linear-gradient(135deg,var(--primary),var(--secondary));border-radius:10px;color:#fff;font-weight:600;transition:all .3s}
.add-btn:hover{opacity:.9;transform:scale(1.02)}

/* Features */
.features{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:24px;margin-top:80px;padding:40px;background:var(--surface);border-radius:var(--radius)}
.feature{text-align:center;padding:24px}
.feature-icon{width:60px;height:60px;margin:0 auto 16px;background:linear-gradient(135deg,var(--primary),var(--secondary));border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:24px}
.feature h4{font-size:1.1rem;font-weight:600;margin-bottom:8px}
.feature p{font-size:14px;color:var(--muted)}

/* Newsletter */
.newsletter{text-align:center;padding:80px 24px;background:linear-gradient(135deg,var(--surface),var(--surface2));border-radius:var(--radius);margin:80px auto;max-width:1400px}
.newsletter h3{font-size:2rem;font-weight:700;margin-bottom:16px}
.newsletter p{color:var(--muted);margin-bottom:32px}
.newsletter-form{display:flex;gap:12px;max-width:500px;margin:0 auto}
.newsletter-form input{flex:1;padding:16px 20px;background:var(--bg);border:1px solid var(--border);border-radius:12px;color:#fff;font-size:15px}
.newsletter-form input::placeholder{color:var(--muted)}

/* Footer */
.footer{background:var(--surface);padding:60px 24px 30px;margin-top:80px}
.footer-inner{max-width:1400px;margin:0 auto;display:grid;grid-template-columns:2fr repeat(3,1fr);gap:48px}
.footer-brand p{color:var(--muted);margin-top:16px;font-size:14px;max-width:300px}
.footer-col h4{font-size:14px;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin-bottom:20px;color:var(--muted)}
.footer-col a{display:block;color:var(--text);font-size:14px;padding:8px 0;transition:color .2s}
.footer-col a:hover{color:var(--primary)}
.footer-bottom{max-width:1400px;margin:40px auto 0;padding-top:24px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;font-size:13px;color:var(--muted)}
.footer-social{display:flex;gap:12px}
.footer-social a{width:40px;height:40px;background:var(--surface2);border-radius:10px;display:flex;align-items:center;justify-content:center;transition:all .2s}
.footer-social a:hover{background:var(--primary)}

/* Cart Sidebar */
.cart-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:200;opacity:0;visibility:hidden;transition:all .3s}
.cart-overlay.active{opacity:1;visibility:visible}
.cart-sidebar{position:fixed;top:0;right:-450px;width:450px;max-width:100%;height:100%;background:var(--surface);z-index:201;display:flex;flex-direction:column;transition:right .3s}
.cart-sidebar.active{right:0}
.cart-head{padding:24px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center}
.cart-head h3{font-size:1.25rem;font-weight:600}
.close-cart{width:40px;height:40px;background:var(--surface2);border-radius:10px;font-size:18px}
.cart-body{flex:1;overflow-y:auto;padding:24px}
.cart-item{display:flex;gap:16px;padding:16px;background:var(--surface2);border-radius:12px;margin-bottom:12px}
.cart-item img{width:80px;height:80px;border-radius:10px;object-fit:cover}
.cart-item-info{flex:1}
.cart-item-info h4{font-size:14px;font-weight:500;margin-bottom:4px}
.cart-item-info .price{color:var(--primary);font-weight:600}
.cart-item-qty{display:flex;align-items:center;gap:12px;margin-top:8px}
.qty-btn{width:28px;height:28px;background:var(--surface3);border-radius:6px;font-size:14px}
.cart-foot{padding:24px;border-top:1px solid var(--border)}
.cart-total{display:flex;justify-content:space-between;font-size:1.25rem;font-weight:600;margin-bottom:20px}
.checkout-btn{width:100%;padding:16px;background:linear-gradient(135deg,var(--accent),#f97316);border-radius:12px;color:#fff;font-size:16px;font-weight:600;transition:all .3s}
.checkout-btn:hover{transform:translateY(-2px);box-shadow:0 15px 30px rgba(245,158,11,0.3)}
.empty-cart{text-align:center;padding:60px 20px;color:var(--muted)}
.empty-cart svg{width:80px;height:80px;margin-bottom:16px;opacity:.5}

/* Quick View Modal */
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:300;opacity:0;visibility:hidden;display:flex;align-items:center;justify-content:center;padding:24px;transition:all .3s}
.modal-overlay.active{opacity:1;visibility:visible}
.modal{background:var(--surface);border-radius:var(--radius);max-width:900px;width:100%;max-height:90vh;overflow-y:auto;display:grid;grid-template-columns:1fr 1fr}
.modal-img{height:500px;background:var(--surface2)}
.modal-img img{width:100%;height:100%;object-fit:cover}
.modal-body{padding:32px;display:flex;flex-direction:column}
.modal-close{position:absolute;top:20px;right:20px;width:40px;height:40px;background:rgba(0,0,0,0.5);border-radius:50%;color:#fff;font-size:20px}

/* Responsive */
@media(max-width:1024px){.footer-inner{grid-template-columns:1fr 1fr}}
@media(max-width:768px){
.nav{display:none}
.hero{min-height:500px}
.hero h2{font-size:2rem}
.products-grid{grid-template-columns:repeat(2,1fr);gap:16px}
.product-img{height:200px}
.modal{grid-template-columns:1fr}
.footer-inner{grid-template-columns:1fr}
}
@media(max-width:480px){
.products-grid{grid-template-columns:1fr}
.hero-btns{flex-direction:column}
.btn{width:100%;text-align:center}
}
</style>
</head>
<body>
<div class="announce">🎉 Free Shipping on Orders Over ₹499 | Use Code: LETBUYY10</div>

<header class="header">
<div class="header-inner">
<a href="#" class="logo">
${store.logoUrl ? `<img src="${store.logoUrl}" alt="${esc(store.name)}">` : ""}
<h1>${esc(store.name)}</h1>
</a>
<nav class="nav">
<a href="#products">Products</a>
<a href="#categories">Categories</a>
<a href="#about">About</a>
<a href="#contact">Contact</a>
</nav>
<div class="header-actions">
<button class="search-btn" onclick="toggleSearch()">🔍</button>
<button class="cart-btn" onclick="openCart()">🛒<span class="cart-count" id="cartCount">0</span></button>
</div>
</div>
</header>

<section class="hero">
<div class="hero-bg"></div>
${store.bannerUrl ? `<div class="hero-img"><img src="${store.bannerUrl}" alt="Banner"></div>` : ""}
<div class="hero-content">
<div class="hero-badge">✨ Welcome to our store</div>
<h2>${esc(store.name)}</h2>
<p>${esc(store.tagline)}</p>
<div class="hero-btns">
<a href="#products" class="btn btn-primary">Shop Now</a>
<a href="#about" class="btn btn-outline">Learn More</a>
</div>
</div>
</section>

${categories.length > 0 ? `
<section class="section" id="categories">
<div class="section-header">
<h3>Shop by Category</h3>
<p>Find exactly what you're looking for</p>
</div>
<div class="cats-grid">
${categories.map(cat => `<div class="cat-card" onclick="filterCategory('${cat}')"><span>${cat}</span></div>`).join("")}
</div>
</section>
` : ""}

<section class="section" id="products">
<div class="section-header">
<h3>Our Products</h3>
<p>Discover our curated collection</p>
</div>
<div class="products-grid">
${products.map(p => productCard(p)).join("")}
</div>
</section>

<div class="section features">
<div class="feature"><div class="feature-icon">🚚</div><h4>Free Shipping</h4><p>On orders over ₹499</p></div>
<div class="feature"><div class="feature-icon">↩️</div><h4>Easy Returns</h4><p>7-day return policy</p></div>
<div class="feature"><div class="feature-icon">🔒</div><h4>Secure Payment</h4><p>100% protected</p></div>
<div class="feature"><div class="feature-icon">💬</div><h4>24/7 Support</h4><p>Always here to help</p></div>
</div>

<section class="newsletter">
<h3>Stay Updated</h3>
<p>Subscribe to get special offers and updates</p>
<form class="newsletter-form" onsubmit="return false;">
<input type="email" placeholder="Enter your email">
<button class="btn btn-primary">Subscribe</button>
</form>
</section>

<div class="cart-overlay" id="cartOverlay" onclick="closeCart()"></div>
<aside class="cart-sidebar" id="cartSidebar">
<div class="cart-head"><h3>Your Cart</h3><button class="close-cart" onclick="closeCart()">✕</button></div>
<div class="cart-body" id="cartItems"><div class="empty-cart"><p>Your cart is empty</p></div></div>
<div class="cart-foot">
<div class="cart-total"><span>Total</span><span id="cartTotal">₹0</span></div>
<button class="checkout-btn" onclick="checkout()">Proceed to Checkout</button>
</div>
</aside>

<footer class="footer" id="contact">
<div class="footer-inner">
<div class="footer-brand">
<div class="logo"><h1>${esc(store.name)}</h1></div>
<p>${esc(store.tagline)}</p>
</div>
<div class="footer-col"><h4>Shop</h4><a href="#products">All Products</a><a href="#categories">Categories</a></div>
<div class="footer-col"><h4>Support</h4><a href="#">Contact</a><a href="#">FAQ</a><a href="#">Shipping</a></div>
<div class="footer-col"><h4>Legal</h4><a href="#">Privacy</a><a href="#">Terms</a></div>
</div>
<div class="footer-bottom">
<span>© ${new Date().getFullYear()} ${esc(store.name)}. Powered by LetBuyy</span>
<div class="footer-social"><a href="#">📘</a><a href="#">📸</a><a href="#">🐦</a></div>
</div>
</footer>

<script>
const storeId='${store.id}',sellerId='${store.sellerId}';
const products=${JSON.stringify(products.map(p => ({ id: p.id, name: p.name || "Product", price: p.price ?? 0, mrp: p.mrp ?? 0, image: p.images?.[0] || "" })))};
let cart=JSON.parse(localStorage.getItem('cart_'+storeId)||'[]');

function updateUI(){
document.getElementById('cartCount').textContent=cart.reduce((s,i)=>s+i.qty,0);
document.getElementById('cartTotal').textContent='₹'+cart.reduce((s,i)=>s+(i.price*i.qty),0).toLocaleString('en-IN');
renderCart();
localStorage.setItem('cart_'+storeId,JSON.stringify(cart));
}

function renderCart(){
const c=document.getElementById('cartItems');
if(!cart.length){c.innerHTML='<div class="empty-cart"><p>Your cart is empty</p></div>';return;}
c.innerHTML=cart.map(i=>\`<div class="cart-item"><img src="\${i.image}" alt="\${i.name}"><div class="cart-item-info"><h4>\${i.name}</h4><p class="price">₹\${i.price.toLocaleString('en-IN')}</p><div class="cart-item-qty"><button class="qty-btn" onclick="updateQty('\${i.id}',-1)">−</button><span>\${i.qty}</span><button class="qty-btn" onclick="updateQty('\${i.id}',1)">+</button></div></div></div>\`).join('');
}

function addToCart(id){
const p=products.find(x=>x.id===id);if(!p)return;
const e=cart.find(x=>x.id===id);
if(e)e.qty++;else cart.push({...p,qty:1});
updateUI();openCart();
}

function updateQty(id,d){
const i=cart.find(x=>x.id===id);if(!i)return;
i.qty+=d;if(i.qty<=0)cart=cart.filter(x=>x.id!==id);
updateUI();
}

function openCart(){document.getElementById('cartOverlay').classList.add('active');document.getElementById('cartSidebar').classList.add('active');}
function closeCart(){document.getElementById('cartOverlay').classList.remove('active');document.getElementById('cartSidebar').classList.remove('active');}

function checkout(){
if(!cart.length){alert('Cart is empty');return;}
const data=encodeURIComponent(JSON.stringify({storeId,sellerId,items:cart}));
window.location.href='https://letbuy-y.web.app/checkout?cart='+data;
}

updateUI();
</script>
</body>
</html>`;
}

function productCard(p: Product): string {
    const price = p.price ?? 0;
    const mrp = p.mrp ?? 0;
    const discount = mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;

    return `<div class="product-card">
<div class="product-img">
<img src="${p.images?.[0] || "/placeholder.jpg"}" alt="${esc(p.name || "Product")}" loading="lazy">
${discount > 0 ? `<span class="product-badge">${discount}% OFF</span>` : ""}
<div class="product-actions">
<button class="product-action-btn" onclick="addToCart('${p.id}')">🛒</button>
</div>
</div>
<div class="product-info">
${p.category ? `<div class="product-cat">${esc(p.category)}</div>` : ""}
<h4 class="product-name">${esc(p.name || "Product")}</h4>
<div class="product-price">
<span class="price-now">₹${price.toLocaleString("en-IN")}</span>
${mrp > price ? `<span class="price-was">₹${mrp.toLocaleString("en-IN")}</span>` : ""}
</div>
<button class="add-btn" onclick="addToCart('${p.id}')">Add to Cart</button>
</div>
</div>`;
}

function esc(text: string): string {
    const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" };
    return (text || "").replace(/[&<>"']/g, m => map[m] || m);
}

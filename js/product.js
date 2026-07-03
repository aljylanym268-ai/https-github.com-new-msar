// ========== فتح تفاصيل المنتج ==========
function openProductDetail(product) {
    appState.currentProduct = product;
    const container = document.getElementById('productDetailContent');
    if (!container) return;
    const images = (product.images && Array.isArray(product.images) && product.images.length) ? product.images : (product.image_url ? [product.image_url] : []);
    let galleryHtml = '';
    if (images.length) {
        let mainImage = images[0];
        galleryHtml = `<img src="${mainImage}" class="product-main-image" id="detailMainImage" style="width:100%; max-height:300px; object-fit:contain; border-radius:12px; margin-bottom:10px;">`;
        if (images.length > 1) {
            galleryHtml += `<div class="product-gallery">`;
            images.forEach((img, idx) => {
                galleryHtml += `<img src="${img}" class="gallery-thumb" data-img="${img}" style="width:80px; height:80px; border-radius:8px; cursor:pointer; object-fit:cover; border:2px solid ${idx === 0 ? '#ff6d00' : 'transparent'}" onclick="document.getElementById('detailMainImage').src=this.dataset.img; document.querySelectorAll('.gallery-thumb').forEach(t=>t.style.borderColor='transparent'); this.style.borderColor='#ff6d00';">`;
            });
            galleryHtml += `</div>`;
        }
    } else {
        galleryHtml = '<div style="text-align:center; padding:20px;">📦 لا توجد صور</div>';
    }
    container.innerHTML = `<div style="margin-bottom:15px;"><h2 style="color:#1a237e; margin:10px 0;">${escapeHTML(product.name)}</h2><div class="product-price" style="font-size:1.8rem; margin:10px 0;">${product.price} ج.م</div><div style="margin-bottom:15px; background:#f9f9f9; padding:12px; border-radius:12px;"><p style="color:#333; line-height:1.6; margin:0;">${escapeHTML(product.description || 'لا يوجد وصف')}</p></div>${galleryHtml}<div style="display:flex; gap:15px; flex-wrap:wrap; margin:15px 0;"><button class="login-btn" style="flex:1;" onclick="addToCartFromDetail()"><i class="fas fa-cart-plus"></i> إضافة إلى السلة</button><button class="checkout-btn" style="flex:1; background:linear-gradient(135deg,#ff6d00,#ff9100);" onclick="buyNowFromDetail()"><i class="fas fa-bolt"></i> شراء الآن</button></div></div><div id="similarProductsSectionDetail" style="margin-top:25px; border-top:1px solid #eee; padding-top:20px;"></div>`;
    loadSimilarProductsInDetail(product.category, product.id);
    showScreen('productDetailScreen');
}

// ========== تحميل منتجات مشابهة ==========
function loadSimilarProductsInDetail(category, currentProductId, limit = 6) {
    const container = document.getElementById('similarProductsSectionDetail');
    if (!container) return;
    let similar = appState.products.filter(p => p.category === category && p.id !== currentProductId);
    similar = similar.slice(0, limit);
    if (similar.length === 0) { container.innerHTML = ''; return; }
    container.innerHTML = '<h3 style="font-size:1.2rem; color:#1a237e; margin-bottom:15px; font-weight:700;">منتجات مشابهة</h3><div class="similar-products-grid" id="similarProductsGridDetail"></div>';
    const grid = document.getElementById('similarProductsGridDetail');
    similar.forEach(product => {
        const card = document.createElement('div');
        card.className = 'similar-product-card';
        const imgUrl = product.images && product.images.length ? product.images[0] : (product.image_url || '');
        const imgHtml = imgUrl ? `<img src="${imgUrl}" loading="lazy">` : '<div style="font-size:2rem;">📦</div>';
        card.innerHTML = `<div class="similar-product-image">${imgHtml}</div><div class="similar-product-info"><div class="similar-product-name">${escapeHTML(product.name)}</div><div class="similar-product-price">${product.price} ج.م</div></div>`;
        card.addEventListener('click', () => openProductDetail(product));
        grid.appendChild(card);
    });
}

// ========== إضافة إلى السلة من التفاصيل ==========
function addToCartFromDetail() { if (appState.currentProduct) { addToCart(appState.currentProduct.id); showToast('تمت الإضافة إلى السلة', 'success'); } }

// ========== شراء الآن من التفاصيل ==========
function buyNowFromDetail() { if (appState.currentProduct) { addToCart(appState.currentProduct.id); showScreen('cartScreen'); } }

// ========== تصدير الدوال ==========
window.openProductDetail = openProductDetail;
window.loadSimilarProductsInDetail = loadSimilarProductsInDetail;
window.addToCartFromDetail = addToCartFromDetail;
window.buyNowFromDetail = buyNowFromDetail;
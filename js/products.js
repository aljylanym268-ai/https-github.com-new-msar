// ========== تحميل المنتجات من قاعدة البيانات ==========
async function loadProductsFromDB() {
    const { data, error } = await supabaseClient.from('products').select('*').order('created_at', { ascending: false });
    if (error) { console.error(error); return []; }
    appState.products = data;
    return data;
}

// ========== عرض المنتجات المميزة في الصفحة الرئيسية ==========
function loadFeaturedProducts() {
    const container = document.getElementById('featuredProducts');
    if (!container) return;
    container.innerHTML = '';
    appState.products.slice(0,4).forEach(p => container.appendChild(createProductCard(p)));
}

// ========== عرض منتجات المتجر ==========
function loadMarketProducts() {
    const container = document.getElementById('marketProducts');
    if (!container) return;
    container.innerHTML = '';
    appState.products.forEach(p => container.appendChild(createProductCard(p)));
}

// ========== فلترة منتجات المتجر ==========
function filterMarketProducts(query) {
    const container = document.getElementById('marketProducts');
    if (!container) return;
    container.innerHTML = '';
    const filtered = appState.products.filter(p => p.name.toLowerCase().includes(query));
    if (filtered.length === 0) container.innerHTML = '<p style="grid-column:span2; text-align:center; padding:30px; color:#666;">لا توجد منتجات مطابقة للبحث</p>';
    else filtered.forEach(p => container.appendChild(createProductCard(p)));
}

// ========== مسح البحث ==========
function clearSearch() {
    const input = document.getElementById('marketSearchInput');
    if (input) input.value = '';
    const clear = document.getElementById('clearSearch');
    if (clear) clear.style.display = 'none';
    filterMarketProducts('');
}

// ========== إنشاء بطاقة منتج ==========
function createProductCard(product) {
    const card = document.createElement('div');
    card.className = 'product-card';
    const imageUrl = product.images && product.images.length ? product.images[0] : (product.image_url || '');
    const imageHtml = imageUrl ? `<img src="${imageUrl}" loading="lazy" onerror="this.onerror=null; this.parentElement.innerHTML='<div>📦</div>';">` : '<div>📦</div>';
    card.innerHTML = `<div class="product-image">${imageHtml}<div class="product-tag">${product.category || 'عام'}</div></div><div class="product-info"><div class="product-title">${escapeHTML(product.name)}</div><div class="product-price">${product.price} ج.م</div><div class="product-rating">★★★★★</div><button class="add-to-cart" onclick="event.stopPropagation(); addToCart('${product.id}')"><i class="fas fa-cart-plus"></i> إضافة للسلة</button></div>`;
    card.addEventListener('click', () => openProductDetail(product));
    return card;
}

// ========== تحميل منتجات البائع ==========
async function loadSellerProducts(userId) {
    const { data, error } = await supabaseClient.from('products').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) throw error;
    return data;
}

// ========== إضافة/تحديث/حذف منتج ==========
async function addProduct(productData) {
    const { data, error } = await supabaseClient.from('products').insert([productData]).select();
    if (error) throw error;
    return data[0];
}
async function updateProduct(id, updates) {
    const { data, error } = await supabaseClient.from('products').update(updates).eq('id', id).select();
    if (error) throw error;
    return data[0];
}
async function deleteProduct(id) {
    const { error } = await supabaseClient.from('products').delete().eq('id', id);
    if (error) throw error;
}

// ========== حفظ منتج (إضافة/تعديل) - تم التعديل هنا ==========
async function saveProduct() {
    const name = document.getElementById('productName').value.trim();
    const price = parseFloat(document.getElementById('productPrice').value);
    const stock = parseInt(document.getElementById('productStock').value) || 1;
    const desc = document.getElementById('productDescription').value.trim();
    const cat = document.getElementById('productCategory').value;
    const discount = parseFloat(document.getElementById('productDiscount').value) || 0;
    const id = document.getElementById('editingProductId').value;
    const files = document.getElementById('productImages').files;

    if (!name || isNaN(price) || price <= 0) {
        showToast('يرجى إدخال اسم المنتج وسعر صحيح', 'warning');
        return;
    }

    showLoading(true);

    try {
        // ========== التعديل الأساسي: جلب المستخدم الحالي من Supabase ==========
        const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
        if (userError || !user) {
            throw new Error('يجب تسجيل الدخول أولاً لإضافة منتج');
        }
        const userId = user.id; // هذا هو المعرف الصحيح للمستخدم المسجل

        // رفع الصور (إن وجدت)
        let imageUrls = [];
        if (files && files.length > 0) {
            imageUrls = await uploadProductImages(Array.from(files));
        }

        // تحضير بيانات المنتج مع user_id الصحيح
        const productData = {
            name,
            price,
            stock,
            description: desc,
            category: cat,
            discount,
            user_id: userId,        // <-- المستخدم الحالي من Supabase
            updated_at: new Date()
        };

        if (imageUrls.length > 0) {
            productData.image_url = imageUrls[0];
            productData.images = imageUrls;
        }

        // إدراج أو تحديث
        if (id) {
            await updateProduct(id, productData);
        } else {
            await addProduct(productData);
        }

        showToast(`تم ${id ? 'تحديث' : 'إضافة'} المنتج بنجاح`, 'success');
        closeProductModal();
        await refreshSellerDashboard();
        await loadProductsFromDB();
        loadMarketProducts();
        loadFeaturedProducts();

    } catch (err) {
        // معالجة الأخطاء (مثل عدم وجود عمود images)
        if (err.message && err.message.includes('column "images"')) {
            showToast('ملاحظة: تم حفظ الصورة الرئيسية فقط.', 'warning');
            try {
                // نعيد جلب المستخدم مرة أخرى للتأكد
                const { data: { user } } = await supabaseClient.auth.getUser();
                if (!user) throw new Error('يجب تسجيل الدخول');

                const productData = {
                    name,
                    price,
                    stock,
                    description: desc,
                    category: cat,
                    discount,
                    user_id: user.id,
                    updated_at: new Date()
                };
                // نستخدم فقط image_url وليس images
                if (imageUrls.length > 0) productData.image_url = imageUrls[0];

                if (id) await updateProduct(id, productData);
                else await addProduct(productData);

                closeProductModal();
                await refreshSellerDashboard();
                await loadProductsFromDB();
                loadMarketProducts();
                loadFeaturedProducts();
                showToast('تم الحفظ بنجاح (بدون الصور المتعددة)', 'success');
            } catch (fallbackErr) {
                showToast(fallbackErr.message, 'error');
            }
        } else {
            showToast(err.message, 'error');
            console.error(err);
        }
    } finally {
        showLoading(false);
    }
}

// ========== معاينة الصور المتعددة ==========
function previewMultipleImages(event) {
    const files = event.target.files;
    const container = document.getElementById('multiImagePreview');
    container.innerHTML = '';
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const reader = new FileReader();
        reader.onload = function(e) {
            const div = document.createElement('div'); div.className = 'image-preview-item';
            div.innerHTML = `<img src="${e.target.result}" alt="صورة"><div class="remove-img" onclick="this.parentElement.remove()">×</div>`;
            container.appendChild(div);
        };
        reader.readAsDataURL(file);
    }
}

// ========== لوحة البائع ==========
async function refreshSellerDashboard() {
    if (!appState.user) return;
    showLoading(true);
    try {
        const [products, orders] = await Promise.all([ loadSellerProducts(appState.user.id), loadSellerOrders(appState.user.id) ]);
        appState.seller.products = products; appState.seller.orders = orders;
        updateSellerStats();
        if (appState.seller.currentTab === 'products') displaySellerProducts();
        else if (appState.seller.currentTab === 'orders') displaySellerOrders();
        else if (appState.seller.currentTab === 'analytics') updateAnalytics();
    } catch (err) { showToast(err.message, 'error'); } finally { showLoading(false); }
}
function updateSellerStats() {
    const prodCount = appState.seller.products.length, orderCount = appState.seller.orders.length, revenue = appState.seller.orders.reduce((s, o) => s + (o.total_price || 0), 0);
    document.getElementById('sellerProductCount').textContent = prodCount;
    document.getElementById('sellerOrderCount').textContent = orderCount;
    document.getElementById('sellerRevenue').textContent = revenue.toLocaleString() + ' ج.م';
    document.getElementById('totalProductsStat').textContent = prodCount;
    document.getElementById('totalOrdersStat').textContent = orderCount;
    document.getElementById('totalRevenueStat').textContent = revenue.toLocaleString() + ' ج.م';
    document.getElementById('averageOrderStat').textContent = (orderCount ? (revenue / orderCount).toFixed(0) : 0) + ' ج.م';
    const newOrders = appState.seller.orders.filter(o => o.status === 'pending').length;
    document.getElementById('sellerNotificationBadge').textContent = newOrders;
    document.getElementById('sellerNotificationBadge').style.display = newOrders ? 'flex' : 'none';
}
function displaySellerProducts(filterText = '') {
    const container = document.getElementById('sellerProductsList'); if (!container) return;
    let filtered = appState.seller.products;
    if (filterText) filtered = filtered.filter(p => p.name.toLowerCase().includes(filterText.toLowerCase()));
    if (appState.seller.filterCategory !== 'all') filtered = filtered.filter(p => p.category === appState.seller.filterCategory);
    container.innerHTML = filtered.length ? '' : '<p style="text-align:center; padding:20px;">لا توجد منتجات مطابقة</p>';
    filtered.forEach(p => {
        const div = document.createElement('div'); div.className = 'product-item';
        const imgUrl = p.images && p.images.length ? p.images[0] : (p.image_url || '');
        const imageHtml = imgUrl ? `<img src="${imgUrl}" loading="lazy" onerror="this.onerror=null; this.parentElement.innerHTML='📦';">` : '📦';
        div.innerHTML = `<div class="product-item-image">${imageHtml}</div><div class="product-item-info"><div class="product-item-name">${escapeHTML(p.name)}</div><div class="product-item-price">${p.price} ج.م</div><div class="product-item-stock">المتبقي: ${p.stock || 0}</div><div class="product-item-actions"><button class="product-action-btn edit" onclick="editProduct('${p.id}')"><i class="fas fa-edit"></i> تعديل</button><button class="product-action-btn stock" onclick="adjustStock('${p.id}')"><i class="fas fa-boxes"></i> كمية</button><button class="product-action-btn delete" onclick="confirmDelete('${p.id}')"><i class="fas fa-trash"></i> حذف</button></div></div>`;
        container.appendChild(div);
    });
}
function filterSellerProducts() { displaySellerProducts(document.getElementById('sellerProductSearch').value); }
document.querySelectorAll('#productCategoryFilters .filter-btn').forEach(btn => { btn.addEventListener('click', function() { document.querySelectorAll('#productCategoryFilters .filter-btn').forEach(b => b.classList.remove('active')); this.classList.add('active'); appState.seller.filterCategory = this.dataset.category; displaySellerProducts(document.getElementById('sellerProductSearch').value); }); });
function displaySellerOrders(filterText = '') {
    const container = document.getElementById('sellerOrdersList'); if (!container) return;
    let filtered = appState.seller.orders;
    if (filterText) filtered = filtered.filter(o => o.id.includes(filterText) || (o.customer_name && o.customer_name.includes(filterText)));
    if (appState.seller.filterOrderStatus !== 'all') filtered = filtered.filter(o => o.status === appState.seller.filterOrderStatus);
    container.innerHTML = filtered.length ? '' : '<p style="text-align:center; padding:20px;">لا توجد طلبات</p>';
    filtered.forEach(order => {
        const card = document.createElement('div'); card.className = 'order-card';
        const product = order.products || {};
        const imageHtml = product.image_url ? `<img src="${product.image_url}" loading="lazy">` : '📦';
        let actions = '';
        if (order.status === 'pending') actions = `<button class="product-action-btn edit" onclick="confirmOrderSeller('${order.id}')"><i class="fas fa-check"></i> تأكيد الطلب</button>`;
        else if (order.status === 'confirmed') actions = `<button class="product-action-btn edit" onclick="prepareOrderSeller('${order.id}')"><i class="fas fa-box"></i> تم التجهيز</button>`;
        card.innerHTML = `<div class="order-header"><span class="order-id">#${order.id.slice(0,8)}</span><span class="order-status ${order.status}">${getStatusText(order.status)}</span></div><div class="order-product"><div class="order-product-image">${imageHtml}</div><div class="order-product-details"><div>${escapeHTML(product.name || 'منتج')}</div><div>${order.total_price} ج.م × ${order.quantity}</div></div></div><div class="order-total">الإجمالي: ${order.total_price} ج.م</div><div class="order-actions">${actions}<button class="product-action-btn" onclick="viewOrderDetails('${order.id}')">تفاصيل</button></div>`;
        container.appendChild(card);
    });
}
function filterSellerOrders() { displaySellerOrders(document.getElementById('sellerOrderSearch').value); }
document.querySelectorAll('#sellerOrdersTab .filter-btn').forEach(btn => { btn.addEventListener('click', function() { document.querySelectorAll('#sellerOrdersTab .filter-btn').forEach(b => b.classList.remove('active')); this.classList.add('active'); appState.seller.filterOrderStatus = this.dataset.orderStatus; displaySellerOrders(document.getElementById('sellerOrderSearch').value); }); });
function switchSellerTab(tab) {
    appState.seller.currentTab = tab;
    document.querySelectorAll('.seller-tab').forEach((t,i) => { t.classList.toggle('active', (tab==='products' && i===0) || (tab==='orders' && i===1) || (tab==='analytics' && i===2)); });
    document.getElementById('sellerProductsTab').style.display = tab === 'products' ? 'block' : 'none';
    document.getElementById('sellerOrdersTab').style.display = tab === 'orders' ? 'block' : 'none';
    document.getElementById('sellerAnalyticsTab').style.display = tab === 'analytics' ? 'block' : 'none';
    if (tab === 'products') displaySellerProducts(document.getElementById('sellerProductSearch').value);
    else if (tab === 'orders') displaySellerOrders(document.getElementById('sellerOrderSearch').value);
    else if (tab === 'analytics') updateAnalytics();
}
function updateAnalytics() { if (appState.seller.chart) appState.seller.chart.destroy(); const ctx = document.getElementById('salesChart')?.getContext('2d'); if (!ctx) return; appState.seller.chart = new Chart(ctx, { type: 'line', data: { labels: ['يناير','فبراير','مارس','أبريل','مايو','يونيو'], datasets: [{ label: 'المبيعات', data: [12000,19000,15000,22000,18000,24000], borderColor: '#1a237e', tension: 0.1 }] } }); }
function showAddProductForm() { if (!appState.user || appState.userData.account_type !== 'seller') return showToast('غير مصرح', 'error'); document.getElementById('productModalTitle').textContent = 'إضافة منتج جديد'; document.getElementById('productName').value = ''; document.getElementById('productPrice').value = ''; document.getElementById('productStock').value = '1'; document.getElementById('productDescription').value = ''; document.getElementById('productCategory').value = ''; document.getElementById('productDiscount').value = ''; document.getElementById('editingProductId').value = ''; document.getElementById('multiImagePreview').innerHTML = ''; document.getElementById('productImages').value = ''; document.getElementById('productModal').classList.add('active'); }
function editProduct(id) { const p = appState.seller.products.find(p => p.id === id); if (!p) return; document.getElementById('productModalTitle').textContent = 'تعديل المنتج'; document.getElementById('productName').value = p.name || ''; document.getElementById('productPrice').value = p.price || ''; document.getElementById('productStock').value = p.stock || 1; document.getElementById('productDescription').value = p.description || ''; document.getElementById('productCategory').value = p.category || ''; document.getElementById('productDiscount').value = p.discount || ''; document.getElementById('editingProductId').value = id; document.getElementById('multiImagePreview').innerHTML = ''; document.getElementById('productImages').value = ''; document.getElementById('productModal').classList.add('active'); }
function confirmDelete(id) { if (confirm('هل أنت متأكد من حذف هذا المنتج؟')) { showLoading(true); deleteProduct(id).then(async () => { showToast('تم الحذف', 'success'); await refreshSellerDashboard(); await loadProductsFromDB(); loadMarketProducts(); loadFeaturedProducts(); }).catch(err => showToast(err.message, 'error')).finally(() => showLoading(false)); } }
function adjustStock(id) { const p = appState.seller.products.find(p => p.id === id); if (!p) return; const newStock = prompt('أدخل الكمية الجديدة:', p.stock || 0); if (newStock !== null && !isNaN(parseInt(newStock))) { showLoading(true); updateProduct(id, { stock: parseInt(newStock) }).then(() => { showToast('تم تحديث الكمية', 'success'); refreshSellerDashboard(); }).catch(err => showToast(err.message, 'error')).finally(() => showLoading(false)); } }
function viewOrderDetails(orderId) { const order = appState.seller.orders.find(o => o.id === orderId); if (!order) return; let html = `<p><strong>العميل:</strong> ${order.customer_name || 'غير محدد'}</p><p><strong>الهاتف:</strong> ${order.customer_phone || 'غير محدد'}</p><p><strong>العنوان:</strong> ${order.shipping_address || 'غير محدد'}</p><p><strong>التاريخ:</strong> ${new Date(order.created_at).toLocaleString('ar-EG')}</p><h4 style="margin:15px 0 10px;">المنتجات:</h4>`; const product = order.products || {}; html += `<div style="display:flex; justify-content:space-between;"><span>${escapeHTML(product.name)} x${order.quantity}</span><span>${order.total_price} ج.م</span></div>`; html += `<h3 style="margin-top:15px; color:#1a237e;">الإجمالي: ${order.total_price} ج.م</h3>`; document.getElementById('orderDetails').innerHTML = html; const select = document.getElementById('orderStatusSelect'); select.innerHTML = ['pending','confirmed','prepared','picked_up','in_delivery','delivered','cancelled'].map(s => `<option value="${s}" ${order.status === s ? 'selected' : ''}>${getStatusText(s)}</option>`).join(''); select.dataset.orderId = orderId; document.getElementById('orderModal').classList.add('active'); }
async function updateOrderStatusFromModal() { const select = document.getElementById('orderStatusSelect'); const orderId = select.dataset.orderId; const newStatus = select.value; showLoading(true); try { await updateOrderStatus(orderId, newStatus); showToast('تم تحديث الحالة', 'success'); closeOrderModal(); await refreshSellerDashboard(); } catch (err) { showToast(err.message, 'error'); } finally { showLoading(false); } }
function closeOrderModal() { document.getElementById('orderModal').classList.remove('active'); }
function closeProductModal() { document.getElementById('productModal').classList.remove('active'); }
function showNotifications() { const newOrders = appState.seller.orders.filter(o => o.status === 'pending'); if (newOrders.length === 0) { showToast('لا توجد إشعارات جديدة', 'info'); return; } let msg = 'طلبات جديدة:\n'; newOrders.forEach(o => msg += `- طلب #${o.id.slice(0,8)} بمبلغ ${o.total_price} ج.م\n`); alert(msg); document.getElementById('sellerNotificationBadge').style.display = 'none'; }
function exportOrdersCSV() { const orders = appState.seller.orders; let csv = 'رقم الطلب,العميل,الهاتف,العنوان,التاريخ,الحالة,الإجمالي\n'; orders.forEach(o => { csv += `${o.id},${o.customer_name || ''},${o.customer_phone || ''},${o.shipping_address || ''},${new Date(o.created_at).toLocaleDateString()},${o.status},${o.total_price}\n`; }); const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'orders.csv'; link.click(); }
async function confirmOrderSeller(orderId) { showLoading(true); try { const order = await updateOrderStatus(orderId, 'confirmed'); await sendNotification(order.buyer_id, 'تم تأكيد طلبك', `تم تأكيد طلبك #${orderId.slice(0,8)}`); showToast('تم تأكيد الطلب', 'success'); await refreshSellerDashboard(); } catch (err) { showToast(err.message, 'error'); } finally { showLoading(false); } }
async function prepareOrderSeller(orderId) { showLoading(true); try { const { data: order, error: fetchError } = await supabaseClient.from('orders').select('*, buyer_id, center').eq('id', orderId).single(); if (fetchError) throw fetchError; await updateOrderStatus(orderId, 'prepared'); await sendNotification(order.buyer_id, 'تم تجهيز طلبك', `طلبك #${orderId.slice(0,8)} جاهز وسيتم توصيله قريباً`); if (order.center) await notifyDeliveryPersonsInCenter(order.center, orderId, 'شحنة جاهزة في منطقتك', `طلب #${orderId.slice(0,8)} جاهز للتوصيل في ${order.center}`); showToast('تم تحديث الحالة إلى "تم التجهيز" وإشعار المناديب', 'success'); await refreshSellerDashboard(); } catch (err) { showToast(err.message, 'error'); } finally { showLoading(false); } }

// ========== خدمات ==========
function loadServices() {
    const container = document.getElementById('servicesList');
    if (!container) return;
    container.innerHTML = '';
    appState.services.forEach(s => {
        const card = document.createElement('div');
        card.className = 'service-card';
        card.innerHTML = `<div class="service-header"><div class="service-icon"><i class="${s.icon}"></i></div><div><div class="service-title">${s.name}</div><div class="service-price">${s.price}</div></div></div><div class="service-desc">${s.description}</div><button class="book-service-btn" onclick="bookService(${s.id})"><i class="fas fa-calendar-check"></i> حجز الخدمة</button>`;
        container.appendChild(card);
    });
}
function bookService(serviceId) { const service = appState.services.find(s => s.id === serviceId); if (service) showToast(`تم حجز خدمة ${service.name} بنجاح`, 'success'); }

// ========== أدوات متجر البائع ==========
function getStoreUrl() { let baseUrl = window.location.origin + window.location.pathname; baseUrl = baseUrl.split('?')[0]; if (appState.userData.username) return `${baseUrl}?store=${encodeURIComponent(appState.userData.username)}`; else return `${baseUrl}?store=${encodeURIComponent(appState.user.id)}`; }
function generateStoreQR(storeUrl, containerId) { const container = document.getElementById(containerId); if (!container) return; container.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(storeUrl)}" alt="QR Code" style="width:150px;height:150px;">`; }
function copyStoreLink(link) { navigator.clipboard.writeText(link).then(() => showToast('تم نسخ الرابط', 'success')).catch(() => showToast('فشل النسخ', 'error')); }
function shareStoreLink(link, sellerName) { if (navigator.share) { navigator.share({ title: `متجر ${sellerName} على Misar Systems`, text: 'تفضل بزيارة متجري', url: link }).catch(() => {}); } else { copyStoreLink(link); } }
async function addSellerStoreTools() { const toolsDiv = document.getElementById('sellerStoreTools'); if (!toolsDiv) return; toolsDiv.style.display = 'block'; if (!toolsDiv.dataset.initialized) { document.getElementById('copyStoreLinkBtn')?.addEventListener('click', () => { copyStoreLink(getStoreUrl()); }); document.getElementById('shareStoreLinkBtn')?.addEventListener('click', () => { shareStoreLink(getStoreUrl(), appState.userData.name || 'بائع'); }); document.getElementById('viewMyStoreBtn')?.addEventListener('click', () => { const identifier = appState.userData.username || appState.user.id; showStorePage(identifier); }); document.getElementById('downloadQRBtn')?.addEventListener('click', () => { const link = document.createElement('a'); link.download = `store_${appState.userData.username || appState.user.id}.png`; const qrImg = document.querySelector('#storeQRCode img'); if (qrImg && qrImg.src) { link.href = qrImg.src; link.click(); } else { showToast('لم يتم العثور على QR', 'error'); } }); toolsDiv.dataset.initialized = 'true'; } updateStoreTools(); }
async function updateStoreTools() { if (!appState.user || appState.userData.account_type !== 'seller') return; const linkDisplay = document.getElementById('storeLinkDisplay'); const qrContainer = document.getElementById('storeQRCode'); if (!linkDisplay || !qrContainer) return; const storeUrl = getStoreUrl(); linkDisplay.textContent = storeUrl; generateStoreQR(storeUrl, 'storeQRCode'); }

// ========== عرض صفحة متجر البائع ==========
async function showStorePage(identifier) { showLoading(true); let sellerData = null; if (identifier.startsWith('user_') || (identifier.length > 20 && identifier.includes('-'))) { const { data, error } = await supabaseClient.from('user_data').select('*').eq('id', identifier).single(); if (!error && data) sellerData = data; } else { const { data, error } = await supabaseClient.from('user_data').select('*').eq('username', identifier).single(); if (!error && data) sellerData = data; } if (!sellerData) { showLoading(false); showToast('البائع غير موجود', 'error'); showScreen('homeScreen'); return; } const { data: products } = await supabaseClient.from('products').select('*').eq('user_id', sellerData.id).order('created_at', { ascending: false }); const container = document.getElementById('storeContent'); const avatarUrl = sellerData.image_url || ''; const avatarHtml = avatarUrl ? `<img src="${avatarUrl}" alt="صورة البائع">` : '<i class="fas fa-user" style="font-size:3rem; color:#aaa;"></i>'; const bioHtml = sellerData.bio ? `<div class="store-bio">${escapeHTML(sellerData.bio)}</div>` : ''; let productsHtml = '<div class="products-grid" id="storeProductsGrid">'; if (products && products.length) { products.forEach(p => { const img = p.images && p.images[0] ? p.images[0] : (p.image_url || ''); productsHtml += `<div class="product-card" onclick="openProductDetailFromStore('${p.id}')"><div class="product-image"><img src="${img}" loading="lazy" onerror="this.onerror=null;this.parentElement.innerHTML='<div>📦</div>';"> <div class="product-tag">${p.category || 'عام'}</div></div><div class="product-info"><div class="product-title">${escapeHTML(p.name)}</div><div class="product-price">${p.price} ج.م</div><button class="add-to-cart" onclick="event.stopPropagation(); addToCart('${p.id}')"><i class="fas fa-cart-plus"></i> إضافة للسلة</button></div></div>`; }); } else { productsHtml += '<p style="grid-column:span2; text-align:center; padding:30px;">لا توجد منتجات متاحة حالياً</p>'; } productsHtml += '</div>'; container.innerHTML = `<div class="store-header"><div class="store-avatar">${avatarHtml}</div><div class="store-name">${escapeHTML(sellerData.name || sellerData.email?.split('@')[0] || 'بائع')}</div>${bioHtml}</div><div class="store-products"><h2 style="color:#1a237e; margin-bottom:15px;">جميع المنتجات</h2>${productsHtml}</div>`; showLoading(false); showScreen('storeScreen'); }
function openProductDetailFromStore(productId) { const product = appState.products.find(p => p.id === productId); if (product) openProductDetail(product); else showToast('المنتج غير موجود', 'error'); }

// ========== تحديث بيانات المستخدم يدوياً ==========
async function refreshUserDataManually() {
    if (!appState.user) {
        showToast('يجب تسجيل الدخول أولاً', 'warning');
        return;
    }
    showLoading(true);
    try {
        await loadUserData();
        showToast('تم تحديث البيانات بنجاح', 'success');
    } catch (error) {
        showToast('فشل تحديث البيانات: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}
window.refreshUserDataManually = refreshUserDataManually;

// ===================== تصدير الدوال العامة =====================
window.loadProductsFromDB = loadProductsFromDB;
window.loadFeaturedProducts = loadFeaturedProducts;
window.loadMarketProducts = loadMarketProducts;
window.filterMarketProducts = filterMarketProducts;
window.clearSearch = clearSearch;
window.createProductCard = createProductCard;
window.loadSellerProducts = loadSellerProducts;
window.addProduct = addProduct;
window.updateProduct = updateProduct;
window.deleteProduct = deleteProduct;
window.saveProduct = saveProduct;
window.previewMultipleImages = previewMultipleImages;
window.refreshSellerDashboard = refreshSellerDashboard;
window.updateSellerStats = updateSellerStats;
window.displaySellerProducts = displaySellerProducts;
window.displaySellerOrders = displaySellerOrders;
window.filterSellerProducts = filterSellerProducts;
window.filterSellerOrders = filterSellerOrders;
window.switchSellerTab = switchSellerTab;
window.updateAnalytics = updateAnalytics;
window.showAddProductForm = showAddProductForm;
window.editProduct = editProduct;
window.confirmDelete = confirmDelete;
window.adjustStock = adjustStock;
window.viewOrderDetails = viewOrderDetails;
window.updateOrderStatusFromModal = updateOrderStatusFromModal;
window.closeOrderModal = closeOrderModal;
window.closeProductModal = closeProductModal;
window.showNotifications = showNotifications;
window.exportOrdersCSV = exportOrdersCSV;
window.confirmOrderSeller = confirmOrderSeller;
window.prepareOrderSeller = prepareOrderSeller;
window.loadServices = loadServices;
window.bookService = bookService;
window.addSellerStoreTools = addSellerStoreTools;
window.updateStoreTools = updateStoreTools;
window.getStoreUrl = getStoreUrl;
window.generateStoreQR = generateStoreQR;
window.copyStoreLink = copyStoreLink;
window.shareStoreLink = shareStoreLink;
window.showStorePage = showStorePage;
window.openProductDetailFromStore = openProductDetailFromStore;
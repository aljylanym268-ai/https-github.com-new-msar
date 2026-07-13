// ========== قاعدة البيانات ==========
const SUPABASE_URL = 'https://wwojtkxwmgkrudtevbcb.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Rqi9qMZgIrslWSDc61gG-A_QGQxcvNr';
const { createClient } = supabase;

const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ========== الحالة العامة ==========
const appState = {
    user: null,
    userData: {},
    location: null,
    products: [],
    currentProduct: null,
    services: [
        { id:1, name:"خدمات الصيانة", description:"صيانة منزلية، تصليح أجهزة كهربائية، سباكة", price:"150 ج.م", icon:"fas fa-tools" },
        { id:2, name:"خدمات التوصيل", description:"توصيل طلبات، نقل عفش، توصيل وثائق", price:"50 ج.م", icon:"fas fa-shipping-fast" },
        { id:3, name:"خدمات تعليمية", description:"دروس خصوصية، دورات تدريبية، استشارات تعليمية", price:"100 ج.م/ساعة", icon:"fas fa-graduation-cap" }
    ],
    villagesByCenter: {
        'قنا': ['قنا البلد','الشرق','الغرب','الكويت','الساحل'],
        'نقادة': ['نقادة','الركاب','الكلاحين','الزوايدة'],
        'قوص': ['قوص','العيايشة','الأشراف','المخادمة'],
        'دشنا': ['دشنا','أبو دياب','السمطا','العويضات'],
        'فرشوط': ['فرشوط','الكوم الأحمر','النجوع','الرواتب'],
        'أبو تشت': ['أبو تشت','البلابيش','النجوع','الرئيسية'],
        'نجع حمادي': ['نجع حمادي','الطود','الحلفاية','الغربية'],
        'قفط': ['قفط','القلعة','الرفش','الصباب']
    },
    seller: { products: [], orders: [], currentTab: 'products', filterCategory: 'all', filterOrderStatus: 'all', chart: null },
    delivery: { availableOrders: [], myOrders: [], currentTab: 'available' },
    tempImages: [],
    founderPageVisible: true,
    founderViews: 0,
    founderShares: { whatsapp:0, facebook:0, twitter:0, copy:0 },
    previousScreen: 'homeScreen',
    currentScreen: 'homeScreen',
    ordersSubscription: null,
    notificationsSubscription: null
};

// ========== دوال مساعدة ==========
function getBearElement() { return document.querySelector('.bear-avatar'); }
function setBearExpression(expression) {
    const bear = getBearElement();
    if (!bear) return;
    bear.classList.remove('sad', 'happy', 'covering-eyes', 'blink');
    if (expression === 'sad') bear.classList.add('sad');
    else if (expression === 'happy') bear.classList.add('happy');
    else if (expression === 'covering') bear.classList.add('covering-eyes');
    else if (expression === 'blink') { bear.classList.add('blink'); setTimeout(() => bear.classList.remove('blink'), 300); }
}
function showBearReaction(success) { setBearExpression(success ? 'happy' : 'sad'); setTimeout(() => setBearExpression(''), 1500); }
function showLoading(show = true) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.toggle('active', show);
}
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-exclamation-triangle'}"></i> ${message}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}
function escapeHTML(str) { return String(str).replace(/[&<>"]/g, function(m) { if (m === '&') return '&amp;'; if (m === '<') return '&lt;'; if (m === '>') return '&gt;'; if (m === '"') return '&quot;'; return m; }); }

// ========== توليد رمز OTP ==========
function generateOTP(length = 6) {
    const digits = '0123456789';
    let otp = '';
    for (let i = 0; i < length; i++) {
        otp += digits[Math.floor(Math.random() * 10)];
    }
    console.log('🟡 [generateOTP] تم إنشاء رمز:', otp);
    return otp;
}

// ========== ضغط الصور ==========
async function compressImage(file, maxWidth = 1024, maxHeight = 1024, quality = 0.8) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
            const img = new Image();
            img.src = e.target.result;
            img.onload = () => {
                let width = img.width, height = img.height;
                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round(height * (maxWidth / width));
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round(width * (maxHeight / height));
                        height = maxHeight;
                    }
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => {
                    if (!blob) reject(new Error('فشل ضغط الصورة'));
                    else resolve(new File([blob], file.name, { type: file.type, lastModified: Date.now() }));
                }, file.type, quality);
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
}

// ========== رفع صور المنتجات ==========
async function uploadProductImages(files) {
    if (!files || files.length === 0) return [];
    const urls = [];
    for (const file of files) {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) throw new Error(`نوع الملف ${file.name} غير مدعوم`);
        if (file.size > 10 * 1024 * 1024) throw new Error(`الملف ${file.name} كبير جداً (الحد 10 ميجابايت)`);
        const compressed = await compressImage(file, 1024, 1024, 0.8);
        const uniqueName = `product-${Date.now()}-${Math.random().toString(36).substring(2)}.${file.name.split('.').pop()}`;
        const filePath = `products/${uniqueName}`;
        const { error } = await supabaseClient.storage.from('product-images').upload(filePath, compressed, { cacheControl: '3600', upsert: false });
        if (error) throw new Error(`فشل رفع ${file.name}: ${error.message}`);
        const { data: { publicUrl } } = supabaseClient.storage.from('product-images').getPublicUrl(filePath);
        urls.push(publicUrl);
    }
    return urls;
}

// ========== المصادقة ==========
async function signInWithGoogle() {
    const loginAccountType = document.getElementById('loginAccountType');
    if (!loginAccountType) {
        showToast('خطأ في النموذج', 'error');
        return;
    }
    sessionStorage.setItem('pendingAccountType', loginAccountType.value);
    const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin + window.location.pathname
        }
    });
    if (error) {
        showToast(error.message, 'error');
        showBearReaction(false);
    }
}

async function signInWithEmail() {
    const emailInput = document.getElementById('loginEmail');
    const passwordInput = document.getElementById('loginPassword');
    if (!emailInput || !passwordInput) {
        showToast('النموذج غير متوفر', 'error');
        return;
    }
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!email || !password) {
        showToast('يرجى إدخال البريد وكلمة المرور', 'warning');
        return;
    }
    showLoading(true);
    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        showBearReaction(true);
    } catch (error) {
        showToast(error.message, 'error');
        showBearReaction(false);
    } finally {
        showLoading(false);
    }
}

function extractErrorMessage(error) {
    if (!error) return 'حدث خطأ غير معروف (الخطأ فارغ).';
    if (typeof error === 'string') return error;
    if (error.message) return error.message;
    if (error.error_description) return error.error_description;
    if (error.details) return error.details;
    if (error.code) {
        const codeMap = {
            'user_already_exists': 'هذا البريد الإلكتروني مسجل بالفعل.',
            'weak_password': 'كلمة المرور ضعيفة جداً. استخدم 8 أحرف على الأقل مع أرقام ورموز.',
            'invalid_email': 'البريد الإلكتروني غير صحيح.',
            'email_not_confirmed': 'يجب تأكيد البريد الإلكتروني أولاً.',
            'signup_disabled': 'التسجيل معطل حالياً، حاول لاحقاً.'
        };
        return codeMap[error.code] || `خطأ برمز: ${error.code}`;
    }
    try {
        const str = JSON.stringify(error);
        if (str && str !== '{}') return str;
    } catch (e) {}
    const props = Object.getOwnPropertyNames(error).filter(p => p !== 'stack').map(p => `${p}: ${error[p]}`).join(', ');
    if (props) return `خطأ (${error.constructor?.name || 'Unknown'}): ${props}`;
    return 'حدث خطأ غير معروف (لم نتمكن من استخراج رسالة).';
}

async function signUpWithEmail() {
    const nameInput = document.getElementById('registerName');
    const emailInput = document.getElementById('registerEmail');
    const passwordInput = document.getElementById('registerPassword');
    const confirmInput = document.getElementById('registerConfirmPassword');
    const accountTypeSelect = document.getElementById('registerAccountType');
    const governorateSelect = document.getElementById('registerGovernorate');

    if (!emailInput || !passwordInput || !confirmInput || !accountTypeSelect) {
        showToast('النموذج غير مكتمل، أعد تحميل الصفحة', 'error');
        return;
    }

    const name = nameInput ? nameInput.value.trim() : '';
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirm = confirmInput.value;
    let accountType = accountTypeSelect.value;
    let deliveryCenter = '';
    let governorate = governorateSelect ? governorateSelect.value : 'قنا';

    if (accountType === 'delivery') {
        const centerSelect = document.getElementById('deliveryCenterSelect');
        if (!centerSelect) {
            showToast('النموذج غير مكتمل', 'error');
            return;
        }
        deliveryCenter = centerSelect.value;
        if (!deliveryCenter) {
            showToast('يرجى اختيار المركز للمندوب', 'warning');
            return;
        }
    }

    if (!email || !password || !confirm) {
        showToast('يرجى ملء جميع الحقول المطلوبة', 'warning');
        return;
    }
    if (password !== confirm) {
        showToast('كلمة المرور غير متطابقة', 'error');
        return;
    }
    if (password.length < 6) {
        showToast('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'warning');
        return;
    }

    // حساب المؤسس الثابت
    if (email === 'sa3dgelany@gmail.com') {
        accountType = 'founder';
        if (password !== '123456') {
            showToast('كلمة المرور الخاصة بحساب المؤسس غير صحيحة (يجب أن تكون 123456)', 'error');
            return;
        }
    }

    const metadata = {
        account_type: accountType,
        full_name: name || undefined,
        governorate: governorate
    };
    if (accountType === 'delivery') {
        metadata.center = deliveryCenter;
        metadata.status = 'pending';
    }

    showLoading(true);

    try {
        const { data, error } = await supabaseClient.auth.signUp({
            email,
            password,
            options: {
                data: metadata,
                emailRedirectTo: window.location.origin
            }
        });

        if (error) {
            console.group('❌ خطأ Supabase أثناء التسجيل');
            console.error('نوع الخطأ:', typeof error);
            console.error('منشئ الخطأ:', error.constructor?.name);
            console.dir(error, { depth: null, colors: true });
            console.groupEnd();
            const userMessage = extractErrorMessage(error);
            showToast(userMessage, 'error');
            showBearReaction(false);
            showLoading(false);
            return;
        }

        if (!data?.user) {
            showToast('فشل إنشاء الحساب، يرجى المحاولة مرة أخرى', 'error');
            showLoading(false);
            return;
        }

        if (data.user.identities?.length === 0) {
            showToast('هذا البريد مسجل بالفعل، يرجى تسجيل الدخول', 'warning');
            showScreen('loginScreen');
            showLoading(false);
            return;
        }

        // حفظ بيانات المستخدم في جدول user_data
        try {
            const userDataToInsert = {
                id: data.user.id,
                name: name || data.user.email?.split('@')[0] || '',
                account_type: accountType,
                governorate: governorate || 'قنا',
                center: deliveryCenter || '',
                status: accountType === 'delivery' ? 'pending' : 'approved',
            };
            const { error: insertError } = await supabaseClient
                .from('user_data')
                .upsert(userDataToInsert, { onConflict: 'id' });
            if (insertError) {
                console.warn('⚠️ فشل إدراج بيانات المستخدم في user_data:', insertError);
                showToast('تم إنشاء الحساب ولكن فشل حفظ البيانات الشخصية، يمكنك تحديثها لاحقاً من الملف الشخصي.', 'warning');
            } else {
                console.log('✅ تم حفظ بيانات المستخدم في user_data بنجاح.');
            }
        } catch (insertErr) {
            console.warn('⚠️ خطأ غير متوقع أثناء إدراج user_data:', insertErr);
        }

        // تسجيل الدخول التلقائي
        try {
            const { error: signInError } = await supabaseClient.auth.signInWithPassword({ email, password });
            if (signInError) {
                showToast('تم إنشاء الحساب ولكن فشل تسجيل الدخول التلقائي. سجل دخول يدوياً.', 'info');
                showScreen('loginScreen');
            } else {
                showToast('تم إنشاء الحساب وتسجيل الدخول بنجاح!', 'success');
                showBearReaction(true);
                appState.user = { id: data.user.id, email: data.user.email, user_metadata: data.user.user_metadata };
                await loadUserData();
                toggleLoginMenu(true);
                const isSeller = appState.userData?.account_type === 'seller';
                const isDelivery = appState.userData?.account_type === 'delivery';
                const isFounder = appState.userData?.account_type === 'founder';
                toggleSellerMenuItem(isSeller);
                toggleDeliveryMenuItem(isDelivery);
                toggleFounderMenuItem(isFounder);
                await updateCartBadgeFromDB();
                if (isSeller) showScreen('sellerDashboardScreen');
                else if (isDelivery) showScreen('deliveryDashboardScreen');
                else showScreen('homeScreen');
            }
        } catch (autoLoginErr) {
            console.warn('فشل تسجيل الدخول التلقائي:', autoLoginErr);
            showToast('تم التسجيل، يرجى تسجيل الدخول', 'info');
            showScreen('loginScreen');
        }

        if (accountType === 'founder') {
            setTimeout(() => initFounderSettings(), 2000);
        }

    } catch (unexpectedError) {
        console.error('❌ خطأ غير متوقع أثناء التسجيل:', unexpectedError);
        let msg = 'حدث خطأ غير متوقع. حاول مرة أخرى.';
        if (unexpectedError.message) {
            msg = unexpectedError.message;
        } else if (typeof unexpectedError === 'string') {
            msg = unexpectedError;
        }
        showToast(msg, 'error');
        showBearReaction(false);
    } finally {
        showLoading(false);
    }
}

async function logout(showConfirm = true) {
    if (showConfirm && !confirm('هل أنت متأكد من تسجيل الخروج؟')) return;
    showLoading(true);
    try {
        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;
        sessionStorage.removeItem('pendingAccountType');
        appState.user = null;
        appState.userData = {};
        toggleLoginMenu(false);
        toggleSellerMenuItem(false);
        toggleDeliveryMenuItem(false);
        toggleFounderMenuItem(false);
        updateUserInfo(true);
        await loadCart();
        await updateCartBadgeFromDB();
        showScreen('homeScreen');
        showToast('تم تسجيل الخروج', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function switchAccount() { if (appState.user) await logout(false); showScreen('loginScreen'); }
function confirmLogout() { logout(true); }

function toggleLoginMenu(isLoggedIn) {
    const loginItem = document.getElementById('loginMenuItem');
    const logoutItem = document.getElementById('logoutMenuItem');
    if (loginItem) loginItem.style.display = isLoggedIn ? 'none' : 'flex';
    if (logoutItem) logoutItem.style.display = isLoggedIn ? 'flex' : 'none';
}
function toggleSellerMenuItem(isSeller) {
    const sellerItem = document.getElementById('sellerDashboardMenuItem');
    if (sellerItem) sellerItem.style.display = isSeller ? 'flex' : 'none';
    const sellerExtra = document.getElementById('sellerExtraFields');
    if (sellerExtra) sellerExtra.style.display = isSeller ? 'block' : 'none';
}
function toggleDeliveryMenuItem(isDelivery) {
    const deliveryItem = document.getElementById('deliveryDashboardMenuItem');
    if (deliveryItem) deliveryItem.style.display = isDelivery ? 'flex' : 'none';
}
function toggleFounderMenuItem(isFounder) {
    const founderItem = document.getElementById('founderDashboardMenuItem');
    if (founderItem) founderItem.style.display = isFounder ? 'flex' : 'none';
}

// ========== تحميل بيانات المستخدم ==========
async function loadUserData() {
    if (!appState.user) return;
    try {
        const { data, error } = await supabaseClient
            .from('user_data')
            .select('*')
            .eq('id', appState.user.id)
            .maybeSingle();

        const defaultData = {
            id: appState.user.id,
            name: appState.user.user_metadata?.full_name || appState.user.email?.split('@')[0] || '',
            phone: '',
            governorate: appState.user.user_metadata?.governorate || 'قنا',
            center: appState.user.user_metadata?.center || '',
            village: '',
            image_url: appState.user.user_metadata?.avatar_url || '',
            account_type: appState.user.user_metadata?.account_type || 'client',
            status: appState.user.user_metadata?.status || 'approved'
        };

        if (error) {
            console.error('خطأ في جلب بيانات المستخدم:', error);
            const { error: upsertError } = await supabaseClient.from('user_data').upsert(defaultData);
            if (upsertError) {
                console.error('فشل إنشاء سجل المستخدم:', upsertError);
                appState.userData = defaultData;
            } else {
                appState.userData = defaultData;
            }
        } else if (data) {
            appState.userData = data;
        } else {
            await supabaseClient.from('user_data').upsert(defaultData);
            appState.userData = defaultData;
        }

        if (!appState.userData || Object.keys(appState.userData).length === 0) {
            appState.userData = defaultData;
        }

        if (appState.userData) {
            appState.location = {
                governorate: appState.userData.governorate || 'قنا',
                center: appState.userData.center || '',
                village: appState.userData.village || ''
            };
        }

        updateUserInfo();
        updateWelcomeLocation();
        updateProfileLocation();

        const isSeller = appState.userData.account_type === 'seller';
        const isDelivery = appState.userData.account_type === 'delivery';
        const isFounder = appState.userData.account_type === 'founder';

        toggleSellerMenuItem(isSeller);
        toggleDeliveryMenuItem(isDelivery);
        toggleFounderMenuItem(isFounder);

        if (isSeller) {
            if (typeof addSellerStoreTools === 'function') {
                setTimeout(() => addSellerStoreTools(), 500);
            }
        }
        if (isFounder) {
            await initFounderSettings();
            await loadFounderStats();
            await loadPendingDeliveries();
        }

        await updateCartBadgeFromDB();
        await loadUnreadNotificationsCount();
        setupRealtimeSubscriptions();

    } catch (error) {
        console.error('loadUserData error:', error);
        showToast('حدث خطأ في تحميل بيانات المستخدم', 'error');
        if (!appState.userData || Object.keys(appState.userData).length === 0) {
            appState.userData = {
                id: appState.user.id,
                name: appState.user.email?.split('@')[0] || 'مستخدم',
                account_type: 'client'
            };
            updateUserInfo();
        }
    }
}

// ========== تحديث معلومات المستخدم في الواجهة ==========
function updateUserInfo(isGuest = false) {
    const welcomeName = document.getElementById('welcomeName');
    const welcomeAvatar = document.getElementById('welcomeAvatar');
    const profileName = document.getElementById('profileName');
    const profileEmail = document.getElementById('profileEmail');
    const profileAvatar = document.getElementById('profileAvatar');
    const editAvatarImg = document.getElementById('editAvatarImg');
    const editAvatarIcon = document.getElementById('editAvatarIcon');

    if (isGuest || !appState.user) {
        if (welcomeName) welcomeName.textContent = 'مرحباً، زائر';
        if (welcomeAvatar) welcomeAvatar.innerHTML = '<i class="fas fa-user"></i>';
        if (profileName) profileName.textContent = 'زائر';
        if (profileEmail) profileEmail.textContent = 'غير مسجل';
        if (profileAvatar) profileAvatar.innerHTML = '<i class="fas fa-user"></i>';
        if (editAvatarImg) { editAvatarImg.style.display = 'none'; if (editAvatarIcon) editAvatarIcon.style.display = 'block'; }
    } else {
        const name = appState.userData.name || appState.user.user_metadata?.full_name || appState.user.email?.split('@')[0] || 'مستخدم';
        const email = appState.user.email;
        const avatar = appState.userData.image_url || appState.user.user_metadata?.avatar_url;

        if (welcomeName) welcomeName.textContent = `مرحباً، ${name}`;
        if (profileName) profileName.textContent = name;
        if (profileEmail) profileEmail.textContent = email;

        if (avatar) {
            const imgHtml = `<img src="${avatar}" alt="صورة المستخدم" onerror="this.onerror=null; this.parentElement.innerHTML='<i class=\"fas fa-user\"></i>';">`;
            if (welcomeAvatar) welcomeAvatar.innerHTML = imgHtml;
            if (profileAvatar) profileAvatar.innerHTML = imgHtml;
            if (editAvatarImg) {
                editAvatarImg.src = avatar;
                editAvatarImg.style.display = 'block';
                if (editAvatarIcon) editAvatarIcon.style.display = 'none';
                editAvatarImg.onerror = function() {
                    this.style.display = 'none';
                    if (editAvatarIcon) editAvatarIcon.style.display = 'block';
                };
            }
        } else {
            if (welcomeAvatar) welcomeAvatar.innerHTML = '<i class="fas fa-user"></i>';
            if (profileAvatar) profileAvatar.innerHTML = '<i class="fas fa-user"></i>';
            if (editAvatarImg) { editAvatarImg.style.display = 'none'; if (editAvatarIcon) editAvatarIcon.style.display = 'block'; }
        }

        const editName = document.getElementById('editName');
        if (editName) editName.value = appState.userData.name || '';
        const editPhone = document.getElementById('editPhone');
        if (editPhone) editPhone.value = appState.userData.phone || '';
        const editCenter = document.getElementById('editCenter');
        if (editCenter) editCenter.value = appState.userData.center || '';
        const editVillage = document.getElementById('editVillage');
        if (editVillage) editVillage.value = appState.userData.village || '';
        const editUsername = document.getElementById('editUsername');
        if (editUsername) editUsername.value = appState.userData.username || '';
        const editBio = document.getElementById('editBio');
        if (editBio) editBio.value = appState.userData.bio || '';
    }
}

// ========== الموقع ==========
function loadVillagesForCenter(center, selectedVillage = '') {
    const villageSelect = document.getElementById('villageSelect');
    if (!villageSelect) {
        console.warn('⚠️ عنصر villageSelect غير موجود في الصفحة');
        return;
    }
    
    // تفريغ القائمة الحالية
    villageSelect.innerHTML = '<option value="">اختر القرية</option>';
    
    // إذا كان المركز موجوداً في القائمة، أضف القرى
    if (center && appState.villagesByCenter[center]) {
        const villages = appState.villagesByCenter[center];
        villages.forEach(village => {
            const option = document.createElement('option');
            option.value = village;
            option.textContent = village;
            villageSelect.appendChild(option);
        });
    } else {
        console.log(`لا توجد قرى مسجلة للمركز: ${center}`);
    }
    
    // تحديد القرية المختارة سابقاً (إن وجدت)
    if (selectedVillage && villageSelect.querySelector(`option[value="${selectedVillage}"]`)) {
        villageSelect.value = selectedVillage;
    }
}

async function saveLocation() {
    const governorateSelect = document.getElementById('governorateSelect');
    const centerSelect = document.getElementById('centerSelect');
    const villageSelect = document.getElementById('villageSelect');
    
    if (!centerSelect || !villageSelect) {
        showToast('النموذج غير متوفر', 'error');
        return;
    }
    
    const governorate = governorateSelect ? governorateSelect.value : 'قنا';
    const center = centerSelect.value;
    const village = villageSelect.value;
    
    if (!center || !village) {
        showToast('يرجى اختيار المركز والقرية', 'warning');
        return;
    }
    
    appState.location = { governorate, center, village };
    
    if (appState.user) {
        try {
            const { error } = await supabaseClient
                .from('user_data')
                .upsert({ 
                    id: appState.user.id, 
                    governorate, 
                    center, 
                    village 
                });
            if (error) throw error;
            
            appState.userData.governorate = governorate;
            appState.userData.center = center;
            appState.userData.village = village;
            
        } catch (error) {
            showToast('فشل حفظ الموقع في قاعدة البيانات', 'error');
            console.error(error);
            return;
        }
    } else {
        localStorage.setItem('misarUserLocation', JSON.stringify(appState.location));
    }
    
    updateWelcomeLocation();
    updateProfileLocation();
    showToast('تم حفظ موقعك بنجاح', 'success');
    
    if (appState.previousScreen === 'profileScreen') {
        showScreen('profileScreen');
    } else {
        showScreen('homeScreen');
    }
}

function openLocationSettings() {
    showScreen('locationScreen');
    setTimeout(() => {
        const loc = appState.user ? appState.userData : appState.location;
        if (!loc) return;
        
        const center = loc.center || '';
        const village = loc.village || '';
        
        const centerSelect = document.getElementById('centerSelect');
        if (centerSelect) {
            centerSelect.value = center;
        }
        
        // تحميل القرى بناءً على المركز المختار
        loadVillagesForCenter(center, village);
    }, 150);
}

function updateWelcomeLocation() {
    const el = document.getElementById('welcomeLocation');
    if (!el) return;
    const loc = appState.user ? appState.userData : appState.location;
    if (loc && loc.center) {
        const parts = [loc.governorate || 'قنا', loc.center, loc.village || ''].filter(Boolean);
        el.textContent = `📍 ${parts.join(' - ')}`;
    } else {
        el.textContent = '📍 موقعك: غير محدد';
    }
}

function updateProfileLocation() {
    const el = document.getElementById('profileLocation');
    if (!el) return;
    const loc = appState.user ? appState.userData : appState.location;
    if (loc && loc.center) {
        const parts = [loc.governorate || 'قنا', loc.center, loc.village || ''].filter(Boolean);
        el.textContent = `المنطقة: ${parts.join(' - ')}`;
    } else {
        el.textContent = 'المنطقة: غير محددة';
    }
}

// ========== حفظ الملف الشخصي ==========
async function saveProfile() {
    if (!appState.user) return showToast('يجب تسجيل الدخول أولاً', 'warning');
    const editName = document.getElementById('editName');
    const editPhone = document.getElementById('editPhone');
    if (!editName || !editPhone) {
        showToast('النموذج غير مكتمل', 'error');
        return;
    }
    const name = editName.value.trim();
    const phone = editPhone.value.trim();
    const editUsername = document.getElementById('editUsername');
    const editBio = document.getElementById('editBio');
    const username = editUsername ? editUsername.value.trim() : null;
    const bio = editBio ? editBio.value.trim() : null;
    const updates = { id: appState.user.id };
    if (name) updates.name = name;
    if (phone) updates.phone = phone;
    if (appState.userData.account_type === 'seller') {
        if (username) {
            const { data: existing } = await supabaseClient.from('user_data').select('id').eq('username', username).neq('id', appState.user.id).maybeSingle();
            if (existing) { showToast('اسم المستخدم مستخدم بالفعل', 'error'); return; }
            updates.username = username;
        }
        if (bio) updates.bio = bio;
    }
    if (Object.keys(updates).length === 1) return showToast('لا توجد تغييرات', 'info');
    showLoading(true);
    try {
        const { error } = await supabaseClient.from('user_data').upsert(updates);
        if (error) throw error;
        await loadUserData();
        showToast('تم حفظ التغييرات', 'success');
        goBack();
        if (appState.userData.account_type === 'seller') {
            if (typeof addSellerStoreTools === 'function') {
                addSellerStoreTools();
                if (typeof updateStoreTools === 'function') updateStoreTools();
            }
        }
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// ========== رفع الصورة الشخصية ==========
document.getElementById('avatarUpload')?.addEventListener('change', async function(e) {
    const file = e.target.files[0];
    if (!file || !appState.user) return;
    if (!file.type.startsWith('image/')) return showToast('يرجى اختيار صورة', 'warning');
    if (file.size > 5 * 1024 * 1024) return showToast('الحد الأقصى 5 ميجابايت', 'warning');

    const reader = new FileReader();
    reader.onload = function(ev) {
        const preview = document.getElementById('editAvatarImg');
        if (preview) {
            preview.src = ev.target.result;
            preview.style.display = 'block';
            document.getElementById('editAvatarIcon').style.display = 'none';
        }
    };
    reader.readAsDataURL(file);

    showLoading(true);
    try {
        const compressed = await compressImage(file, 512, 512, 0.8);
        const ext = file.name.split('.').pop();
        const path = `avatars/${appState.user.id}-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabaseClient.storage.from('user-images').upload(path, compressed);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabaseClient.storage.from('user-images').getPublicUrl(path);

        const { error: updateError } = await supabaseClient
            .from('user_data')
            .upsert({ id: appState.user.id, image_url: publicUrl });
        if (updateError) throw updateError;

        appState.userData.image_url = publicUrl;
        updateUserInfo();
        showToast('تم رفع الصورة الشخصية بنجاح', 'success');
    } catch (err) {
        showToast(err.message, 'error');
        console.error(err);
    } finally {
        showLoading(false);
    }
});

// ========== إعدادات المؤسس ==========
async function loadGlobalFounderVisibility() {
    try {
        const { data, error } = await supabaseClient
            .from('founder_settings')
            .select('page_visible')
            .eq('id', 1)
            .maybeSingle();

        if (error) throw error;

        if (data && data.page_visible !== undefined) {
            appState.founderPageVisible = data.page_visible;
            localStorage.setItem('founder_page_visible', String(data.page_visible));
            console.log('✅ تم تحميل رؤية المؤسس من DB:', appState.founderPageVisible);
        } else {
            const saved = localStorage.getItem('founder_page_visible');
            appState.founderPageVisible = saved !== null ? saved === 'true' : true;
        }
    } catch (error) {
        console.warn('⚠️ فشل تحميل إعدادات المؤسس من DB، استخدام localStorage:', error);
        const saved = localStorage.getItem('founder_page_visible');
        appState.founderPageVisible = saved !== null ? saved === 'true' : true;
    }

    const toggleSwitch = document.getElementById('toggleFounderPage');
    if (toggleSwitch && appState.user && appState.userData.account_type === 'founder') {
        toggleSwitch.checked = appState.founderPageVisible;
    }
}

async function handleToggleChange(e) {
    const newValue = e.target.checked;
    appState.founderPageVisible = newValue;
    localStorage.setItem('founder_page_visible', String(newValue));

    try {
        const { error } = await supabaseClient
            .from('founder_settings')
            .upsert({ id: 1, page_visible: newValue, updated_at: new Date() });

        if (error) throw error;
        showToast(newValue ? '✅ تم إظهار صفحة المؤسس للجميع' : '✅ تم إخفاء صفحة المؤسس عن الجميع', 'success');
    } catch (error) {
        appState.founderPageVisible = !newValue;
        localStorage.setItem('founder_page_visible', String(!newValue));
        const toggleSwitch = document.getElementById('toggleFounderPage');
        if (toggleSwitch) toggleSwitch.checked = !newValue;
        showToast('❌ فشل حفظ الإعداد في قاعدة البيانات: ' + error.message, 'error');
        console.error('❌ فشل upsert founder_settings:', error);
    }
}

function openFounderProfile() {
    if (!appState.founderPageVisible) {
        showToast('⛔ صفحة المؤسس غير متاحة حالياً', 'warning');
        return;
    }
    closeChatbot();
    const founderScreen = document.getElementById('founderProfileScreen');
    if (founderScreen) founderScreen.classList.add('active');
    loadShareCounts();
    const shareLinkSpan = document.getElementById('founderShareLink');
    if (shareLinkSpan) shareLinkSpan.textContent = getFounderShareLink();
    trackFounderView();
}

async function initFounderSettings() {
    await loadGlobalFounderVisibility();
    const toggleSwitch = document.getElementById('toggleFounderPage');
    if (toggleSwitch && appState.user && appState.userData.account_type === 'founder') {
        toggleSwitch.removeEventListener('change', handleToggleChange);
        toggleSwitch.addEventListener('change', handleToggleChange);
    }
}

// ========== دوال المؤسس ==========
async function loadFounderStats() {
    try {
        const { data, error } = await supabaseClient.from('founder_views').select('count').eq('id',1).single();
        if (!error && data) appState.founderViews = data.count || 0;
        else appState.founderViews = parseInt(localStorage.getItem('founder_views') || '0');
    } catch(e) { appState.founderViews = parseInt(localStorage.getItem('founder_views') || '0'); }
    const viewsEl = document.getElementById('founderViewsCount');
    if (viewsEl) viewsEl.textContent = appState.founderViews;
    try {
        const { data, error } = await supabaseClient.from('founder_shares').select('count');
        if (!error && data) {
            const total = data.reduce((sum, s) => sum + (s.count || 0), 0);
            const sharesEl = document.getElementById('founderSharesTotal');
            if (sharesEl) sharesEl.textContent = total;
        } else {
            let total = 0;
            ['whatsapp','facebook','twitter','copy'].forEach(t => {
                total += parseInt(localStorage.getItem(`share_${t}`) || '0');
            });
            const sharesEl = document.getElementById('founderSharesTotal');
            if (sharesEl) sharesEl.textContent = total;
        }
    } catch(e) {
        let total = 0;
        ['whatsapp','facebook','twitter','copy'].forEach(t => {
            total += parseInt(localStorage.getItem(`share_${t}`) || '0');
        });
        const sharesEl = document.getElementById('founderSharesTotal');
        if (sharesEl) sharesEl.textContent = total;
    }
}
async function refreshFounderStats() { await loadFounderStats(); showToast('تم تحديث الإحصائيات', 'success'); }
async function trackFounderView() {
    try { await supabaseClient.rpc('increment_founder_view'); } catch(e) {
        let current = parseInt(localStorage.getItem('founder_views') || '0');
        current++;
        localStorage.setItem('founder_views', current);
        appState.founderViews = current;
    }
    const viewsEl = document.getElementById('founderViewsCount');
    if (viewsEl) viewsEl.textContent = appState.founderViews;
}
async function trackShare(shareType) {
    try {
        const { data, error } = await supabaseClient.from('founder_shares').select('count').eq('share_type', shareType).maybeSingle();
        if (error) throw error;
        let newCount = 1;
        if (data && data.count !== undefined) {
            newCount = data.count + 1;
            await supabaseClient.from('founder_shares').update({ count: newCount, updated_at: new Date() }).eq('share_type', shareType);
        } else {
            await supabaseClient.from('founder_shares').insert({ share_type: shareType, count: 1 });
        }
        const span = document.getElementById(`shareCount_${shareType}`);
        if (span) span.textContent = newCount;
        const { data: allShares } = await supabaseClient.from('founder_shares').select('count');
        if (allShares) {
            const total = allShares.reduce((sum, s) => sum + (s.count || 0), 0);
            const sharesEl = document.getElementById('founderSharesTotal');
            if (sharesEl) sharesEl.textContent = total;
        }
    } catch (err) {
        console.warn('فشل تحديث قاعدة بيانات المشاركات، استخدام localStorage', err);
        let localCount = parseInt(localStorage.getItem(`share_${shareType}`) || '0');
        localCount++;
        localStorage.setItem(`share_${shareType}`, localCount);
        const span = document.getElementById(`shareCount_${shareType}`);
        if (span) span.textContent = localCount;
        let total = 0;
        ['whatsapp','facebook','twitter','copy'].forEach(t => {
            total += parseInt(localStorage.getItem(`share_${t}`) || '0');
        });
        const sharesEl = document.getElementById('founderSharesTotal');
        if (sharesEl) sharesEl.textContent = total;
    }
}
async function loadShareCounts() {
    try {
        const { data, error } = await supabaseClient.from('founder_shares').select('share_type, count');
        if (error) throw error;
        if (data && data.length) {
            data.forEach(item => {
                const span = document.getElementById(`shareCount_${item.share_type}`);
                if (span) span.textContent = item.count;
            });
            const total = data.reduce((sum, s) => sum + (s.count || 0), 0);
            const sharesEl = document.getElementById('founderSharesTotal');
            if (sharesEl) sharesEl.textContent = total;
        } else {
            ['whatsapp', 'facebook', 'twitter', 'copy'].forEach(type => {
                const count = localStorage.getItem(`share_${type}`) || 0;
                const span = document.getElementById(`shareCount_${type}`);
                if (span) span.textContent = count;
            });
            let total = 0;
            ['whatsapp','facebook','twitter','copy'].forEach(t => {
                total += parseInt(localStorage.getItem(`share_${t}`) || '0');
            });
            const sharesEl = document.getElementById('founderSharesTotal');
            if (sharesEl) sharesEl.textContent = total;
        }
    } catch (err) { console.warn(err); }
}
function getFounderShareLink() {
    const founderUsername = 'mohamed_saad';
    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}?founder=${founderUsername}`;
}
async function shareFounderPage(method) {
    await loadGlobalFounderVisibility();
    if (!appState.founderPageVisible) {
        showToast('صفحة المؤسس مخفية حالياً من قبل الإدارة، لا يمكن مشاركتها', 'warning');
        return;
    }
    const link = getFounderShareLink();
    const text = `تعرف على مؤسس شركة Misar Systems المهندس محمد سعد وقصة نجاحه من خلال هذا الرابط:`;
    let shareUrl = '';
    switch(method) {
        case 'whatsapp': shareUrl = `https://wa.me/?text=${encodeURIComponent(text + ' ' + link)}`; window.open(shareUrl, '_blank'); break;
        case 'facebook': shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}&quote=${encodeURIComponent(text)}`; window.open(shareUrl, '_blank'); break;
        case 'twitter': shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}`; window.open(shareUrl, '_blank'); break;
        case 'copy': navigator.clipboard.writeText(link).then(() => showToast('تم نسخ رابط صفحة المؤسس بنجاح!', 'success')).catch(() => showToast('فشل نسخ الرابط، حاول يدوياً', 'error')); break;
    }
    trackShare(method);
}

function openImageModal() {
    const img = document.querySelector('.founder-avatar img');
    if (!img) return;
    const modalImage = document.getElementById('modalImage');
    const imageModal = document.getElementById('imageModal');
    if (modalImage) modalImage.src = img.src;
    if (imageModal) imageModal.classList.add('active');
}
function closeImageModal(event) {
    if (event.target === document.getElementById('imageModal') || event.target.classList.contains('close-modal')) {
        document.getElementById('imageModal').classList.remove('active');
    }
}
function closeFounderProfile() {
    const founderScreen = document.getElementById('founderProfileScreen');
    if (founderScreen) founderScreen.classList.remove('active');
    openChatbot();
}
function contactDeveloper() {
    window.open('https://app.fastbots.ai/embed/cmillclid07mep81pmwkjqyq6', '_blank');
}

// ========== طلبات انضمام المناديب ==========
async function loadPendingDeliveries() {
    if (!appState.user || appState.userData.account_type !== 'founder') return;
    try {
        const { data, error } = await supabaseClient.from('user_data').select('id, name, email, phone, center, created_at').eq('account_type', 'delivery').eq('status', 'pending');
        if (error) throw error;
        const container = document.getElementById('pendingDeliveriesList');
        if (!container) return;
        if (!data || data.length === 0) { container.innerHTML = '<p>لا توجد طلبات انضمام حالياً</p>'; return; }
        container.innerHTML = '';
        data.forEach(del => {
            const div = document.createElement('div');
            div.className = 'pending-delivery-item';
            div.innerHTML = `<div class="pending-info"><div class="pending-name">${escapeHTML(del.name || del.email)}</div><div class="pending-email">${del.email} | ${del.phone || 'لا يوجد هاتف'} | المركز: ${del.center || 'غير محدد'}</div></div><div class="pending-actions"><button class="approve-btn" onclick="approveDeliveryPerson('${del.id}')">قبول</button><button class="reject-btn" onclick="rejectDeliveryPerson('${del.id}')">رفض</button></div>`;
            container.appendChild(div);
        });
    } catch(err) {
        console.error(err);
        const container = document.getElementById('pendingDeliveriesList');
        if (container) container.innerHTML = '<p>حدث خطأ في تحميل الطلبات</p>';
    }
}

// ========== قبول المندوب (محسّن مع إشعار وتحديث الحقول) ==========
async function approveDeliveryPerson(userId) {
    if (!userId) {
        showToast('معرف المندوب غير صحيح', 'error');
        return;
    }
    showLoading(true);
    try {
        // جلب بيانات المندوب قبل التحديث للحصول على البريد والاسم للإشعار
        const { data: deliveryData, error: fetchError } = await supabaseClient
            .from('user_data')
            .select('id, name, email, center')
            .eq('id', userId)
            .maybeSingle();
        if (fetchError) throw fetchError;
        if (!deliveryData) {
            showToast('المندوب غير موجود', 'error');
            return;
        }

        // تحديث الحالة إلى approved وتحديث updated_at
        const updates = {
            status: 'approved',
            updated_at: new Date().toISOString()
        };
        const { data, error: updateError } = await supabaseClient
            .from('user_data')
            .update(updates)
            .eq('id', userId)
            .select()
            .maybeSingle();

        if (updateError) throw updateError;
        if (!data) {
            showToast('فشل تحديث بيانات المندوب', 'error');
            return;
        }

        // إرسال إشعار للمندوب بقبوله
        await sendNotification(
            userId,
            '🎉 تم قبول طلب الانضمام كمندوب',
            `مبروك! تم قبول طلبك للعمل كمندوب في مركز ${deliveryData.center || 'غير محدد'}. يمكنك الآن استلام الطلبات المتاحة.`
        );

        showToast(`تم قبول المندوب ${deliveryData.name || ''} بنجاح`, 'success');
        
        // تحديث قوائم المناديب في لوحة المؤسس
        await loadPendingDeliveries();
        if (typeof displayAllDeliveryPersons === 'function') {
            await displayAllDeliveryPersons();
        }
        
        // إذا كان المندوب مسجل الدخول حاليًا، يمكننا تحديث حالة المستخدم في appState
        if (appState.user && appState.user.id === userId) {
            // تحديث userData للمندوب الحالي
            appState.userData.status = 'approved';
            // تحديث واجهة المندوب إذا كان مفتوحًا
            if (appState.currentScreen === 'deliveryDashboardScreen') {
                if (typeof refreshDeliveryDashboard === 'function') {
                    await refreshDeliveryDashboard();
                }
            }
        }

    } catch(err) {
        console.error('❌ خطأ في قبول المندوب:', err);
        showToast(err.message || 'حدث خطأ أثناء قبول المندوب', 'error');
    } finally {
        showLoading(false);
    }
}

async function rejectDeliveryPerson(userId) {
    if (!confirm('هل أنت متأكد من رفض هذا المندوب؟ سيتم حذف حسابه.')) return;
    showLoading(true);
    try {
        await supabaseClient.from('user_data').delete().eq('id', userId);
        showToast('تم رفض المندوب وحذف الحساب', 'success');
        await loadPendingDeliveries();
        if (typeof displayAllDeliveryPersons === 'function') await displayAllDeliveryPersons();
    } catch(err) {
        showToast(err.message, 'error');
    } finally {
        showLoading(false);
    }
}

// ========== إشعارات واشتراكات ==========
async function sendNotification(userId, title, message, data = {}) {
    try {
        await supabaseClient.from('notifications').insert({
            user_id: userId, title, message, data, created_at: new Date(), is_read: false
        });
    } catch (error) {
        console.warn('فشل إرسال الإشعار', error);
    }
}
async function loadUnreadNotificationsCount() {
    if (!appState.user) return;
    try {
        const { count, error } = await supabaseClient.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', appState.user.id).eq('is_read', false);
        if (!error) {
            const badge = document.getElementById('notificationBadge');
            if (badge) {
                badge.textContent = count || 0;
                badge.style.display = count > 0 ? 'flex' : 'none';
            }
        }
    } catch(e) {
        console.warn('فشل تحميل عدد الإشعارات', e);
    }
}
function setupRealtimeSubscriptions() {
    if (!appState.user) return;
    if (appState.ordersSubscription) appState.ordersSubscription.unsubscribe();
    appState.ordersSubscription = supabaseClient.channel('orders-channel')
        .on('postgres_changes', {
            event: '*', schema: 'public', table: 'orders'
        }, (payload) => {
            console.log('Order change:', payload);
            if (appState.currentScreen === 'sellerDashboardScreen' && appState.userData.account_type === 'seller') {
                if (typeof refreshSellerDashboard === 'function') refreshSellerDashboard();
            } else if (appState.currentScreen === 'deliveryDashboardScreen') {
                if (typeof refreshDeliveryDashboard === 'function') refreshDeliveryDashboard();
            } else if (appState.currentScreen === 'ordersScreen') {
                if (typeof loadBuyerOrdersWithTimeline === 'function') loadBuyerOrdersWithTimeline();
            }
            loadUnreadNotificationsCount();
        }).subscribe();
    if (appState.notificationsSubscription) appState.notificationsSubscription.unsubscribe();
    appState.notificationsSubscription = supabaseClient.channel('notifications-channel')
        .on('postgres_changes', {
            event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${appState.user.id}`
        }, (payload) => {
            showToast(payload.new.title, 'info');
            loadUnreadNotificationsCount();
        }).subscribe();
}

// ========== التنقل بين الشاشات ==========
function showScreen(screenId) {
    if (screenId === 'sellerDashboardScreen') {
        if (!appState.user || appState.userData.account_type !== 'seller') {
            showToast('هذه الصفحة مخصصة للبائعين فقط', 'error');
            showScreen('homeScreen');
            return;
        }
        if (typeof refreshSellerDashboard === 'function') refreshSellerDashboard();
    }
    if (screenId === 'deliveryDashboardScreen') {
        if (!appState.user || appState.userData.account_type !== 'delivery') {
            showToast('هذه الصفحة مخصصة للمندوبين فقط', 'error');
            showScreen('homeScreen');
            return;
        }
        if (typeof refreshDeliveryDashboard === 'function') refreshDeliveryDashboard();
    }
    if (screenId === 'founderDashboardScreen') {
        if (!appState.user || appState.userData.account_type !== 'founder') {
            showToast('هذه الصفحة مخصصة للمؤسس فقط', 'error');
            showScreen('homeScreen');
            return;
        }
        loadGlobalFounderVisibility();
        loadFounderStats();
        loadPendingDeliveries();
        if (typeof displayAllDeliveryPersons === 'function') displayAllDeliveryPersons();
    }
    if (screenId === 'ordersScreen') {
        if (typeof loadBuyerOrdersWithTimeline === 'function') loadBuyerOrdersWithTimeline();
    }
    if (screenId === 'editProfileScreen') {
        updateUserInfo();
    }

    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
        screen.classList.add('hidden');
    });
    updateNavigation(screenId);
    const screen = document.getElementById(screenId);
    if (screen) {
        screen.classList.remove('hidden');
        screen.classList.add('active');
        appState.previousScreen = appState.currentScreen;
        appState.currentScreen = screenId;
        const backBtn = document.querySelector('.back-btn');
        if (backBtn) backBtn.classList.toggle('active', screenId !== 'homeScreen' && screenId !== 'locationScreen');
    }
    if (screenId === 'marketScreen') {
        const searchInput = document.getElementById('marketSearchInput');
        if (searchInput) { searchInput.value = ''; }
        const clearSearch = document.getElementById('clearSearch');
        if (clearSearch) clearSearch.style.display = 'none';
        if (typeof loadMarketProducts === 'function') loadMarketProducts();
    }
    if (screenId === 'profileScreen') updateProfileLocation();
    if (screenId === 'editProfileScreen' && appState.user) updateProfileLocation();
    if (screenId === 'servicesScreen') {
        if (typeof loadServices === 'function') loadServices();
    }
    if (screenId === 'cartScreen') {
        if (typeof loadCart === 'function') loadCart();
    }
    if (screenId === 'loginScreen' || screenId === 'registerScreen') setTimeout(addInputInteractions, 50);
}
function goBack() { showScreen(appState.previousScreen || 'homeScreen'); }
function updateNavigation(screenId) {
    document.querySelectorAll('.nav-item').forEach((item, index) => {
        item.classList.remove('active');
        if (screenId === 'homeScreen' && index === 0) item.classList.add('active');
        else if (screenId === 'marketScreen' && index === 1) item.classList.add('active');
        else if (screenId === 'servicesScreen' && index === 2) item.classList.add('active');
        else if (screenId === 'cartScreen' && index === 3) item.classList.add('active');
        else if (screenId === 'profileScreen' && index === 4) item.classList.add('active');
    });
}
function skipLogin() { showScreen('homeScreen'); }
function addInputInteractions() {
    const inputs = document.querySelectorAll('#loginScreen input, #registerScreen input');
    const passwordInputs = document.querySelectorAll('#loginPassword, #registerPassword');
    inputs.forEach(inp => {
        inp.addEventListener('focus', () => setBearExpression('blink'));
        inp.addEventListener('blur', () => setBearExpression(''));
    });
    passwordInputs.forEach(pw => {
        pw.addEventListener('focus', () => setBearExpression('covering'));
        pw.addEventListener('blur', () => setBearExpression(''));
    });
}
function togglePasswordVisibility(inputId, toggleEl) {
    const input = document.getElementById(inputId);
    if (!input || !toggleEl) return;
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    const icon = toggleEl.querySelector('i');
    if (icon) {
        icon.className = isPassword ? 'fas fa-eye-slash' : 'fas fa-eye';
    }
}
window.togglePasswordVisibility = togglePasswordVisibility;

// ========== الدردشة ==========
function openChatbot() {
    const chatbotScreen = document.getElementById('chatbotScreen');
    if (chatbotScreen) chatbotScreen.classList.add('active');
    const badge = document.getElementById('chatbotBadge');
    if (badge) badge.style.display = 'none';
    const messages = document.getElementById('chatMessages');
    if (messages) messages.scrollTop = messages.scrollHeight;
}
function closeChatbot() {
    const chatbotScreen = document.getElementById('chatbotScreen');
    if (chatbotScreen) chatbotScreen.classList.remove('active');
}
function sendMessage() {
    const input = document.getElementById('chatInput');
    if (!input) return;
    const msg = input.value.trim();
    if (!msg) return;
    addMessage(msg, 'user');
    input.value = '';
    setTimeout(() => {
        addMessage(getBotResponse(msg), 'bot');
        const messages = document.getElementById('chatMessages');
        if (messages) messages.scrollTop = messages.scrollHeight;
    }, 400);
}
function sendSuggestion(text) {
    addMessage(text, 'user');
    setTimeout(() => {
        addMessage(getBotResponse(text), 'bot');
        const messages = document.getElementById('chatMessages');
        if (messages) messages.scrollTop = messages.scrollHeight;
    }, 400);
}
function addMessage(text, sender) {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    const div = document.createElement('div');
    div.className = `message ${sender}`;
    div.textContent = text;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}
function getBotResponse(msg) {
    const m = msg.toLowerCase();
    if (m.includes('السلام') || m.includes('اهلا')) return 'وعليكم السلام! كيف يمكنني مساعدتك؟ 😊';
    if (m.includes('منتجات')) return 'لدينا إلكترونيات، أزياء، أثاث، أطعمة. تصفح المتجر!';
    if (m.includes('اشتري') || m.includes('شراء')) return 'اذهب للمتجر، أضف المنتج للسلة ثم أكمل الطلب من صفحة السلة.';
    if (m.includes('عروض')) return 'خصم 20% على الأثاث، وساعة هواوي بسعر مميز.';
    if (m.includes('صيانة')) return 'خدمات الصيانة متوفرة: أجهزة، سباكة، كهرباء. احجز من قسم الخدمات.';
    if (m.includes('طلب')) return 'تابع طلباتك من صفحة "طلباتي" في الملف الشخصي.';
    if (m.includes('خدمة العملاء') || m.includes('الدعم')) return 'تواصل معنا: support@misar.com أو 19000.';
    if (m.includes('شكرا')) return 'الشكر لله، دائمًا في خدمتك!';
    return 'عذرًا، لم أفهم. جرب الاقتراحات أعلاه.';
}

// ========== دوال الأمان ==========
function showChangePasswordModal() {
    if (!appState.user) { showToast('يجب تسجيل الدخول أولاً', 'warning'); return; }
    const modal = document.getElementById('changePasswordModal');
    if (modal) modal.classList.add('active');
}
function showSecurityModal() {
    if (!appState.user) { showToast('يجب تسجيل الدخول أولاً', 'warning'); return; }
    const modal = document.getElementById('securityModal');
    if (modal) modal.classList.add('active');
}
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
}
function changePassword() {
    const oldPass = document.getElementById('oldPassword');
    const newPass = document.getElementById('newPassword');
    const confirmPass = document.getElementById('confirmNewPassword');
    if (!oldPass || !newPass || !confirmPass) { showToast('يرجى ملء جميع الحقول', 'warning'); return; }
    if (newPass.value !== confirmPass.value) { showToast('كلمة المرور الجديدة غير متطابقة', 'error'); return; }
    showToast('تم تغيير كلمة المرور (وهمي)', 'success');
    closeModal('changePasswordModal');
    oldPass.value = '';
    newPass.value = '';
    confirmPass.value = '';
}
function saveSecuritySettings() {
    const twoFactor = document.getElementById('twoFactorCheck');
    const enabled = twoFactor ? twoFactor.checked : false;
    showToast(`تم حفظ إعدادات الأمان (المصادقة الثنائية: ${enabled ? 'مفعلة' : 'غير مفعلة'})`, 'success');
    closeModal('securityModal');
}

// ========== تصدير الدوال العامة ==========
window.supabaseClient = supabaseClient;
window.appState = appState;
window.compressImage = compressImage;
window.uploadProductImages = uploadProductImages;
window.showScreen = showScreen;
window.goBack = goBack;
window.skipLogin = skipLogin;
window.openLocationSettings = openLocationSettings;
window.setBearExpression = setBearExpression;
window.showBearReaction = showBearReaction;
window.showLoading = showLoading;
window.showToast = showToast;
window.escapeHTML = escapeHTML;
window.signInWithGoogle = signInWithGoogle;
window.signInWithEmail = signInWithEmail;
window.signUpWithEmail = signUpWithEmail;
window.logout = logout;
window.switchAccount = switchAccount;
window.confirmLogout = confirmLogout;
window.saveProfile = saveProfile;
window.showChangePasswordModal = showChangePasswordModal;
window.showSecurityModal = showSecurityModal;
window.closeModal = closeModal;
window.changePassword = changePassword;
window.saveSecuritySettings = saveSecuritySettings;
window.openChatbot = openChatbot;
window.closeChatbot = closeChatbot;
window.sendMessage = sendMessage;
window.sendSuggestion = sendSuggestion;
window.openFounderProfile = openFounderProfile;
window.closeFounderProfile = closeFounderProfile;
window.contactDeveloper = contactDeveloper;
window.openImageModal = openImageModal;
window.closeImageModal = closeImageModal;
window.shareFounderPage = shareFounderPage;
window.trackShare = trackShare;
window.loadShareCounts = loadShareCounts;
window.getFounderShareLink = getFounderShareLink;
window.refreshFounderStats = refreshFounderStats;
window.approveDeliveryPerson = approveDeliveryPerson;
window.rejectDeliveryPerson = rejectDeliveryPerson;
window.loadPendingDeliveries = loadPendingDeliveries;
window.loadUserData = loadUserData;
window.updateUserInfo = updateUserInfo;
window.updateWelcomeLocation = updateWelcomeLocation;
window.updateProfileLocation = updateProfileLocation;
window.saveLocation = saveLocation;
window.loadUnreadNotificationsCount = loadUnreadNotificationsCount;
window.setupRealtimeSubscriptions = setupRealtimeSubscriptions;
window.sendNotification = sendNotification;
window.loadGlobalFounderVisibility = loadGlobalFounderVisibility;
window.initFounderSettings = initFounderSettings;
window.handleToggleChange = handleToggleChange;
window.generateOTP = generateOTP;
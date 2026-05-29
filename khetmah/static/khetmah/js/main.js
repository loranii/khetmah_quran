// main.js

//سوكيت
/******************************
 * WEBSOCKET
 ******************************/

let socket = null;

function initWebSocket() {

    if (!AppState.currentKhetmahId) return;

    const protocol =
        window.location.protocol === "https:"
            ? "wss"
            : "ws";

    socket = new WebSocket(
        `${protocol}://${window.location.host}/ws/khetmah/${AppState.currentKhetmahId}/`
    );

    socket.onopen = () => {

        console.log("WebSocket Connected");
    };

    socket.onclose = () => {

        console.log("WebSocket Closed");

        // reconnect
        setTimeout(() => {
            initWebSocket();
        }, 3000);
    };

    socket.onerror = (e) => {

        console.error("WebSocket Error", e);
    };

    socket.onmessage = (e) => {

        const data = JSON.parse(e.data);

        handleRealtimeUpdate(data);
    // =========================
    // اكتمال الختمة
    // =========================
    if (
        data.type === "khetmah_status" &&
        data.status === "completed"
    ) {

        AppState.khetmahStatus = "completed";

        updateKhetmahStatusUI("completed");

        disableGrid();

        return;
    }

    };
}


/******************************
 * GLOBAL STATE (ONE SOURCE ONLY)
 ******************************/
const AppState = {

    initialized: false,

    isAuthenticated: false,

    currentKhetmahId: null,

    user: {
        id: null,
        username: null,
        hasActiveKhetmah: false,
        activeKhetmahId: null,
        hasUnfinishedJuz: false,
        activeParts: [],
        

    },

    ui: {
        takenCount: 0,
        readCount: 0,
        totalCount: 0
    },

    parts: [],
    khetmahs: [],
    khetmahStatus: null,
    isCreator: false
};

    function attachSearchFilter() {

        const searchInput = document.getElementById("search-khetmah");

        if (!searchInput) return;

        searchInput.addEventListener("input", () => {
            renderKhetmahList();
        });
    }    


/******************************
 * INIT
 ******************************/
document.addEventListener("DOMContentLoaded", async () => {


    initGlobals();
    parseData();
    //سوكيت
    initWebSocket();

    await loadUserState();

    const statusSelect =
    document.getElementById("status");

    if (statusSelect) {

        // استرجاع آخر فلتر محفوظ
        const savedFilter =
            localStorage.getItem("khetmahFilter");

        if (savedFilter) {
            statusSelect.value = savedFilter;
        }

        // حفظ الفلتر عند تغييره
        statusSelect.addEventListener(
            "change",
            () => {

                localStorage.setItem(
                    "khetmahFilter",
                    statusSelect.value
                );

                renderKhetmahList();
            }
        );
    }
    renderCounters();
    renderParts();
    
    renderKhetmahMessage();

    updateButtonsUI();

    if (
        AppState.khetmahStatus === "completed"||
        AppState.isAuthenticated === false) {
        disableGrid();
    }


    AppState.initialized = true;

    console.log("BOOT DONE", AppState);

    initKhetmahSidebar();
    attachSidebarFilter();
    attachSearchFilter();
    initUserReadModal();
    initUserDropdown();
    initProfileModal();
});


/******************************
 * USER DROPDOWN
 ******************************/

function initUserDropdown() {

    const toggle =
        document.getElementById(
            "user-menu-toggle"
        );

    const dropdown =
        document.getElementById(
            "user-dropdown"
        );

    if (!toggle || !dropdown) return;

    // فتح وإغلاق
    toggle.addEventListener(
        "click",
        (e) => {

            e.stopPropagation();

            dropdown.classList.toggle(
                "hidden"
            );
        }
    );

    // إغلاق عند الضغط خارج القائمة
    document.addEventListener(
        "click",
        (e) => {

            if (
                !dropdown.contains(e.target) &&
                !toggle.contains(e.target)
            ) {

                dropdown.classList.add(
                    "hidden"
                );
            }
        }
    );
}


/******************************
 * PROFILE MODAL
 ******************************/

function initProfileModal() {

    const openBtn =
        document.getElementById(
            "open-profile-modal"
        );

    const modal =
        document.getElementById(
            "profile-modal"
        );

    const closeBtn =
        document.getElementById(
            "close-profile-modal"
        );

    const content =
        document.getElementById(
            "profile-modal-content"
        );

    if (!openBtn || !modal) return;

    // OPEN

    openBtn.addEventListener(
        "click",
        async (e) => {

            e.preventDefault();

            try {

                const response =
                    await fetch("/profile", {

                        headers: {
                            "X-Requested-With":
                                "XMLHttpRequest"
                        }
                    });

                const html =
                    await response.text();

                content.innerHTML = html;

                modal.classList.remove(
                    "hidden"
                );

                initProfileForm();

            }

            catch (e) {

                console.error(e);
            }
        }
    );

    // CLOSE

    closeBtn.addEventListener(
        "click",
        () => {

            modal.classList.add(
                "hidden"
            );
        }
    );

    modal.addEventListener(
        "click",
        (e) => {

            if (e.target === modal) {

                modal.classList.add(
                    "hidden"
                );
            }
        }
    );
}



document.addEventListener("submit", async function (e) {

    if (!e.target.matches("#profile-form")) return;

    e.preventDefault();

    const form = e.target;
    const formData = new FormData(form);

    try {

        const response = await fetch(form.action, {
            method: "POST",
            body: formData,
            headers: {
                "X-Requested-With": "XMLHttpRequest"
            }
        });

        const data = await response.json();

        if (data.success) {

            // اغلاق المودال
            document.getElementById("profile-modal")
                .classList.add("hidden");

            // تحديث الاسم
            const currentUser =
                document.getElementById("currentUser");

            if (currentUser) {

                currentUser.textContent =
                    data.full_name;
            }

            // تحديث الصورة
            const navProfileImage =
                document.querySelector(
                    ".nav-profile-image"
                );

            if (navProfileImage) {

                navProfileImage.src =
                    data.profile_picture;
            }

            // رسالة النجاح

            Swal.fire({
                icon: "success",
                title: "تم بنجاح",
                text: "تم تحديث الملف الشخصي",
                timer: 2000,
                showConfirmButton: false
            });

            } else {

            Swal.fire({
                icon: "error",
                title: "خطأ",
                text: data.error || "حدث خطأ"
            });
        }

    } catch (error) {

        console.error(error);

        Swal.fire({
            icon: "error",
            title: "Server Error",
            text: "حدث خطأ أثناء حفظ البيانات"
        });
    }
});



/******************************
 * PROFILE FORM AJAX
 ******************************/

function initProfileForm() {

    const form =
        document.getElementById(
            "profile-form"
        );

    const imageInput =
        document.getElementById(
            "profile_picture"
        );

    const preview =
        document.getElementById(
            "profile-preview"
        );

    if (!form) return;

    // IMAGE PREVIEW

    imageInput?.addEventListener(
        "change",
        function () {

            const file =
                this.files[0];

            if (file) {

                preview.src =
                    URL.createObjectURL(file);
            }
        }
    );

    // SUBMIT AJAX

    form.addEventListener(
        "submit",
        async (e) => {

            e.preventDefault();

            const formData =
                new FormData(form);

            try {

                const response =
                    await fetch("/profile", {

                        method: "POST",

                        headers: {
                            "X-Requested-With":
                                "XMLHttpRequest"
                        },

                        body: formData
                    });

                const data =
                    await response.json();

                if (!data.success) return;

                // تحديث الصورة في navbar

                document
                    .querySelector(".user-avatar")
                    .src =
                    data.profile_picture;

                Swal.fire({

                    icon: "success",

                    text: "تم تحديث الملف الشخصي",

                    confirmButtonText: "OK"
                });

            }

            catch (e) {

                console.error(e);
            }
        }
    );
}


/******************************
 * USER READ MODAL
 ******************************/

function initUserReadModal() {

    const modal =
        document.getElementById(
            "user-read-modal"
        );

    const closeBtn =
        document.getElementById(
            "close-user-read-modal"
        );

    if (!modal || !closeBtn) return;

    closeBtn.addEventListener(
        "click",
        () => {
            modal.classList.add("hidden");
        }
    );

    modal.addEventListener(
        "click",
        (e) => {

            if (e.target === modal) {

                modal.classList.add("hidden");
            }
        }
    );
}


function openUserReadModal() {

    renderUserReadKhetmahList();

    document
        .getElementById("user-read-modal")
        ?.classList.remove("hidden");
}




function initGlobals() {

    AppState.isAuthenticated =
        document.getElementById("Authenticated")
            ?.dataset.isAuthenticated === "true";

    AppState.currentKhetmahId =
        document.getElementById("currentkhetmahId")
            ? parseInt(document.getElementById("currentkhetmahId").dataset.khetmahId)
            : null;

    // حالة الختمة
    const khStatus =
        document.getElementById("khetmah_status");

    AppState.khetmahStatus =
        khStatus
            ? khStatus.dataset.khetmahstatus
            : null;

    // هل أنا منشئ الختمة
    const creator =
        document.getElementById("is_I_creator");

    AppState.isCreator =
        creator?.dataset?.username === "True";
}


function parseData() {

    const parts = document.getElementById("allPartsData");
    const khetmahs = document.getElementById("allKhetmahsData");

    AppState.parts = parts ? JSON.parse(parts.textContent) : [];
    AppState.khetmahs = khetmahs ? JSON.parse(khetmahs.textContent) : [];
}


/******************************
 * USER STATE info
 ******************************/
async function loadUserState() {

    if (!AppState.isAuthenticated) return;

    const res = await fetch("/user_khetmah_parts_api/");
    const data = await res.json();

    AppState.user.id = data.userId;
    AppState.user.username = data.currentUsername;
    AppState.user.hasActiveKhetmah = data.user_has_active_khetmah;
    AppState.user.activeKhetmahId = data.userActiveKhetmahId;
    AppState.user.readKhetmahs =data.read_khetmahs || [];
    AppState.user.hasUnfinishedJuz = data.user_has_unfinished_juz;
    AppState.user.activeParts = data.parts || [];
    AppState.user.unactive_parts = data.unactive_parts || [];
    console.log("USER PARTS", AppState.user.activeParts);
``
    syncCountersFromState();

    console.log("UNACTIVE PARTS", AppState.user.unactive_parts);
}


/******************************
 * COUNTERS
 ******************************/
function syncCountersFromState() {

    const activeParts = AppState.user.activeParts || [];

    const unactiveParts = AppState.user.unactive_parts || [];

    // =========================
    // المحجوز فقط من النشطة
    // =========================

    AppState.ui.takenCount =
        activeParts.filter(
            p => p.status === "taken"
        ).length;

    // =========================
    // المقروء من الجميع
    // active + completed
    // =========================

    const activeRead = activeParts.filter(p => p.status === "read").length;

    const unactiveRead = unactiveParts.length;
    console.log("unactiveRead",unactiveRead);

    AppState.ui.readCount = activeRead + unactiveRead;

    // =========================
    // المجموع
    // =========================

    AppState.ui.totalCount = AppState.ui.takenCount + AppState.ui.readCount;
}

function renderCounters() {

    if (!AppState.isAuthenticated) return;

    const takenLink = document.getElementById("taken-link");
    const takenCountEl = document.getElementById("taken-count");
    const readCountEl = document.getElementById("read-count");
    const totalCountEl = document.getElementById("total-count");

    
    const readLink = document.getElementById("read-link");

    if (!takenCountEl || !readCountEl || !totalCountEl) return;

    // =========================
    // تحديث الأرقام
    // =========================

    takenCountEl.textContent = AppState.ui.takenCount;
    readCountEl.textContent = AppState.ui.readCount;
    totalCountEl.textContent = AppState.ui.totalCount;

    // =========================
    // ألوان
    // =========================

    takenCountEl.style.color = "#d4a000";
    readCountEl.style.color = "red";
    totalCountEl.style.color = "#0b5ed7";


// =========================
//  تحديث رابط المحجوز
// =========================
   const takenPart = AppState.user.activeParts.find(
        p => p.status === "taken"
    );

    if (takenPart && AppState.ui.takenCount > 0) {

        takenLink.href =`/khetmah_detail/${takenPart.khetmah_id}`;

        takenLink.style.pointerEvents = "auto";
        takenLink.style.textDecoration = "none";
        takenLink.style.cursor = "pointer";

    } else {

        // تعطيل الرابط فقط
        takenLink.removeAttribute("href");

        takenLink.style.pointerEvents = "none";
        takenLink.style.textDecoration = "none";
        takenLink.style.cursor = "default";
    }







// =========================
// رابط المقروء
// =========================

const readKhetmahs = AppState.user.readKhetmahs || [];


// لا يوجد ختمات
if (
    readKhetmahs.length === 0 ||
    AppState.ui.readCount === 0
) {

    readLink.removeAttribute("href");

    readLink.style.pointerEvents = "none";

    readLink.style.cursor = "default";
}


// ختمة واحدة
else if (readKhetmahs.length === 1) {

    readLink.href = `/khetmah_detail/${readKhetmahs[0].id}`;

    readLink.onclick = null;

    readLink.style.pointerEvents = "auto";
}


// أكثر من ختمة
else {

    readLink.removeAttribute("href");

    readLink.style.pointerEvents = "auto";

    readLink.onclick = (e) => {

        e.preventDefault();

        openUserReadModal();
    };
}
}




/******************************
 * KHETMAH CARD
 ******************************/

function renderKhetmahCard(kh) {

    return `
    <div class="khetmah-item-wrapper">

        <div class="card mb-2 shadow-sm fixed-card">

            ${kh.id == AppState.currentKhetmahId
                ? `<a href="/khetmah_detail/${kh.id}" class="text-decoration-none bg-card">`
                : `<a href="/khetmah_detail/${kh.id}" class="text-decoration-none">`
            }

                <div class="card-body">

                    <div class="d-flex align-items-center mb-2 user-row">
                        <img src="${kh.creator__profile_picture}" class="img_a">
                        <strong>${kh.creator__username}</strong>
                    </div>

                    <div class="info-row">

                        ${
                            kh.status === "active"
                            ? `<span class="badge bg-warning text-dark">${kh.status}</span>`
                            : `<span class="badge bg-success text-dark">${kh.status}</span>`
                        }

                        ${
                            kh.reason === "هبة لمتوفي"
                            ? `<span class="badge bg-danger text-light">${kh.reason}</span>`
                            : `<span class="badge bg-primary text-light">${kh.reason}</span>`
                        }

                        <div class="d-flex align-items-center gap-2">

                            ${
                                kh.read_parts_count
                                ? `
                                <span
                                    style="
                                        color:red;
                                        font-weight:bold;
                                        font-size:13px;
                                    ">
                                    هنا قرأت أنت
                             (${kh.read_parts_count}) 
                                   جزء
                                </span>
                                `
                                : ""
                            }

                            <span class="date">
                                ${kh.created_at?.split(' ')[0] || ""}
                            </span>

                        </div>

                    </div>

                </div>

            </a>

        </div>

    </div>
    `;
}




/******************************
 * LEFT LIST (FIXED VERSION)
 ******************************/

function renderKhetmahList() {
    
    const list = document.getElementById("khetmah-list");
    const statusSelect = document.getElementById("status");
    const searchInput = document.getElementById("search-khetmah");
    const emptyMessage = document.getElementById("empty-message");

    if (!list || !statusSelect) return;
    if (emptyMessage) {
    emptyMessage.style.display = "none";
}

    const allKhetmahs = AppState.khetmahs || [];

    const filter = statusSelect.value;
    const searchText = searchInput.value.toLowerCase().trim();
    // عدادات الحالة (لإظهارها في العنوان)
    const activeCount = allKhetmahs.filter(k => k.status === "active").length;

    const completedCount = allKhetmahs.filter(k => k.status === "completed").length;

    const allCount = allKhetmahs.length;

    list.innerHTML = "";
    emptyMessage.style.display = "none";

    let filtered = [];

    // ==============================
    // FILTER LOGIC (same as old)
    // ==============================

        filtered = allKhetmahs.filter(kh => {

            // فلترة الحالة
            const statusMatch =
                filter === "All" || kh.status === filter;

            // فلترة اسم المنشئ
            const creatorMatch =
                kh.creator__username
                    .toLowerCase()
                    .includes(searchText);

            return statusMatch && creatorMatch;
        });

        const activeOption =
    statusSelect.querySelector(
        'option[value="active"]'
    );

const allOption =
    statusSelect.querySelector(
        'option[value="All"]'
    );

const completedOption =
    statusSelect.querySelector(
        'option[value="completed"]'
    );

console.log(statusSelect.innerHTML);

if (allOption) {

    allOption.textContent =
        `كل الختمات (${allCount})`;
}

if (activeOption) {

    activeOption.textContent =
        `الختمات النشطة (${activeCount})`;
}

if (completedOption) {

    completedOption.textContent =
        `الختمات المنتهية (${completedCount})`;
}


    // ==============================
    // EMPTY STATE (same logic)
    // ==============================

    if (filtered.length === 0) {

        let message = "";
        if (filter === "All") {
            message = "📭 لم يتم العثور على اي ختمة";
        } 
        else if (filter === "active") {
            message = "🚫 لم يتم العثور على ختمة جارية";
        } 
        else if (filter === "completed") {
            message = "✅ لا توجد ختمات منتهية";
        } 

        if (emptyMessage) {
        emptyMessage.style.display = "block";
}
        emptyMessage.innerHTML = `
            <div class="alert alert-light text-center mt-3 shadow-sm"
     style="
        font-size:14px;
        border-radius:10px;
        direction:rtl;
        margin:5px auto;
        border:2px dashed #f95f5f;
        display:table;
        padding:10px 20px;
     ">
    ${message}
    </div>`;

        return;
    }

    // ==============================
    // RENDER LIST ITEMS
    // ==============================

filtered.forEach(kh => {

    const li = document.createElement("li");

    li.innerHTML = renderKhetmahCard(kh);

    list.appendChild(li);

});
}



/******************************
 * USER READ KHETMAH LIST
 ******************************/

function renderUserReadKhetmahList() {

    const list = document.getElementById("user-read-khetmah-list");

    if (!list) return;

    list.innerHTML = "";

    AppState.user.readKhetmahs.forEach(kh => {

        const li = document.createElement("li");

        li.innerHTML = renderKhetmahCard(kh);

        list.appendChild(li);
    });
}


/******************************
* khetmah list filter
******************************/

function initKhetmahSidebar() {

    const el = document.getElementById("allKhetmahsData");
    if (!el) return;

    try {
        AppState.khetmahs = JSON.parse(el.textContent);
    } catch (e) {
        console.error("Sidebar parse error", e);
        AppState.khetmahs = [];
    }

    renderKhetmahList();
}



/******************************
*ربط الفلتر
******************************/
function attachSidebarFilter() {

    const select = document.getElementById("status");
    if (!select) return;

    select.addEventListener("change", () => {
        renderKhetmahList();
    });
}


/******************************
 * PARTS INFO TABLE ROWS
 ******************************/
const partsRows = {};

/******************************
 * PARTS GRID
 ******************************/
function renderParts() {

    const container = document.getElementById("jezaa-card");

    if (!container) return;

    container.innerHTML = "";

    AppState.parts.forEach(part => {

        const box = document.createElement("div");

        box.className = `button ${part.status || "available"}`;

        box.dataset.jezaa = part.number;

        // =========================
        // اظهار اسم المستخدم الذي حجز الجزء
        // =========================

        if (part.selected_by) {

            box.innerHTML = `
                <div>${part.number}</div>
                <div style="font-size:10px;">
                    ${part.selected_by}
                </div>
            `;

        } else {

            box.innerHTML = `
                <div>${part.number}</div>
            `;
        }

        // =========================
        // حدود المستخدم الحالي
        // =========================

        if (part.selected_jezaa_by_I) {

            if (part.status === "taken") {
                box.style.border =
                    "3px dashed rgb(5, 98, 174)";
            }

            if (part.status === "read") {
                box.style.border =
                    "3px dashed rgb(1, 49, 88)";
            }
        }


        // =========================
        // اظهار معلومات الجدول
        // =========================

        // إظهار أجزاء المستخدم الحالي فقط
        if (part.selected_jezaa_by_I === true &&(part.status === "taken" || part.status === "read")){
            ajzaa_quran(part.number, part.status);
        }

        // ==================================
        // منع التعديل على أجزاء الآخرين
        // ==================================

        const isMine = part.selected_jezaa_by_I === true;

        const isAvailable = part.status === "available";

        const isCreator = part.is_I_creator === true;

        if (!isAvailable && !isMine && !isCreator) {

            box.style.pointerEvents = "none";
            box.style.cursor = "not-allowed";
            box.style.border ="2px dotted black";
            box.style.opacity = "0.6";
        }

        box.addEventListener("click",
            () => handleClick(box));

        container.appendChild(box);
    });
}








/******************************
 * CLICK HANDLER
 ******************************/
async function handleClick(box) {

    if (!AppState.isAuthenticated) {
        return;
    }

        // منع أي تعديل إذا الختمة مكتملة
    if (AppState.khetmahStatus === "completed") {

        disableGrid();

        return;
    }

    const num = parseInt(box.dataset.jezaa);

    const activePart =
        AppState.user.activeParts.find(
            p => p.status === "taken"
        );



    // ====================================
    // فحص الختمة النشطة
    // ====================================
    if (
        AppState.user.hasActiveKhetmah &&
        AppState.currentKhetmahId !==
        AppState.user.activeKhetmahId
    ) {
        alert(
            "لديك ختمة نشطة غير منتهية يجب إنهاؤها أولاً"
        );
        window.location.href =
            `/khetmah_detail/${AppState.user.activeKhetmahId}`;
        return;
    }

    // ====================================
    // فحص الأجزاء غير المنتهية
    // ====================================

    if (
        !AppState.user.hasActiveKhetmah &&
        AppState.user.hasUnfinishedJuz &&
        activePart &&
        activePart.khetmah_id !==
        AppState.currentKhetmahId
    ) {

        alert("يجب إنهاء الأجزاء التي قمت بحجزها أولاً");

        window.location.href = `/khetmah_detail/${activePart.khetmah_id}`;

        return;
    }

    // ====================================
    // الحالة الحالية
    // ====================================
    let current =
        box.classList.contains("taken")
        ? "taken"
        : box.classList.contains("read")
        ? "read"
        : "available";

    let next = "taken";

    if (current === "taken") {
        next = "read";
    }
    else if (current === "read") {
        next = "available";
    }



    // ====================================
    // تحديث السيرفر
    // ====================================
try {
    
    const response = await fetch("/update_part/", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": getCookie("csrftoken")
        },
        body: JSON.stringify({
            khetmah_id: AppState.currentKhetmahId,
            part_number: num,
            status: next
        })
    });

    const data = await response.json();

    console.log(data);

    if (!response.ok) {
        console.error(data);
        alert(data.error || "حدث خطأ");
    return;
    }

    if (data.success && data.action !== "forced_taken") {

    updateLocal(box, num, next);


    // سوكيت
    // realtime broadcast
    if (socket && socket.readyState === WebSocket.OPEN) {

        socket.send(JSON.stringify({

            part_number: num,

            status: next,

            username: AppState.user.username
        }));
    }

    // إعادة مزامنة الحالة من السيرفر
    await loadUserState();

    renderCounters();
    }
    else if (data.success && data.action === "forced_taken") {
    
    updateLocal(box, num, "taken");

    await loadUserState();

    alert(
        "يجب أن يبقى جزء واحد محجوز باسمك لأنك أنت منشأ الختمة"
    );
    }
} 
catch (e) {
    console.error(e);
}
}

//سوكيت
/******************************
 * REALTIME UPDATE
 ******************************/
function handleRealtimeUpdate(data) {

    // =========================
    // تحديث حالة الختمة
    // =========================
    if (data.type === "khetmah_status") {

        AppState.khetmahStatus = data.status;

        updateKhetmahStatusUI(data.status);

        if (
            data.status === "completed"
        ) {

            disableGrid();
        }
        else {

            enableGrid();
        }

        return;
    }

    // =========================
    // حذف الختمة realtime
    // =========================
    if (data.type === "khetmah_deleted") {

        AppState.khetmahs =
            AppState.khetmahs.filter(
                k => k.id !== data.khetmah_id
            );

        renderKhetmahList();

        window.location.href = "/";

        return;
    }

    // =========================
    // تحديث الأجزاء realtime
    // =========================

    console.log("Realtime", data);

    const num = parseInt(data.part_number);

    const status = data.status;

    const username = data.username;

    const part = AppState.parts.find(
        p => parseInt(p.number) === num
    );

    if (!part) return;

    const isMine =
        username === AppState.user.username;

    part.status = status;

    part.selected_by =
        status === "available"
            ? ""
            : username;

    part.selected_jezaa_by_I =
        isMine && status !== "available";

    const box = document.querySelector(
        `[data-jezaa="${num}"]`
    );

    if (!box) return;
// إذا الختمة مكتملة امنع أي تفاعل
if (AppState.khetmahStatus === "completed") {

    box.style.pointerEvents = "none";

    box.style.cursor = "not-allowed";

    box.style.opacity = "0.7";
    }
    
    box.classList.remove(
        "available",
        "taken",
        "read"
    );

    box.classList.add(status);

    box.style.pointerEvents = "auto";
    box.style.opacity = "1";
    box.style.cursor = "pointer";
    box.style.border = "none";

    if (status === "available") {

        box.innerHTML = `
            <div>${num}</div>
        `;
    }

    else {

        box.innerHTML = `
            <div>${num}</div>
            <div style="font-size:10px;">
                ${username}
            </div>
        `;

        const isCreator = AppState.isCreator === true;

        if (isMine) {

            if (status === "taken") {

                box.style.border =
                    "3px dashed rgb(5, 98, 174)";
            }

            if (status === "read") {

                box.style.border =
                    "3px dashed rgb(1, 49, 88)";
            }
        }

        // منشئ الختمة يستطيع التحكم بكل الأجزاء
        else if (isCreator) {

            box.style.pointerEvents = "auto";

            box.style.cursor = "pointer";

            box.style.opacity = "1";

            box.style.border =
                "2px dashed #444";
        }

        // المستخدم العادي يُمنع
        else {

            box.style.pointerEvents = "none";

            box.style.cursor = "not-allowed";

            box.style.opacity = "0.6";

            box.style.border =
                "2px dotted black";
        }
    }

    if (status === "available") {

        box.style.pointerEvents = "auto";

        box.style.opacity = "1";

        box.style.cursor = "pointer";
    }

    renderCounters();
}



/******************************
 * LOCAL UPDATE
 ******************************/
function updateLocal(box, num, status) {
    box.classList.remove(
        "taken",
        "read",
        "available"
    );
    box.classList.add(status);

    // ==================================
    // اسم المستخدم
    // ==================================
    // تحديث اسم المستخدم داخل الزر
    if (status === "available") {

        box.innerHTML = `
            <div>${num}</div>
        `;

        box.style.border = "none";

    } 
    else {
        box.innerHTML = `
            <div>${num}</div>
            <div style="font-size:10px;">
                ${AppState.user.username}
            </div>
        `;

        if (status === "taken") {
            box.style.border =
            "3px dashed rgb(5, 98, 174)";
        }

        if (status === "read") {

            box.style.border =
                "3px dashed rgb(1, 49, 88)";
        }
    }


   // ==================================
    // تحديث activeParts
    // ==================================

    const idx =
        AppState.user.activeParts.findIndex(
            p => parseInt(p.number) === parseInt(num)
        );

    if (status === "available") {

        if (idx !== -1) {

            AppState.user.activeParts.splice(
                idx,
                1
            );
        }

    } 
    else {
        const obj = {
            number: parseInt(num),
            status: status,
            khetmah_id: AppState.currentKhetmahId
        };

        if (idx !== -1) {
            AppState.user.activeParts[idx] = obj;
        } 
        else {
            AppState.user.activeParts.push(obj);
        }

        // منع التكرار لنفس الجزء
        AppState.user.activeParts =
            AppState.user.activeParts.filter(
                (part, index, self) =>

                    index === self.findIndex(
                        p =>
                            parseInt(p.number) ===
                            parseInt(part.number)
                    )
            );
    }

    // ==================================
    // تحديث العدادات
    // ==================================
    syncCountersFromState();

    // تحديث حالة الجزء داخل AppState.parts
    
    const globalPart =
        AppState.parts.find(
            p => parseInt(p.number) === parseInt(num)
        );

    if (globalPart) {

        globalPart.status = status;

        globalPart.selected_by =
            status === "available"
                ? ""
                : AppState.user.username;

        globalPart.selected_jezaa_by_I =
            status !== "available";
    }

    // تحديث اسم المستخدم داخل الزر
    if (status === "available") {

        box.innerHTML = `<div>${num}</div>`;
    }
    else {

        box.innerHTML = `
            <div>${num}</div>
            <div style="font-size:10px;">
                ${AppState.user.username}
            </div>
        `;
    }

    // تحديث جدول معلومات الأجزاء
    updateJezaaInfo(num, status);


    // فحص اكتمال الختمة
    checkCompletion();

    // ==================================
    // تحديث العدادات UI
    // ==================================
    renderCounters();
    // ==================================
    // جدول معلومات الأجزاء
    // ==================================

    const row = partsRows[num];

    if (row) {

        row.remove();

        delete partsRows[num];
    }

    if (
        status === "taken" ||
        status === "read"
    ) {

        ajzaa_quran(num, status);
    }
}


/******************************
 * KHETMAH STATUS SYSTEM
 ******************************/

function checkCompletion() {

    // إذا الختمة مكتملة مسبقاً لا تكمل
    if (AppState.khetmahStatus === "completed") {
        return;
    }

    const allRead =
        AppState.parts.every(
            p => p.status === "read"
        );

    if (!allRead) return;

    // تحديث الحالة مباشرة قبل أي async
    AppState.khetmahStatus = "completed";

    disableGrid();

    if (
        socket &&
        socket.readyState === WebSocket.OPEN
    ) {

        socket.send(JSON.stringify({

            type: "khetmah_status",

            status: "completed",

            khetmah_id:
                AppState.currentKhetmahId
        }));
    }

    completeKhetmah();
}


async function completeKhetmah() {

    if (AppState.khetmahStatus === "completed") {
        return;
    }

    try {

        const response = await fetch("/active_khetmah/", {

            method: "PUT",

            headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": getCookie("csrftoken"),
            },

            body: JSON.stringify({
                khetmah_id: AppState.currentKhetmahId
            })
        });

        const data = await response.json();

        if (!data.success) return;


        // =========================
        // realtime
        // =========================
        if (socket && socket.readyState === WebSocket.OPEN) {

            socket.send(JSON.stringify({

                type: "khetmah_status",

                status: "completed",

                khetmah_id: AppState.currentKhetmahId
            }));
        }


        AppState.khetmahStatus = "completed";


        updateKhetmahStatusUI("completed");

        disableGrid();


        alert("اكتملت الختمة 🌸");

    }

    catch (e) {

        console.error(e);
    }
}



/******************************
 * UPDATE STATUS UI
 ******************************/

function updateKhetmahStatusUI(status) {

    const statusEl = document.getElementById("khetmah_status");

    if (statusEl) {statusEl.dataset.khetmahstatus = status;
        statusEl.textContent = status;
    }

    AppState.khetmahStatus = status;

    // تحديث القائمة الجانبية
    const current =
        AppState.khetmahs.find(
            k => k.id === AppState.currentKhetmahId
        );

    if (current) {

        current.status = status;
    }

    renderKhetmahList();

    // إعادة رسم الأزرار
    updateButtonsUI();

    // مهم جدا
    renderKhetmahMessage();
}


/******************************
 * BUTTONS UI
 ******************************/

function updateButtonsUI() {

    const actions = document.getElementById("khetmah-actions");

    if (!actions) return;

    // إذا ليست صاحب الختمة
    if (!AppState.isCreator) {

        actions.innerHTML = "";

        return;
    }


}

/******************************
 * KHETMAH MESSAGE UI
 ******************************/
function renderKhetmahMessage() {

    const box =
        document.getElementById("khetmah-message");

    if (!box) return;

    let html = "";

    // =========================
    // غير مسجل دخول
    // =========================
    if (!AppState.isAuthenticated) {

        if (AppState.khetmahStatus === "completed") {

            html = `
                <h6 class="alert-danger wi-0">
                    هذه الختمة أصبحت مكتملة
                </h6>
            `;
        }
        else {

            html = `
                <h6 class="alert-danger wi-1">
                    للمشاركة في هذه الختمة يجب عليك تسجيل الدخول
                </h6>
            `;
        }

        box.innerHTML = html;

        return;
    }
// =========================
// صاحب الختمة
// =========================
if (AppState.isCreator) {

    if (AppState.khetmahStatus === "active") {

        html = `
            <div class="khetmah-alert-box">
                <h6 class="alert-success wi-2wi-2">
                    <button
                    class="icon-btn"
                    onclick="delete_khetmah()"
                    type="button">

                    <i class="fa fa-close"
                       style="font-size:24px;color:red"
                       title="حذف الختمة نهائياً">
                    </i>

                </button>
                &nbsp;&nbsp;
                    تستطيع ان تتحكم بحالة كامل أجزاء ختمتك
                </h6>


            </div>
        `;
    }

    else if (
        AppState.khetmahStatus === "completed"
    ) {

        html = `
            <div class="khetmah-alert-box">

                <h6 class="alert-danger wi-0">
                    <button
                    class="icon-btn"
                    onclick="delete_khetmah()"
                    type="button">

                    <i class="fa fa-close"
                       style="font-size:24px;color:red"
                       title="حذف الختمة نهائياً">
                    </i>

                </button>
                &nbsp;&nbsp;
                   ختمتك هذه اكتملت تقبل الله
                </h6>



            </div>
        `;
    }
}
    // =========================
    // مستخدم عادي
    // =========================
    else {

        if (AppState.khetmahStatus === "active") {

            html = `
                <h6 class="alert-info wi-2">
                    للإشتراك اختر الاجزاء التي تريد حجزها وقراءتها
                </h6>
            `;
        }

        else if (
            AppState.khetmahStatus === "completed"
        ) {

            html = `
                <h6 class="alert-danger wi-1">
                    هذه الختمة أصبحت مكتملة 
                </h6>
            `;
        }
    }

    box.innerHTML = html;
}


/******************************
 * GRID CONTROL
 ******************************/

function disableGrid() {

    document
        .querySelectorAll(".available, .taken, .read")
        .forEach(btn => {

            btn.style.pointerEvents = "none";

            btn.style.opacity = "0.7";

            btn.style.cursor = "not-allowed";
        });
}

function enableGrid() {

    const grid =
        document.querySelector(".grid");

    if (!grid) return;

    grid.style.pointerEvents = "auto";

    grid.style.opacity = "0.7";
}







function updateJezaaInfo(jezaaNumber,status) {

    const table =
        document.querySelector(
            ".jezaa-info table tbody"
        );

    if (!table) return;

    // حذف إذا متاح
    if (status === "available") {

        const row = partsRows[jezaaNumber];

        if (row) {

            row.remove();

            delete partsRows[jezaaNumber];
        }

        return;
    }

    const part =
        quranParts[jezaaNumber];

    if (!part) return;

    const rowClass =
        status === "read"? "read_light": "taken_light";

    // حذف القديم
    if (partsRows[jezaaNumber]) {

        partsRows[jezaaNumber].remove();
    }

    const row =document.createElement("tr");

    row.setAttribute(
        "data-juzaa",
        jezaaNumber
    );

    row.innerHTML = `
        <td class="${rowClass}">${jezaaNumber}</td>
        <td class="${rowClass}">${part.start_ayah} الآية</td>
        <td class="${rowClass}">${part.start_surah}</td>
        <td class="${rowClass}">${part.startPage}</td>
        <td class="${rowClass}">${part.end_ayah} الآية</td>
        <td class="${rowClass}">${part.end_surah}</td>
        <td class="${rowClass}">${part.endPage}</td>
    `;

    // ترتيب
    let inserted = false;

    table.querySelectorAll("tr").forEach(existing => {

        const existingNum =parseInt(existing.dataset.juzaa);
        if (!inserted &&jezaaNumber < existingNum) {

            table.insertBefore(row,existing);
            inserted = true;
        }
    });

    if (!inserted) {

        table.appendChild(row);
    }

    partsRows[jezaaNumber] = row;
}


/******************************
 * CREATE PAGE INIT
 ******************************/
document.addEventListener("DOMContentLoaded", () => {

    if (document.getElementById("create")) {CreatePage.init();}

});

/******************************
 * Profile Picture Preview
 ******************************/
document.addEventListener("DOMContentLoaded", () => {

    if (document.getElementById("profile")) {

      document.getElementById('profile_picture').addEventListener('change', function(e) {
      const [file] = this.files;
      if (file) {
        document.getElementById('profile-preview').src = URL.createObjectURL(file);
      }
    });
    }

});



/******************************
 * CREATE NEW KHETMAH PAGE
 ******************************/

const CreatePage = {
    validatedUser: false,
    // =========================
    // INIT
    // =========================

    init() {

        this.initPartButtons();

        this.initReasonSelect();

        this.initSubmitButton();

        this.updateCreateButton();
    },

    // =========================
    // PART BUTTONS
    // =========================

    initPartButtons() {

        const buttons =
            document.querySelectorAll(
                "#create .button"
            );

        buttons.forEach(btn => {

            btn.addEventListener(
                "click",

                () => this.togglePart(btn)
            );
        });
    },


// =========================
// VALIDATE USER ON FIRST CLICK
// =========================

validateUserBeforeSelection() {

    // تم التحقق مسبقاً
    if (this.validatedUser) {
        return true;
    }

    // غير مسجل دخول
    if (!AppState.isAuthenticated) {

        alert(
            "يجب تسجيل الدخول أولاً"
        );

        return false;
    }

    // لديه ختمة نشطة
    if (AppState.user.hasActiveKhetmah) {

        alert(
            "لديك ختمة نشطة بالفعل"
        );

        window.location.href =
            `/khetmah_detail/${AppState.user.activeKhetmahId}`;

        return false;
    }

    // لديه جزء غير منتهي
    const unfinishedPart =
        AppState.user.activeParts.find(
            p => p.status === "taken"
        );

    if (
        AppState.user.hasUnfinishedJuz &&
        unfinishedPart
    ) {

        alert(
            "يجب إنهاء الأجزاء المحجوزة أولاً"
        );

        window.location.href =
            `/khetmah_detail/${unfinishedPart.khetmah_id}`;

        return false;
    }

    // نجاح التحقق
    this.validatedUser = true;

    return true;
    },

    
    // =========================
    // TOGGLE PART
    // =========================

    togglePart(btn) {

    // =========================
    // FIRST CLICK VALIDATION
    // =========================

    if (!this.validateUserBeforeSelection()){
        return;
    }

    let current = "available";

    if (btn.classList.contains("taken")) {
        current = "taken";
    }

    else if (btn.classList.contains("read")) {
        current = "read";
    }

    let next = "taken";

    if (current === "taken") {
        next = "read";
    }

    else if (current === "read") {
        next = "available";
    }

    // =========================
    // UPDATE CLASSES
    // =========================

    btn.classList.remove(
        "available",
        "taken",
        "read"
    );

    btn.classList.add(next);

    const num =
        parseInt(btn.dataset.jezaa);

    // =========================
    // UPDATE USERNAME
    // =========================

    if (next === "available") {

        btn.innerHTML = `
            ${num}
        `;
    }

    else {

        btn.innerHTML = `

            <div>${num}</div>

            <div style="font-size:10px;">
                ${AppState.user.username || ""}
            </div>
        `;
    }

    // =========================
    // UPDATE TABLE
    // =========================

    updateJezaaInfo(num, next);

    // =========================
    // UPDATE BUTTON
    // =========================

    this.updateCreateButton();
},

    // =========================
    // ENABLE BUTTON
    // =========================

    updateCreateButton() {

        const btn =
            document.getElementById(
                "create-khetmah-btn"
            );

        if (!btn) return;

        const selected =
            document.querySelectorAll(
                "#create .button.taken, #create .button.read"
            );

        btn.disabled =
            selected.length === 0;
    },

    // =========================
    // REASON SELECT
    // =========================

    initReasonSelect() {

        const select =
            document.getElementById(
                "reason-select"
            );

        if (!select) return;

        select.addEventListener(
            "change",

            () => this.renderReasonFields()
        );

        this.renderReasonFields();
    },

    // =========================
    // RENDER REASON FIELDS
    // =========================

    renderReasonFields() {

        const reason =
            document.getElementById(
                "reason-select"
            )?.value;

        const container =
            document.getElementById(
                "reason-detail"
            );

        if (!container) return;

        const templates = {

            dead: `

                <input
                    id="deceased-name"
                    type="text"
                    maxlength="14"
                    class="form-control mb-2 rtl"
                    placeholder="اسم المتوفي">

                <input
                    id="death-date"
                    type="date"
                    class="form-control mb-2">

                <input
                    type="file"
                    name="na3wa_picture"
                    accept="image/*"
                    class="form-control">
            `,

            need: `

                <input
                    name="need_detail"
                    type="text"
                    maxlength="14"
                    class="form-control rtl"
                    placeholder="ما الحاجة المطلوبة؟">
            `,

            sick: `

                <input
                    name="sick_detail"
                    type="text"
                    maxlength="14"
                    class="form-control rtl"
                    placeholder="اسم المريض ">
            `,

            travel: `

                <input
                    name="travel_detail"
                    type="text"
                    maxlength="14"
                    class="form-control rtl"
                    placeholder="تفاصيل السفر">
            `,

            Thank_God: `

                <input
                    name="Thank_God_detail"
                    type="text"
                    maxlength="14"
                    class="form-control rtl"
                    placeholder="سبب الشكر">
            `,

            days: `

                <input
                    name="days_detail"
                    type="text"
                    maxlength="14"
                    class="form-control rtl"
                    placeholder="اذكر المناسبة أو الأيام الفضيلة">
            `,

            other: `

                <input
                    name="specific_reason"
                    type="text"
                    maxlength="14"
                    class="form-control rtl"
                    placeholder="اكتب السبب">
            `
        };

        container.innerHTML = templates[reason] || "";

    //التحكم بعدد الاحرف المدخلة في الحقول
    // =========================
    // ATTACH MAXLENGTH
    // =========================
    container.querySelectorAll("input, textarea").forEach(input => {this.attachMaxlengthWarning(input);});
    },
    // =========================
    // MAX LENGTH WARNING
    // =========================

    attachMaxlengthWarning(input) {

        const maxLength =
            input.getAttribute("maxlength");

        if (!maxLength) return;

        // منع إنشاء تحذير مكرر
        if (
            input.nextElementSibling &&
            input.nextElementSibling.classList.contains(
                "maxlength-warning"
            )
        ) {
            return;
        }

        const warning =
            document.createElement("div");

        warning.className =
            "maxlength-warning";

        warning.style.color = "red";

        warning.style.display = "none";

        warning.style.marginTop = "5px";

        warning.style.fontSize = "13px";

        input.insertAdjacentElement(
            "afterend",
            warning
        );

        input.addEventListener("input",() => {
            if (input.value.length >= maxLength) {

                warning.innerText =`الحد الأقصى ${maxLength} حرف`;
                warning.style.display = "inline-block";
                warning.style.width = "fit-content";
                warning.style.backgroundColor = "#fde8ea";
                warning.style.border ="1px solid #f5c6cb";
                warning.style.padding = "5px 10px";
                warning.style.borderRadius = "5px";
                warning.style.margin = "5px auto";

            clearTimeout(warning.hideTimeout);
            warning.hideTimeout = setTimeout(() => {warning.style.display = "none";}, 3000);
         }
        }
        );
    },
    // =========================
    // SUBMIT BUTTON
    // =========================

    initSubmitButton() {

        const btn =
            document.getElementById(
                "create-khetmah-btn"
            );

        if (!btn) return;

        btn.addEventListener(
            "click",

            () => this.submit()
        );
    },

    // =========================
    // GET SELECTED PARTS
    // =========================
    getSelectedParts() {
        const selected =
            document.querySelectorAll(
                "#create .button.taken, #create .button.read"
            );

        return Array.from(selected).map(el => {

            return {
                number:
                    parseInt(el.dataset.jezaa),
                status:
                    el.classList.contains("read")
                        ? "read"
                        : "taken"
            };
        });
    },

    // =========================
    // VALIDATE
    // =========================

    validate(parts) {

        if (!parts.length) {

            alert(
                "يجب اختيار جزء واحد على الأقل"
            );

            return false;
        }

        return true;
    },

    // =========================
    // BUILD FORM DATA
    // =========================

    buildFormData(parts) {

        const formData =
            new FormData();

        const reason =
            document.getElementById(
                "reason-select"
            )?.value;

        const sharingType =
            document.getElementById(
                "privacy-select"
            )?.value;

        const reasonDetail =
            document.getElementById(
                "reason-detail"
            );

        formData.append(
            "reason",
            reason
        );

        formData.append(
            "sharing_type",
            sharingType
        );

        formData.append(
            "parts",
            JSON.stringify(parts)
        );

        // DEAD

        if (reason === "dead") {

            formData.append("deceased_name",reasonDetail.querySelector("#deceased-name")?.value || "");

            formData.append(
                "death_date",

                reasonDetail.querySelector(
                    "#death-date"
                )?.value || ""
            );

            const image =
                reasonDetail.querySelector(
                    "input[name='na3wa_picture']"
                )?.files[0];

            if (image) {

                formData.append(
                    "na3wa_picture",
                    image
                );
            }
        }

        // OTHER TYPES

        const fields = {

            need:
                "need_detail",

            sick:
                "sick_detail",

            travel:
                "travel_detail",

            Thank_God:
                "Thank_God_detail",

            days:
                "days_detail",

            other:
                "specific_reason"
        };

        const fieldName =
            fields[reason];

        if (fieldName) {

            formData.append(

                fieldName,

                reasonDetail.querySelector(
                    `input[name="${fieldName}"]`
                )?.value || ""
            );
        }

        return formData;
    },

    // =========================
    // SUBMIT
    // =========================

    async submit() {

        const parts =
            this.getSelectedParts();

        if (!this.validate(parts)) {
            return;
        }

        const formData =
            this.buildFormData(parts);

        try {

            const response =
                await fetch(
                    "/create_khetmah/",
                    {

                        method: "POST",

                        headers: {

                            "X-CSRFToken":
                                getCookie("csrftoken")
                        },

                        body: formData
                    }
                );

            const data =
                await response.json();

            if (data.success) {

                window.location.href =
                    `/khetmah_detail/${data.khetmah_id}`;

                return;
            }

            alert(data.message);

            if (data.redirect_id) {

                window.location.href =
                    `/khetmah_detail/${data.redirect_id}`;
            }
        }

        catch (e) {

            console.error(e);

            alert(
                "فشل إنشاء الختمة"
            );
        }
    }
};







/******************************
 * DELETE
 ******************************/

async function delete_khetmah() {

    if (
        !confirm(
            "هل أنت متأكد من حذف الختمة؟"
        )
    ) {
        return;
    }

    try {

        const response =
            await fetch("/delete_khetmah/", {

                method: "DELETE",

                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken":
                        getCookie("csrftoken"),
                },

                body: JSON.stringify({
                    khetmah_id:
                        AppState.currentKhetmahId
                })
            });

        const data =
            await response.json();

        if (!data.success) {

            alert(data.message);
            return;
        }

        // =========================
        // realtime
        // =========================
        if (socket && socket.readyState === WebSocket.OPEN) {

            socket.send(JSON.stringify({

                type: "khetmah_deleted",

                khetmah_id: AppState.currentKhetmahId
            }));
        }

        if (data.lastkhetmahID) {

            window.location.href =
                `/khetmah_detail/${data.lastkhetmahID}`;
        }

        else {

            window.location.href = "/";
        }

    }

    catch (e) {

        console.error(e);
    }
}
/////////////////////////////////////











/******************************
 * COOKIE
 ******************************/
function getCookie(name) {

    let cookieValue = null;

    document.cookie.split(";").forEach(c => {
        c = c.trim();
        if (c.startsWith(name + "=")) {
            cookieValue = decodeURIComponent(c.split("=")[1]);
        }
    });

    return cookieValue;
}


/******************************
 * PART INFO TABLE
 ******************************/
async function ajzaa_quran(
    jezaaNumber,
    status
) {

    if (status === "taken") {
        status = "taken_light";
    }

    else if (status === "read") {
        status = "read_light";
    }

    if (!quranParts[jezaaNumber]) {
        return;
    }

    const part =
        quranParts[jezaaNumber];

    const newRow =
        document.createElement("tr");

    newRow.setAttribute(
        "data-juzaa",
        jezaaNumber
    );

    newRow.innerHTML = `
        <td class="${status}">
            ${jezaaNumber}
        </td>

        <td class="${status}">
            ${part.start_ayah} الآية
        </td>

        <td class="${status}">
            ${part.start_surah}
        </td>

        <td class="${status}">
            ${part.startPage}
        </td>

        <td class="${status}">
            ${part.end_ayah} الآية
        </td>

        <td class="${status}">
            ${part.end_surah}
        </td>

        <td class="${status}">
            ${part.endPage}
        </td>
    `;

    const table =
        document.querySelector(
            ".jezaa-info table tbody"
        );

    if (!table) {
        return;
    }

    const rows =
        table.querySelectorAll("tr");

    let inserted = false;

    for (let row of rows) {

        const existingNumber =
            parseInt(
                row.getAttribute(
                    "data-juzaa"
                )
            );

        if (jezaaNumber < existingNumber) {

            table.insertBefore(
                newRow,
                row
            );

            inserted = true;

            break;
        }
    }

    if (!inserted) {

        table.appendChild(newRow);
    }

    partsRows[jezaaNumber] =
        newRow;
}



/******************************
 * login/ registermodal
 ******************************/

document.addEventListener("DOMContentLoaded", function () {

    const modal = document.getElementById("auth-modal");
    const authContent = document.getElementById("auth-content");

    function openModal(){
        modal.classList.remove("hidden");
    }

    function closeModal(){
        modal.classList.add("hidden");
    }

    // زر الإغلاق
    const closeBtn = document.getElementById("close-auth-modal");

    if(closeBtn){
        closeBtn.addEventListener("click", closeModal);
    }

    // فتح login/register
    document.addEventListener("click", async function(e){

        // LOGIN
        if(e.target.closest(".open-login")){

            e.preventDefault();

            const currentPath = window.location.pathname;

            const response = await fetch(`/login/?next=${currentPath}`);

            const html = await response.text();

            authContent.innerHTML = html;

            openModal();
        }

        // REGISTER
        if(e.target.closest(".open-register")){

            e.preventDefault();

            const currentPath = window.location.pathname;

            const response = await fetch(`/register/?next=${currentPath}`);

            const html = await response.text();

            authContent.innerHTML = html;

            openModal();
        }

    });

    // SUBMIT LOGIN + REGISTER
    document.addEventListener("submit", async function(e){

        // LOGIN FORM
        if(e.target.matches("#login-form")){

            e.preventDefault();

            const form = e.target;

            const formData = new FormData(form);

            const response = await fetch(form.action, {
                method: "POST",
                body: formData,
                headers: {
                    "X-Requested-With": "XMLHttpRequest"
                }
            });

            const html = await response.text();

            // إذا فشل login
            if(html.includes('id="login-form"')){

                authContent.innerHTML = html;

            }else{

                window.location.reload();
            }
        }

        // REGISTER FORM
        if(e.target.matches("#register-form")){

            e.preventDefault();

            const form = e.target;

            const formData = new FormData(form);

            const response = await fetch(form.action, {
                method: "POST",
                body: formData,
                headers: {
                    "X-Requested-With": "XMLHttpRequest"
                }
            });

            const html = await response.text();

            // إذا فشل register
            if(html.includes('id="register-form"')){

                authContent.innerHTML = html;

            }else{

                window.location.reload();
            }
        }

    });

});


/******************************
 * Na3wa Modal
 ******************************/

document.addEventListener("DOMContentLoaded", function () {

    const modal =
        document.getElementById("auth-modal");

    const authContent =
        document.getElementById("auth-content");

    const toggleLink =
        document.getElementById("toggle-link");

    if (!modal || !authContent || !toggleLink) {
        return;
    }

    toggleLink.addEventListener("click", function () {

        const na3waContent =
            document.getElementById("na3wa-img");

        if (!na3waContent) {
            return;
        }

        // نسخ المحتوى داخل المودال
        authContent.innerHTML =
            na3waContent.innerHTML;

        modal.classList.remove("hidden");

        // =========================
        // IMPORTANT
        // ابحث داخل المودال فقط
        // =========================

        const input =
            authContent.querySelector("#na3wa_image_input");

        const preview =
            authContent.querySelector("#na3wa-preview");

        if (input && preview) {

            input.addEventListener("change", function () {

                const file = this.files[0];

                if (file) {

                    preview.src =
                        URL.createObjectURL(file);
                }
            });
        }
    });
});


/******************************
 * QURAN PARTS MAP
 ******************************/
const quranParts = {
    1: { start_surah: "الفاتحة", start_ayah: 1, end_surah: "البقرة", end_ayah: 141, startPage: 1, endPage: 21 },
    2: { start_surah: "البقرة", start_ayah: 142, end_surah: "البقرة", end_ayah: 252, startPage: 22, endPage: 41 },
    3: { start_surah: "البقرة", start_ayah: 253, end_surah: "آل عمران", end_ayah: 92, startPage: 42, endPage: 62 },
    4: { start_surah: "آل عمران", start_ayah: 93, end_surah: "النساء", end_ayah: 23, startPage: 63, endPage: 81 },
    5: { start_surah: "النساء", start_ayah: 24, end_surah: "النساء", end_ayah: 147, startPage: 82, endPage: 101 },
    6: { start_surah: "النساء", start_ayah: 148, end_surah: "المائدة", end_ayah: 81, startPage: 102, endPage: 121 },
    7: { start_surah: "المائدة", start_ayah: 82, end_surah: "الأنعام", end_ayah: 110, startPage: 121, endPage: 141 },
    8: { start_surah: "الأنعام", start_ayah: 111, end_surah: "الأعراف", end_ayah: 87, startPage: 142, endPage: 161 },
    9: { start_surah: "الأعراف", start_ayah: 88, end_surah: "الأنفال", end_ayah: 40, startPage: 162, endPage: 181 },
    10: { start_surah: "الأنفال", start_ayah: 41, end_surah: "التوبة", end_ayah: 92, startPage: 182, endPage: 201 },
    11: { start_surah: "التوبة", start_ayah: 93, end_surah: "هود", end_ayah: 5, startPage: 201, endPage: 221 },
    12: { start_surah: "هود", start_ayah: 6, end_surah: "يوسف", end_ayah: 52, startPage: 222, endPage: 241 },
    13: { start_surah: "يوسف", start_ayah: 53, end_surah: "إبراهيم", end_ayah: 52, startPage: 242, endPage: 261 },
    14: { start_surah: "الحجر", start_ayah: 1, end_surah: "النحل", end_ayah: 128, startPage: 262, endPage: 281 },
    15: { start_surah: "الإسراء", start_ayah: 1, end_surah: "الكهف", end_ayah: 74, startPage: 282, endPage: 301 },
    16: { start_surah: "الكهف", start_ayah: 75, end_surah: "طه", end_ayah: 135, startPage: 302, endPage: 321 },
    17: { start_surah: "الأنبياء", start_ayah: 1, end_surah: "الحج", end_ayah: 78, startPage: 322, endPage: 341 },
    18: { start_surah: "المؤمنون", start_ayah: 1, end_surah: "الفرقان", end_ayah: 20, startPage: 342, endPage: 361 },
    19: { start_surah: "الفرقان", start_ayah: 21, end_surah: "النمل", end_ayah: 55, startPage: 362, endPage: 381 },
    20: { start_surah: "النمل", start_ayah: 56, end_surah: "العنكبوت", end_ayah: 45, startPage: 382, endPage: 401 },
    21: { start_surah: "العنكبوت", start_ayah: 46, end_surah: "الأحزاب", end_ayah: 30, startPage: 402, endPage: 421 },
    22: { start_surah: "الأحزاب", start_ayah: 31, end_surah: "يس", end_ayah: 27, startPage: 422, endPage: 441 },
    23: { start_surah: "يس", start_ayah: 28, end_surah: "الزمر", end_ayah: 31, startPage: 442, endPage: 461 },
    24: { start_surah: "الزمر", start_ayah: 32, end_surah: "فصلت", end_ayah: 46, startPage: 462, endPage: 481 },
    25: { start_surah: "فصلت", start_ayah: 47, end_surah: "الجاثية", end_ayah: 37, startPage: 482, endPage: 502 },
    26: { start_surah: "الأحقاف", start_ayah: 1, end_surah: "الذاريات", end_ayah: 30, startPage: 502, endPage: 521 },
    27: { start_surah: "الذاريات", start_ayah: 31, end_surah: "الحديد", end_ayah: 29, startPage: 522, endPage: 541 },
    28: { start_surah: "المجادلة", start_ayah: 1, end_surah: "التحريم", end_ayah: 12, startPage: 542, endPage: 561 },
    29: { start_surah: "الملك", start_ayah: 1, end_surah: "المزمل", end_ayah: 20, startPage: 562, endPage: 581 },
    30: { start_surah: "المزمل", start_ayah: 1, end_surah: "الناس", end_ayah: 6, startPage: 582, endPage: 604 }
};

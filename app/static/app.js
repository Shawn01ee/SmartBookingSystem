const ADMIN_KEY = "smart-booking-admin-token";

const route = getRoute();
const root = document.getElementById("root");

const state = {
  guest: {
    restaurants: [],
    selectedRestaurantId: "",
    slots: [],
    message: null,
    waitMessage: null,
    reservationVerification: {
      code: "",
      verifiedEmail: "",
      message: null,
    },
    waitlistVerification: {
      code: "",
      verifiedEmail: "",
      message: null,
    },
    reservationForm: {
      slot_id: "",
      party_size: "2",
      guest_name: "",
      guest_email: "",
      phone_number: "",
    },
    waitlistForm: {
      day: "",
      time_start: "18:00",
      time_end: "20:00",
      party_size: "2",
      guest_name: "",
      guest_email: "",
      phone_number: "",
      notes: "",
    },
  },
  admin: {
    token: localStorage.getItem(ADMIN_KEY) || "",
    dashboard: null,
    message: null,
    restaurantForm: {
      name: "",
      description: "",
      contact_email: "",
    },
    tableForm: {
      restaurant_id: "",
      name: "",
      capacity: "2",
      combinable_group: "",
    },
    slotForm: {
      restaurant_id: "",
      day: "",
      time: "18:00",
    },
    openSlotForm: {
      slot_id: "",
      party_size_cap: "2",
    },
  },
  claim: {
    data: null,
    message: null,
  },
  payment: {
    data: null,
    message: null,
  },
};

init();

async function init() {
  renderLoading();
  try {
    if (route.name === "guest") {
      await loadGuestPage();
      renderGuestPage();
      return;
    }
    if (route.name === "admin") {
      if (state.admin.token) {
        await loadAdminDashboard();
      }
      renderAdminPage();
      return;
    }
    if (route.name === "claim") {
      await loadClaimPage();
      renderClaimPage();
      return;
    }
    if (route.name === "pay") {
      await loadPaymentPage();
      renderPaymentPage();
    }
  } catch (error) {
    renderFatal(error.message);
  }
}

function getRoute() {
  const path = window.location.pathname;
  if (path.startsWith("/admin")) {
    return { name: "admin" };
  }
  if (path.startsWith("/claim/")) {
    return { name: "claim", token: path.split("/").pop() };
  }
  if (path.startsWith("/pay/")) {
    return { name: "pay", token: path.split("/").pop() };
  }
  return { name: "guest" };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function layout(inner) {
  return `
    <div class="app-shell">
      <header class="topbar">
        <div class="brand">
          <div class="brand-mark">SB</div>
          <div class="brand-copy">
            <h1>Smart Booking System</h1>
            <p>취소, 대기, 결제까지 연결된 식당 예약 엔진</p>
          </div>
        </div>
        <nav class="nav-links">
          <a href="/">Guest</a>
          <a href="/admin">Admin</a>
        </nav>
      </header>
      ${inner}
    </div>
  `;
}

function messageHtml(message) {
  if (!message) {
    return "";
  }
  return `<div class="message ${escapeHtml(message.kind)}">${escapeHtml(message.text)}</div>`;
}

function statusHtml(status) {
  const safe = escapeHtml(status || "unknown");
  return `<span class="status ${safe}">${safe}</span>`;
}

function formatTime(value) {
  return String(value || "").slice(0, 5);
}

function groupedSlots(slots) {
  const map = new Map();
  for (const slot of slots) {
    const items = map.get(slot.day) || [];
    items.push(slot);
    map.set(slot.day, items);
  }
  return Array.from(map.entries());
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function verificationDone(verificationState, email) {
  return normalizeEmail(email) && verificationState.verifiedEmail === normalizeEmail(email);
}

function resetVerificationIfEmailChanged(verificationState, email) {
  if (verificationState.verifiedEmail && verificationState.verifiedEmail !== normalizeEmail(email)) {
    verificationState.verifiedEmail = "";
    verificationState.message = null;
    verificationState.code = "";
  }
}

function verificationBox(prefix, email, verificationState) {
  const verified = verificationDone(verificationState, email);
  return `
    <div class="mini-card">
      <div class="card-head">
        <strong>이메일 인증</strong>
        ${verified ? '<span class="status verified">인증 완료</span>' : '<span class="status pending">인증 필요</span>'}
      </div>
      ${messageHtml(verificationState.message)}
      <div class="form-grid">
        <label class="field">
          <span>인증번호</span>
          <input id="${prefix}-verification-code" value="${escapeHtml(verificationState.code)}" placeholder="6자리 코드" />
        </label>
        <div class="field">
          <span>메일 발송 / 확인</span>
          <div class="button-row">
            <button class="btn secondary small" id="${prefix}-send-code" type="button">코드 보내기</button>
            <button class="btn primary small" id="${prefix}-verify-code" type="button">코드 확인</button>
          </div>
        </div>
      </div>
      <p class="muted" style="margin-top:10px;">예약과 대기 등록 전, 현재 입력한 이메일로 인증을 완료해야 합니다.</p>
    </div>
  `;
}

async function apiFetch(path, options = {}, adminToken = null) {
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (adminToken) {
    headers.set("X-Admin-Token", adminToken);
  }
  const response = await fetch(path, { ...options, headers });
  if (!response.ok) {
    let detail = `Request failed: ${response.status}`;
    try {
      const payload = await response.json();
      if (payload.detail) {
        detail = payload.detail;
      }
    } catch (_error) {
      // Ignore invalid JSON.
    }
    throw new Error(detail);
  }
  return response.json();
}

function renderLoading() {
  root.innerHTML = layout(`<section class="panel"><div class="empty">불러오는 중입니다...</div></section>`);
}

function renderFatal(text) {
  root.innerHTML = layout(`<section class="panel">${messageHtml({ kind: "error", text })}</section>`);
}

async function loadGuestPage() {
  const restaurants = await apiFetch("/api/public/restaurants");
  state.guest.restaurants = restaurants;
  if (!state.guest.selectedRestaurantId && restaurants[0]) {
    state.guest.selectedRestaurantId = String(restaurants[0].id);
  }
  if (state.guest.selectedRestaurantId) {
    await loadGuestSlots(state.guest.selectedRestaurantId);
  }
}

async function loadGuestSlots(restaurantId) {
  const slots = await apiFetch(`/api/public/restaurants/${restaurantId}/slots`);
  state.guest.slots = slots;
  if (!state.guest.reservationForm.slot_id && slots[0]) {
    state.guest.reservationForm.slot_id = String(slots[0].id);
  }
  if (!state.guest.waitlistForm.day && slots[0]) {
    state.guest.waitlistForm.day = slots[0].day;
  }
}

function renderGuestPage() {
  const guest = state.guest;
  const restaurants = guest.restaurants;
  const slots = guest.slots;
  const selectedRestaurant = restaurants.find(
    (restaurant) => String(restaurant.id) === guest.selectedRestaurantId,
  );
  const slotGroups = groupedSlots(slots);

  root.innerHTML = layout(`
    <section class="hero">
      <div class="hero-card hero-main">
        <div class="pill">Offline-safe UI</div>
        <h2>빈자리 생기면 자동으로 이어지는 식당 예약 경험</h2>
        <p>
          이 웹사이트는 식당이 직접 쓰는 자체 예약 시스템입니다. 테이블 단위 배정, 보증금 결제,
          취소 발생 시 대기자 순차 알림까지 하나의 흐름으로 연결돼 있어요.
        </p>
        <div class="hero-points">
          <div class="hero-point">
            <strong>테이블 배정</strong>
            <span>단일 테이블 우선, 없으면 조합으로 최적 배정</span>
          </div>
          <div class="hero-point">
            <strong>대기열 엔진</strong>
            <span>취소가 생기면 조건에 맞는 손님에게 순차 오퍼</span>
          </div>
          <div class="hero-point">
            <strong>클레임 + 결제</strong>
            <span>TTL 안에 수락과 보증금 결제가 끝나야 확정</span>
          </div>
        </div>
      </div>
      <aside class="hero-card hero-side">
        <h3>Demo 안내</h3>
        <ul>
          <li>기본 식당 Mosu Seoul과 샘플 슬롯이 자동 생성됩니다.</li>
          <li>SMTP가 없으면 이메일은 서버 콘솔에 출력됩니다.</li>
          <li>관리자 화면에서 예약 취소를 누르면 대기열 엔진이 바로 작동합니다.</li>
        </ul>
      </aside>
    </section>

    <div class="grid two">
      <section class="panel">
        <h3>손님 예약</h3>
        <p>원하는 슬롯을 선택하고 보증금 결제로 예약을 확정하세요.</p>
        ${messageHtml(guest.message)}
        <form id="reservation-form">
          <div class="form-grid">
            <label class="field full">
              <span>식당</span>
              <select id="guest-restaurant-select">
                ${restaurants
                  .map(
                    (restaurant) => `
                      <option value="${escapeHtml(restaurant.id)}" ${
                        String(restaurant.id) === guest.selectedRestaurantId ? "selected" : ""
                      }>
                        ${escapeHtml(restaurant.name)}
                      </option>
                    `,
                  )
                  .join("")}
              </select>
            </label>
            <label class="field full">
              <span>슬롯</span>
              <select id="reservation-slot">
                ${slots
                  .map(
                    (slot) => `
                      <option value="${escapeHtml(slot.id)}" ${
                        String(slot.id) === guest.reservationForm.slot_id ? "selected" : ""
                      }>
                        ${escapeHtml(slot.day)} ${escapeHtml(formatTime(slot.time))}
                      </option>
                    `,
                  )
                  .join("")}
              </select>
            </label>
            <label class="field">
              <span>인원</span>
              <input id="reservation-party-size" type="number" min="1" max="20" value="${escapeHtml(
                guest.reservationForm.party_size,
              )}" />
            </label>
            <label class="field">
              <span>이름</span>
              <input id="reservation-guest-name" value="${escapeHtml(
                guest.reservationForm.guest_name,
              )}" />
            </label>
            <label class="field">
              <span>휴대폰 번호</span>
              <input id="reservation-phone-number" value="${escapeHtml(
                guest.reservationForm.phone_number,
              )}" placeholder="01012345678" />
            </label>
            <label class="field full">
              <span>이메일</span>
              <input id="reservation-guest-email" type="email" value="${escapeHtml(
                guest.reservationForm.guest_email,
              )}" />
            </label>
            <div class="field full">
              ${verificationBox("reservation", guest.reservationForm.guest_email, guest.reservationVerification)}
            </div>
          </div>
          <div class="button-row">
            <button class="btn primary" type="submit">결제 단계로 이동</button>
          </div>
        </form>
        <div class="cards" style="margin-top:18px;">
          ${
            slotGroups.length
              ? slotGroups
                  .map(
                    ([day, daySlots]) => `
                      <div class="mini-card">
                        <p class="eyebrow">${escapeHtml(selectedRestaurant?.name || "Restaurant")}</p>
                        <div class="card-head">
                          <strong>${escapeHtml(day)}</strong>
                          <span class="muted">${daySlots.length} slots</span>
                        </div>
                        <div class="button-row">
                          ${daySlots
                            .map((slot) => `<span class="pill">${escapeHtml(formatTime(slot.time))}</span>`)
                            .join("")}
                        </div>
                      </div>
                    `,
                  )
                  .join("")
              : '<div class="empty">현재 공개된 슬롯이 없습니다.</div>'
          }
        </div>
      </section>

      <section class="panel">
        <h3>대기 등록</h3>
        <p>원하는 날짜와 시간 범위를 남겨두면 취소 발생 시 이메일 오퍼를 받을 수 있어요.</p>
        ${messageHtml(guest.waitMessage)}
        <form id="waitlist-form">
          <div class="form-grid">
            <label class="field full">
              <span>식당</span>
              <select id="waitlist-restaurant-select">
                ${restaurants
                  .map(
                    (restaurant) => `
                      <option value="${escapeHtml(restaurant.id)}" ${
                        String(restaurant.id) === guest.selectedRestaurantId ? "selected" : ""
                      }>
                        ${escapeHtml(restaurant.name)}
                      </option>
                    `,
                  )
                  .join("")}
              </select>
            </label>
            <label class="field">
              <span>날짜</span>
              <input id="waitlist-day" type="date" value="${escapeHtml(guest.waitlistForm.day)}" />
            </label>
            <label class="field">
              <span>인원</span>
              <input id="waitlist-party-size" type="number" min="1" max="20" value="${escapeHtml(
                guest.waitlistForm.party_size,
              )}" />
            </label>
            <label class="field">
              <span>희망 시작 시간</span>
              <input id="waitlist-time-start" type="time" value="${escapeHtml(
                guest.waitlistForm.time_start,
              )}" />
            </label>
            <label class="field">
              <span>희망 마감 시간</span>
              <input id="waitlist-time-end" type="time" value="${escapeHtml(
                guest.waitlistForm.time_end,
              )}" />
            </label>
            <label class="field">
              <span>이름</span>
              <input id="waitlist-guest-name" value="${escapeHtml(guest.waitlistForm.guest_name)}" />
            </label>
            <label class="field">
              <span>휴대폰 번호</span>
              <input id="waitlist-phone-number" value="${escapeHtml(
                guest.waitlistForm.phone_number,
              )}" placeholder="01012345678" />
            </label>
            <label class="field">
              <span>이메일</span>
              <input id="waitlist-guest-email" type="email" value="${escapeHtml(
                guest.waitlistForm.guest_email,
              )}" />
            </label>
            <div class="field full">
              ${verificationBox("waitlist", guest.waitlistForm.guest_email, guest.waitlistVerification)}
            </div>
            <label class="field full">
              <span>메모</span>
              <textarea id="waitlist-notes" placeholder="예: 창가 선호, 10분 전후 가능">${escapeHtml(
                guest.waitlistForm.notes,
              )}</textarea>
            </label>
          </div>
          <div class="button-row">
            <button class="btn primary" type="submit">대기열 등록</button>
          </div>
        </form>
      </section>
    </div>
  `);

  bindGuestEvents();
}

function bindGuestEvents() {
  document.getElementById("guest-restaurant-select")?.addEventListener("change", async (event) => {
    state.guest.selectedRestaurantId = event.target.value;
    state.guest.message = null;
    state.guest.waitMessage = null;
    state.guest.reservationForm.slot_id = "";
    await loadGuestSlots(event.target.value);
    renderGuestPage();
  });

  document.getElementById("waitlist-restaurant-select")?.addEventListener("change", async (event) => {
    state.guest.selectedRestaurantId = event.target.value;
    state.guest.message = null;
    state.guest.waitMessage = null;
    state.guest.reservationForm.slot_id = "";
    await loadGuestSlots(event.target.value);
    renderGuestPage();
  });

  bindInput("reservation-slot", (value) => {
    state.guest.reservationForm.slot_id = value;
  });
  bindInput("reservation-party-size", (value) => {
    state.guest.reservationForm.party_size = value;
  });
  bindInput("reservation-guest-name", (value) => {
    state.guest.reservationForm.guest_name = value;
  });
  bindInput("reservation-phone-number", (value) => {
    state.guest.reservationForm.phone_number = value;
  });
  bindInput("reservation-guest-email", (value) => {
    state.guest.reservationForm.guest_email = value;
    resetVerificationIfEmailChanged(state.guest.reservationVerification, value);
  });
  bindInput("waitlist-day", (value) => {
    state.guest.waitlistForm.day = value;
  });
  bindInput("waitlist-party-size", (value) => {
    state.guest.waitlistForm.party_size = value;
  });
  bindInput("waitlist-time-start", (value) => {
    state.guest.waitlistForm.time_start = value;
  });
  bindInput("waitlist-time-end", (value) => {
    state.guest.waitlistForm.time_end = value;
  });
  bindInput("waitlist-guest-name", (value) => {
    state.guest.waitlistForm.guest_name = value;
  });
  bindInput("waitlist-phone-number", (value) => {
    state.guest.waitlistForm.phone_number = value;
  });
  bindInput("waitlist-guest-email", (value) => {
    state.guest.waitlistForm.guest_email = value;
    resetVerificationIfEmailChanged(state.guest.waitlistVerification, value);
  });
  bindInput("waitlist-notes", (value) => {
    state.guest.waitlistForm.notes = value;
  });
  bindInput("reservation-verification-code", (value) => {
    state.guest.reservationVerification.code = value;
  });
  bindInput("waitlist-verification-code", (value) => {
    state.guest.waitlistVerification.code = value;
  });

  document.getElementById("reservation-form")?.addEventListener("submit", submitReservation);
  document.getElementById("waitlist-form")?.addEventListener("submit", submitWaitlist);
  document.getElementById("reservation-send-code")?.addEventListener("click", sendReservationVerificationCode);
  document.getElementById("reservation-verify-code")?.addEventListener("click", verifyReservationCode);
  document.getElementById("waitlist-send-code")?.addEventListener("click", sendWaitlistVerificationCode);
  document.getElementById("waitlist-verify-code")?.addEventListener("click", verifyWaitlistVerificationCode);
}

async function requestEmailVerification(email, verificationState, rerender) {
  verificationState.message = null;
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    verificationState.message = { kind: "error", text: "이메일을 먼저 입력해 주세요." };
    rerender();
    return;
  }
  try {
    await apiFetch("/api/public/email-verifications/request", {
      method: "POST",
      body: JSON.stringify({ email: normalizedEmail }),
    });
    verificationState.message = { kind: "info", text: "인증번호를 이메일로 보냈습니다." };
    rerender();
  } catch (error) {
    verificationState.message = { kind: "error", text: error.message };
    rerender();
  }
}

async function confirmEmailVerification(email, verificationState, rerender) {
  verificationState.message = null;
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    verificationState.message = { kind: "error", text: "이메일을 먼저 입력해 주세요." };
    rerender();
    return;
  }
  if (!verificationState.code.trim()) {
    verificationState.message = { kind: "error", text: "인증번호를 입력해 주세요." };
    rerender();
    return;
  }
  try {
    await apiFetch("/api/public/email-verifications/confirm", {
      method: "POST",
      body: JSON.stringify({ email: normalizedEmail, code: verificationState.code.trim() }),
    });
    verificationState.verifiedEmail = normalizedEmail;
    verificationState.message = { kind: "info", text: "이메일 인증이 완료되었습니다." };
    rerender();
  } catch (error) {
    verificationState.message = { kind: "error", text: error.message };
    rerender();
  }
}

async function sendReservationVerificationCode() {
  await requestEmailVerification(
    state.guest.reservationForm.guest_email,
    state.guest.reservationVerification,
    renderGuestPage,
  );
}

async function verifyReservationCode() {
  await confirmEmailVerification(
    state.guest.reservationForm.guest_email,
    state.guest.reservationVerification,
    renderGuestPage,
  );
}

async function sendWaitlistVerificationCode() {
  await requestEmailVerification(
    state.guest.waitlistForm.guest_email,
    state.guest.waitlistVerification,
    renderGuestPage,
  );
}

async function verifyWaitlistVerificationCode() {
  await confirmEmailVerification(
    state.guest.waitlistForm.guest_email,
    state.guest.waitlistVerification,
    renderGuestPage,
  );
}

async function submitReservation(event) {
  event.preventDefault();
  state.guest.message = null;
  if (!verificationDone(state.guest.reservationVerification, state.guest.reservationForm.guest_email)) {
    state.guest.message = { kind: "error", text: "예약 전에 이메일 인증을 완료해 주세요." };
    renderGuestPage();
    return;
  }
  try {
    const result = await apiFetch(
      `/api/public/restaurants/${state.guest.selectedRestaurantId}/reservations`,
      {
        method: "POST",
        body: JSON.stringify({
          slot_id: Number(state.guest.reservationForm.slot_id),
          party_size: Number(state.guest.reservationForm.party_size),
          guest_name: state.guest.reservationForm.guest_name,
          guest_email: state.guest.reservationForm.guest_email,
          phone_number: state.guest.reservationForm.phone_number,
        }),
      },
    );
    if (!result.ok && result.status === "waitlist_recommended") {
      state.guest.message = {
        kind: "info",
        text: "해당 슬롯은 이미 만석입니다. 아래 대기 등록으로 이어가면 취소 발생 시 순차 알림을 받을 수 있어요.",
      };
      renderGuestPage();
      return;
    }
    window.location.href = `/pay/${result.payment_token}`;
  } catch (error) {
    state.guest.message = { kind: "error", text: error.message };
    renderGuestPage();
  }
}

async function submitWaitlist(event) {
  event.preventDefault();
  state.guest.waitMessage = null;
  if (!verificationDone(state.guest.waitlistVerification, state.guest.waitlistForm.guest_email)) {
    state.guest.waitMessage = { kind: "error", text: "대기 신청 전에 이메일 인증을 완료해 주세요." };
    renderGuestPage();
    return;
  }
  try {
    const result = await apiFetch(
      `/api/public/restaurants/${state.guest.selectedRestaurantId}/waitlist`,
      {
        method: "POST",
        body: JSON.stringify({
          day: state.guest.waitlistForm.day,
          time_start: `${state.guest.waitlistForm.time_start}:00`,
          time_end: `${state.guest.waitlistForm.time_end}:00`,
          party_size: Number(state.guest.waitlistForm.party_size),
          guest_name: state.guest.waitlistForm.guest_name,
          guest_email: state.guest.waitlistForm.guest_email,
          phone_number: state.guest.waitlistForm.phone_number,
          notes: state.guest.waitlistForm.notes,
        }),
      },
    );
    state.guest.waitMessage = {
      kind: "info",
      text: `대기 등록이 완료됐어요. 요청 번호는 #${result.waitlist_id} 입니다.`,
    };
    renderGuestPage();
  } catch (error) {
    state.guest.waitMessage = { kind: "error", text: error.message };
    renderGuestPage();
  }
}

async function loadClaimPage() {
  state.claim.data = await apiFetch(`/api/public/claims/${route.token}`);
}

function renderClaimPage() {
  const claim = state.claim.data;
  root.innerHTML = layout(`
    <section class="panel" style="max-width:760px;margin:0 auto;">
      <h3>대기 오퍼 수락</h3>
      ${messageHtml(state.claim.message)}
      ${
        claim
          ? `
            <p>오퍼를 수락하면 보증금 결제 단계로 이동하고, 결제가 끝나면 예약이 확정됩니다.</p>
            <div class="mini-card">
              <p class="eyebrow">${escapeHtml(claim.restaurant_name)}</p>
              <h4>${escapeHtml(claim.day)} ${escapeHtml(formatTime(claim.time))}</h4>
              <div class="button-row">
                ${statusHtml(claim.status)}
                <span class="pill">${escapeHtml(claim.party_size)}명</span>
                <span class="pill">만료 ${escapeHtml(claim.expires_at.replace("T", " ").slice(0, 16))} UTC</span>
              </div>
            </div>
            <div class="button-row">
              ${
                claim.status === "active"
                  ? '<button id="claim-accept" class="btn primary">오퍼 수락 후 결제</button>'
                  : '<a class="btn primary" href="/">홈으로</a>'
              }
            </div>
          `
          : '<div class="empty">오퍼 정보를 찾지 못했습니다.</div>'
      }
    </section>
  `);

  document.getElementById("claim-accept")?.addEventListener("click", acceptClaim);
}

async function acceptClaim() {
  try {
    const result = await apiFetch(`/api/public/claims/${route.token}/accept`, { method: "POST" });
    window.location.href = `/pay/${result.payment_token}`;
  } catch (error) {
    state.claim.message = { kind: "error", text: error.message };
    renderClaimPage();
  }
}

async function loadPaymentPage() {
  state.payment.data = await apiFetch(`/api/public/payments/${route.token}`);
}

function renderPaymentPage() {
  const payment = state.payment.data;
  root.innerHTML = layout(`
    <section class="panel" style="max-width:760px;margin:0 auto;">
      <h3>보증금 결제</h3>
      ${messageHtml(state.payment.message)}
      ${
        payment
          ? `
            <div class="mini-card">
              <p class="eyebrow">Reservation #${escapeHtml(payment.reservation_id)}</p>
              <h4>${Number(payment.amount).toLocaleString()} KRW</h4>
              <div class="button-row">
                ${statusHtml(payment.status)}
                <span class="pill">테이블 ${escapeHtml((payment.tables || []).join(", ") || "-")}</span>
              </div>
              <p class="muted">결제 만료 시간: ${escapeHtml(
                payment.expires_at.replace("T", " ").slice(0, 16),
              )} UTC</p>
            </div>
            <div class="button-row">
              ${
                payment.status === "pending"
                  ? '<button id="payment-complete" class="btn primary">지금 결제하기</button>'
                  : '<a class="btn primary" href="/">홈으로</a>'
              }
            </div>
          `
          : '<div class="empty">결제 정보를 찾지 못했습니다.</div>'
      }
    </section>
  `);

  document.getElementById("payment-complete")?.addEventListener("click", completePayment);
}

async function completePayment() {
  try {
    await apiFetch(`/api/public/payments/${route.token}/complete`, { method: "POST" });
    state.payment.message = { kind: "info", text: "결제가 완료되어 예약이 확정됐습니다." };
    await loadPaymentPage();
    renderPaymentPage();
  } catch (error) {
    state.payment.message = { kind: "error", text: error.message };
    renderPaymentPage();
  }
}

async function loadAdminDashboard() {
  const dashboard = await apiFetch("/api/admin/dashboard", {}, state.admin.token);
  state.admin.dashboard = dashboard;
  const firstRestaurant = dashboard.restaurants[0];
  const firstSlot = dashboard.slots[0];
  if (firstRestaurant && !state.admin.tableForm.restaurant_id) {
    state.admin.tableForm.restaurant_id = String(firstRestaurant.id);
  }
  if (firstRestaurant && !state.admin.slotForm.restaurant_id) {
    state.admin.slotForm.restaurant_id = String(firstRestaurant.id);
  }
  if (firstSlot && !state.admin.openSlotForm.slot_id) {
    state.admin.openSlotForm.slot_id = String(firstSlot.slot_id);
  }
}

function renderAdminPage() {
  if (!state.admin.token) {
    root.innerHTML = layout(`
      <section class="panel" style="max-width:560px;margin:0 auto;">
        <h3>관리자 로그인</h3>
        <p>기본 토큰은 <strong>admin123</strong> 입니다.</p>
        ${messageHtml(state.admin.message)}
        <form id="admin-login-form">
          <div class="form-grid">
            <label class="field full">
              <span>Admin Token</span>
              <input id="admin-token-input" value="${escapeHtml(state.admin.token || "admin123")}" />
            </label>
          </div>
          <div class="button-row">
            <button class="btn primary" type="submit">로그인</button>
          </div>
        </form>
      </section>
    `);
    bindInput("admin-token-input", (value) => {
      state.admin.token = value;
    });
    document.getElementById("admin-login-form")?.addEventListener("submit", submitAdminLogin);
    return;
  }

  const dashboard = state.admin.dashboard;
  if (!dashboard) {
    root.innerHTML = layout(`<section class="panel"><div class="empty">대시보드를 불러오는 중입니다...</div></section>`);
    return;
  }

  root.innerHTML = layout(`
    <section class="panel">
      <div class="card-head">
        <div>
          <p class="eyebrow">Admin Dashboard</p>
          <h3>예약 엔진 운영 화면</h3>
        </div>
        <div class="button-row">
          <button id="run-engine" class="btn secondary">만료 검사 실행</button>
          <button id="admin-logout" class="btn ghost">로그아웃</button>
        </div>
      </div>
      ${messageHtml(state.admin.message)}
      <div class="stats-row">
        <div class="stat"><strong>${dashboard.restaurants.length}</strong><span>Restaurants</span></div>
        <div class="stat"><strong>${dashboard.slots.length}</strong><span>Slots</span></div>
        <div class="stat"><strong>${dashboard.waitlists.length}</strong><span>Waitlists</span></div>
        <div class="stat"><strong>${dashboard.logs.length}</strong><span>Notification Logs</span></div>
      </div>
      <div class="grid three">
        <form id="restaurant-form" class="mini-card">
          <h4>식당 추가</h4>
          <div class="form-grid">
            <label class="field full">
              <span>이름</span>
              <input id="restaurant-name" value="${escapeHtml(state.admin.restaurantForm.name)}" />
            </label>
            <label class="field full">
              <span>설명</span>
              <textarea id="restaurant-description">${escapeHtml(state.admin.restaurantForm.description)}</textarea>
            </label>
            <label class="field full">
              <span>연락 이메일</span>
              <input id="restaurant-email" type="email" value="${escapeHtml(
                state.admin.restaurantForm.contact_email,
              )}" />
            </label>
          </div>
          <div class="button-row"><button class="btn primary" type="submit">생성</button></div>
        </form>

        <form id="table-form" class="mini-card">
          <h4>테이블 추가</h4>
          <div class="form-grid">
            <label class="field full">
              <span>식당</span>
              <select id="table-restaurant-id">
                ${dashboard.restaurants
                  .map(
                    (restaurant) => `
                      <option value="${escapeHtml(restaurant.id)}" ${
                        String(restaurant.id) === state.admin.tableForm.restaurant_id ? "selected" : ""
                      }>
                        ${escapeHtml(restaurant.name)}
                      </option>
                    `,
                  )
                  .join("")}
              </select>
            </label>
            <label class="field">
              <span>이름</span>
              <input id="table-name" value="${escapeHtml(state.admin.tableForm.name)}" />
            </label>
            <label class="field">
              <span>좌석 수</span>
              <input id="table-capacity" type="number" min="1" max="20" value="${escapeHtml(
                state.admin.tableForm.capacity,
              )}" />
            </label>
            <label class="field full">
              <span>조합 그룹</span>
              <input id="table-group" value="${escapeHtml(
                state.admin.tableForm.combinable_group,
              )}" placeholder="예: hall" />
            </label>
          </div>
          <div class="button-row"><button class="btn primary" type="submit">추가</button></div>
        </form>

        <form id="slot-form" class="mini-card">
          <h4>슬롯 추가</h4>
          <div class="form-grid">
            <label class="field full">
              <span>식당</span>
              <select id="slot-restaurant-id">
                ${dashboard.restaurants
                  .map(
                    (restaurant) => `
                      <option value="${escapeHtml(restaurant.id)}" ${
                        String(restaurant.id) === state.admin.slotForm.restaurant_id ? "selected" : ""
                      }>
                        ${escapeHtml(restaurant.name)}
                      </option>
                    `,
                  )
                  .join("")}
              </select>
            </label>
            <label class="field">
              <span>날짜</span>
              <input id="slot-day" type="date" value="${escapeHtml(state.admin.slotForm.day)}" />
            </label>
            <label class="field">
              <span>시간</span>
              <input id="slot-time" type="time" value="${escapeHtml(state.admin.slotForm.time)}" />
            </label>
          </div>
          <div class="button-row"><button class="btn primary" type="submit">슬롯 생성</button></div>
        </form>
      </div>
    </section>

    <section class="grid two" style="margin-top:18px;">
      <div class="panel">
        <p class="eyebrow">Open Slots</p>
        <h3>취소분 직접 열기</h3>
        <form id="open-slot-form">
          <div class="form-grid">
            <label class="field">
              <span>슬롯</span>
              <select id="open-slot-id">
                ${dashboard.slots
                  .map(
                    (slot) => `
                      <option value="${escapeHtml(slot.slot_id)}" ${
                        String(slot.slot_id) === state.admin.openSlotForm.slot_id ? "selected" : ""
                      }>
                        ${escapeHtml(slot.restaurant_name)} / ${escapeHtml(slot.day)} ${escapeHtml(slot.time)}
                      </option>
                    `,
                  )
                  .join("")}
              </select>
            </label>
            <label class="field">
              <span>허용 인원</span>
              <input id="open-slot-cap" type="number" min="1" max="20" value="${escapeHtml(
                state.admin.openSlotForm.party_size_cap,
              )}" />
            </label>
          </div>
          <div class="button-row"><button class="btn primary" type="submit">오픈 슬롯 생성</button></div>
        </form>
        <div class="cards" style="margin-top:18px;">
          ${
            dashboard.tables.length
              ? dashboard.tables
                  .map(
                    (table) => `
                      <div class="mini-card">
                        <div class="card-head">
                          <strong>${escapeHtml(table.name)}</strong>
                          <span class="pill">${escapeHtml(table.capacity)} seats</span>
                        </div>
                        <div class="muted">
                          ${escapeHtml(
                            dashboard.restaurants.find((item) => item.id === table.restaurant_id)?.name || "-",
                          )}
                          ${table.combinable_group ? ` / group ${escapeHtml(table.combinable_group)}` : ""}
                        </div>
                      </div>
                    `,
                  )
                  .join("")
              : '<div class="empty">테이블이 아직 없습니다.</div>'
          }
        </div>
      </div>

      <div class="panel">
        <p class="eyebrow">Waitlist</p>
        <h3>대기 요청 현황</h3>
        ${
          dashboard.waitlists.length
            ? `
              <div class="list-card">
                <table class="list-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>손님</th>
                      <th>연락처</th>
                      <th>요청</th>
                      <th>상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${dashboard.waitlists
                      .map(
                        (item) => `
                          <tr>
                            <td>#${escapeHtml(item.id)}</td>
                            <td>
                              <strong>${escapeHtml(item.guest_name)}</strong>
                              <div class="muted">${escapeHtml(item.guest_email)}</div>
                            </td>
                            <td>${escapeHtml(item.phone_number || "-")}</td>
                            <td>
                              ${escapeHtml(item.restaurant_name)}<br />
                              ${escapeHtml(item.day)} ${escapeHtml(item.time_start)}-${escapeHtml(item.time_end)} / ${escapeHtml(
                                item.party_size,
                              )}명
                            </td>
                            <td>${statusHtml(item.status)}</td>
                          </tr>
                        `,
                      )
                      .join("")}
                  </tbody>
                </table>
              </div>
            `
            : '<div class="empty">대기 요청이 없습니다.</div>'
        }
      </div>
    </section>

    <section class="panel" style="margin-top:18px;">
      <p class="eyebrow">Slots & Reservations</p>
      <h3>시간대별 운영 현황</h3>
      <div class="cards">
        ${dashboard.slots
          .map(
            (slot) => `
              <div class="slot-card">
                <div class="slot-head">
                  <div>
                    <p class="eyebrow">${escapeHtml(slot.restaurant_name)}</p>
                    <h4>${escapeHtml(slot.day)} ${escapeHtml(slot.time)}</h4>
                  </div>
                  <div class="button-row">
                    ${
                      slot.open_slot
                        ? `
                          <span class="pill">Open slot ${escapeHtml(slot.open_slot.party_size_cap)}명</span>
                          <button class="btn secondary small" data-dispatch-open-slot-id="${escapeHtml(
                            slot.open_slot.id,
                          )}" type="button">대기 알림 발송</button>
                        `
                        : '<span class="pill">Open slot 없음</span>'
                    }
                  </div>
                </div>
                ${
                  slot.reservations.length
                    ? `
                      <table class="list-table">
                        <thead>
                          <tr>
                            <th>ID</th>
                            <th>손님</th>
                            <th>연락처</th>
                            <th>상태</th>
                            <th>테이블</th>
                            <th>액션</th>
                          </tr>
                        </thead>
                        <tbody>
                          ${slot.reservations
                            .map(
                              (reservation) => `
                                <tr>
                                  <td>#${escapeHtml(reservation.id)}</td>
                                  <td>
                                    <strong>${escapeHtml(reservation.guest_name)}</strong>
                                    <div class="muted">${escapeHtml(reservation.guest_email)} / ${escapeHtml(
                                      reservation.party_size,
                                    )}명</div>
                                  </td>
                                  <td>${escapeHtml(reservation.phone_number || "-")}</td>
                                  <td>
                                    ${statusHtml(reservation.status)}
                                    ${
                                      reservation.payment_status
                                        ? `<div style="margin-top:6px;">${statusHtml(
                                            reservation.payment_status,
                                          )}</div>`
                                        : ""
                                    }
                                  </td>
                                  <td>${escapeHtml((reservation.tables || []).join(", ") || "-")}</td>
                                  <td>
                                    <button class="btn ghost small" data-cancel-reservation-id="${escapeHtml(
                                      reservation.id,
                                    )}" type="button">예약 취소</button>
                                  </td>
                                </tr>
                              `,
                            )
                            .join("")}
                        </tbody>
                      </table>
                    `
                    : '<div class="empty">예약이 아직 없습니다.</div>'
                }
              </div>
            `,
          )
          .join("")}
      </div>
    </section>

    <section class="panel" style="margin-top:18px;">
      <p class="eyebrow">Notification Logs</p>
      <h3>알림 기록</h3>
      ${
        dashboard.logs.length
          ? `
            <div class="list-card">
              <table class="list-table">
                <thead>
                  <tr>
                    <th>시각</th>
                    <th>대기 ID</th>
                    <th>결과</th>
                    <th>상세</th>
                  </tr>
                </thead>
                <tbody>
                  ${dashboard.logs
                    .map(
                      (log) => `
                        <tr>
                          <td>${escapeHtml(log.sent_at.replace("T", " ").slice(0, 16))}</td>
                          <td>#${escapeHtml(log.waitlist_id)}</td>
                          <td>${statusHtml(log.result)}</td>
                          <td>${escapeHtml(log.detail)}</td>
                        </tr>
                      `,
                    )
                    .join("")}
                </tbody>
              </table>
            </div>
          `
          : '<div class="empty">아직 알림 기록이 없습니다.</div>'
      }
    </section>
  `);

  bindAdminEvents();
}

function bindAdminEvents() {
  bindInput("restaurant-name", (value) => {
    state.admin.restaurantForm.name = value;
  });
  bindInput("restaurant-description", (value) => {
    state.admin.restaurantForm.description = value;
  });
  bindInput("restaurant-email", (value) => {
    state.admin.restaurantForm.contact_email = value;
  });
  bindInput("table-restaurant-id", (value) => {
    state.admin.tableForm.restaurant_id = value;
  });
  bindInput("table-name", (value) => {
    state.admin.tableForm.name = value;
  });
  bindInput("table-capacity", (value) => {
    state.admin.tableForm.capacity = value;
  });
  bindInput("table-group", (value) => {
    state.admin.tableForm.combinable_group = value;
  });
  bindInput("slot-restaurant-id", (value) => {
    state.admin.slotForm.restaurant_id = value;
  });
  bindInput("slot-day", (value) => {
    state.admin.slotForm.day = value;
  });
  bindInput("slot-time", (value) => {
    state.admin.slotForm.time = value;
  });
  bindInput("open-slot-id", (value) => {
    state.admin.openSlotForm.slot_id = value;
  });
  bindInput("open-slot-cap", (value) => {
    state.admin.openSlotForm.party_size_cap = value;
  });

  document.getElementById("restaurant-form")?.addEventListener("submit", createRestaurant);
  document.getElementById("table-form")?.addEventListener("submit", createTable);
  document.getElementById("slot-form")?.addEventListener("submit", createSlot);
  document.getElementById("open-slot-form")?.addEventListener("submit", createOpenSlot);
  document.getElementById("run-engine")?.addEventListener("click", runEngine);
  document.getElementById("admin-logout")?.addEventListener("click", logoutAdmin);

  document.querySelectorAll("[data-cancel-reservation-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      await cancelReservation(button.dataset.cancelReservationId);
    });
  });
  document.querySelectorAll("[data-dispatch-open-slot-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      await dispatchOpenSlot(button.dataset.dispatchOpenSlotId);
    });
  });
}

async function submitAdminLogin(event) {
  event.preventDefault();
  try {
    await apiFetch("/api/admin/session", {
      method: "POST",
      body: JSON.stringify({ token: state.admin.token }),
    });
    localStorage.setItem(ADMIN_KEY, state.admin.token);
    state.admin.message = null;
    await loadAdminDashboard();
  } catch (error) {
    state.admin.message = { kind: "error", text: error.message };
  }
  renderAdminPage();
}

async function createRestaurant(event) {
  event.preventDefault();
  try {
    await apiFetch(
      "/api/admin/restaurants",
      {
        method: "POST",
        body: JSON.stringify(state.admin.restaurantForm),
      },
      state.admin.token,
    );
    state.admin.restaurantForm = { name: "", description: "", contact_email: "" };
    state.admin.message = { kind: "info", text: "식당이 추가됐습니다." };
    await loadAdminDashboard();
  } catch (error) {
    state.admin.message = { kind: "error", text: error.message };
  }
  renderAdminPage();
}

async function createTable(event) {
  event.preventDefault();
  try {
    await apiFetch(
      `/api/admin/restaurants/${state.admin.tableForm.restaurant_id}/tables`,
      {
        method: "POST",
        body: JSON.stringify({
          name: state.admin.tableForm.name,
          capacity: Number(state.admin.tableForm.capacity),
          combinable_group: state.admin.tableForm.combinable_group || null,
        }),
      },
      state.admin.token,
    );
    state.admin.tableForm.name = "";
    state.admin.tableForm.capacity = "2";
    state.admin.tableForm.combinable_group = "";
    state.admin.message = { kind: "info", text: "테이블이 추가됐습니다." };
    await loadAdminDashboard();
  } catch (error) {
    state.admin.message = { kind: "error", text: error.message };
  }
  renderAdminPage();
}

async function createSlot(event) {
  event.preventDefault();
  try {
    await apiFetch(
      `/api/admin/restaurants/${state.admin.slotForm.restaurant_id}/slots`,
      {
        method: "POST",
        body: JSON.stringify({
          day: state.admin.slotForm.day,
          time: `${state.admin.slotForm.time}:00`,
          is_open: true,
        }),
      },
      state.admin.token,
    );
    state.admin.message = { kind: "info", text: "슬롯이 생성됐습니다." };
    await loadAdminDashboard();
  } catch (error) {
    state.admin.message = { kind: "error", text: error.message };
  }
  renderAdminPage();
}

async function createOpenSlot(event) {
  event.preventDefault();
  try {
    await apiFetch(
      "/api/admin/open-slots",
      {
        method: "POST",
        body: JSON.stringify({
          slot_id: Number(state.admin.openSlotForm.slot_id),
          party_size_cap: Number(state.admin.openSlotForm.party_size_cap),
        }),
      },
      state.admin.token,
    );
    state.admin.message = { kind: "info", text: "오픈 슬롯이 생성됐습니다." };
    await loadAdminDashboard();
  } catch (error) {
    state.admin.message = { kind: "error", text: error.message };
  }
  renderAdminPage();
}

async function cancelReservation(reservationId) {
  try {
    await apiFetch(
      `/api/admin/reservations/${reservationId}/cancel`,
      { method: "POST" },
      state.admin.token,
    );
    state.admin.message = {
      kind: "info",
      text: `예약 #${reservationId} 이 취소되고 대기열 디스패치가 실행됐습니다.`,
    };
    await loadAdminDashboard();
  } catch (error) {
    state.admin.message = { kind: "error", text: error.message };
  }
  renderAdminPage();
}

async function dispatchOpenSlot(openSlotId) {
  try {
    await apiFetch(
      `/api/admin/open-slots/${openSlotId}/dispatch`,
      { method: "POST" },
      state.admin.token,
    );
    state.admin.message = { kind: "info", text: "대기자 알림을 발송했습니다." };
    await loadAdminDashboard();
  } catch (error) {
    state.admin.message = { kind: "error", text: error.message };
  }
  renderAdminPage();
}

async function runEngine() {
  try {
    await apiFetch("/api/admin/engine/run", { method: "POST" }, state.admin.token);
    state.admin.message = { kind: "info", text: "만료 검사와 대기열 에스컬레이션을 실행했습니다." };
    await loadAdminDashboard();
  } catch (error) {
    state.admin.message = { kind: "error", text: error.message };
  }
  renderAdminPage();
}

function logoutAdmin() {
  localStorage.removeItem(ADMIN_KEY);
  state.admin.token = "";
  state.admin.dashboard = null;
  state.admin.message = null;
  renderAdminPage();
}

function bindInput(id, onChange) {
  document.getElementById(id)?.addEventListener("input", (event) => {
    onChange(event.target.value);
  });
  document.getElementById(id)?.addEventListener("change", (event) => {
    onChange(event.target.value);
  });
}

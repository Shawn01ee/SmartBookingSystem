import { useEffect, useState } from "react";

const ADMIN_KEY = "smart-booking-admin-token";

function getRoute(pathname = window.location.pathname) {
  if (pathname.startsWith("/admin")) {
    return { name: "admin" };
  }
  if (pathname.startsWith("/claim/")) {
    return { name: "claim", token: pathname.split("/").pop() };
  }
  if (pathname.startsWith("/pay/")) {
    return { name: "pay", token: pathname.split("/").pop() };
  }
  return { name: "guest" };
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
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
      // Ignore invalid JSON payloads.
    }
    throw new Error(detail);
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return null;
}

function Message({ message }) {
  if (!message) {
    return null;
  }
  return <div className={`message ${message.kind}`}>{message.text}</div>;
}

function StatusBadge({ status }) {
  const safe = status || "unknown";
  return <span className={`status ${safe}`}>{safe}</span>;
}

function Layout({ children }) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">SB</div>
          <div className="brand-copy">
            <h1>Smart Booking System</h1>
            <p>취소, 대기, 결제까지 연결된 식당 예약 엔진</p>
          </div>
        </div>
        <nav className="nav-links">
          <a href="/">Guest</a>
          <a href="/admin">Admin</a>
        </nav>
      </header>
      {children}
    </div>
  );
}

function VerificationBox({
  prefix,
  email,
  verificationState,
  onCodeChange,
  onRequestCode,
  onConfirmCode,
}) {
  const verified = normalizeEmail(email) && verificationState.verifiedEmail === normalizeEmail(email);

  return (
    <div className="mini-card">
      <div className="card-head">
        <strong>이메일 인증</strong>
        {verified ? (
          <span className="status verified">인증 완료</span>
        ) : (
          <span className="status pending">인증 필요</span>
        )}
      </div>
      <Message message={verificationState.message} />
      <div className="form-grid">
        <label className="field">
          <span>인증번호</span>
          <input
            id={`${prefix}-verification-code`}
            value={verificationState.code}
            onChange={(event) => onCodeChange(event.target.value)}
            placeholder="6자리 코드"
          />
        </label>
        <div className="field">
          <span>메일 발송 / 확인</span>
          <div className="button-row">
            <button className="btn secondary small" type="button" onClick={onRequestCode}>
              코드 보내기
            </button>
            <button className="btn primary small" type="button" onClick={onConfirmCode}>
              코드 확인
            </button>
          </div>
        </div>
      </div>
      <p className="muted verification-note">예약과 대기 등록 전, 현재 입력한 이메일로 인증을 완료해야 합니다.</p>
    </div>
  );
}

function GuestPage() {
  const [restaurants, setRestaurants] = useState([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState("");
  const [slots, setSlots] = useState([]);
  const [message, setMessage] = useState(null);
  const [waitMessage, setWaitMessage] = useState(null);
  const [reservationVerification, setReservationVerification] = useState({
    code: "",
    verifiedEmail: "",
    message: null,
  });
  const [waitlistVerification, setWaitlistVerification] = useState({
    code: "",
    verifiedEmail: "",
    message: null,
  });
  const [reservationForm, setReservationForm] = useState({
    slot_id: "",
    party_size: "2",
    guest_name: "",
    guest_email: "",
    phone_number: "",
  });
  const [waitlistForm, setWaitlistForm] = useState({
    day: "",
    time_start: "18:00",
    time_end: "20:00",
    party_size: "2",
    guest_name: "",
    guest_email: "",
    phone_number: "",
    notes: "",
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function loadRestaurants() {
      setLoading(true);
      try {
        const data = await apiFetch("/api/public/restaurants");
        if (!active) {
          return;
        }
        setRestaurants(data);
        setSelectedRestaurantId((current) => current || String(data[0]?.id || ""));
      } catch (error) {
        if (active) {
          setMessage({ kind: "error", text: error.message });
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadRestaurants();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedRestaurantId) {
      setSlots([]);
      return;
    }

    let active = true;
    async function loadSlots() {
      try {
        const data = await apiFetch(`/api/public/restaurants/${selectedRestaurantId}/slots`);
        if (!active) {
          return;
        }
        setSlots(data);
        setReservationForm((current) => ({
          ...current,
          slot_id:
            data.some((slot) => String(slot.id) === String(current.slot_id))
              ? current.slot_id
              : String(data[0]?.id || ""),
        }));
        setWaitlistForm((current) => ({
          ...current,
          day: current.day || data[0]?.day || "",
        }));
      } catch (error) {
        if (active) {
          setMessage({ kind: "error", text: error.message });
        }
      }
    }

    loadSlots();
    return () => {
      active = false;
    };
  }, [selectedRestaurantId]);

  const selectedRestaurant = restaurants.find(
    (restaurant) => String(restaurant.id) === String(selectedRestaurantId),
  );

  const slotGroups = groupedSlots(slots);

  async function requestEmailVerification(email, setter) {
    const normalized = normalizeEmail(email);
    if (!normalized) {
      setter((current) => ({ ...current, message: { kind: "error", text: "이메일을 먼저 입력해 주세요." } }));
      return;
    }

    setter((current) => ({ ...current, message: null }));
    try {
      await apiFetch("/api/public/email-verifications/request", {
        method: "POST",
        body: JSON.stringify({ email: normalized }),
      });
      setter((current) => ({ ...current, message: { kind: "info", text: "인증번호를 이메일로 보냈습니다." } }));
    } catch (error) {
      setter((current) => ({ ...current, message: { kind: "error", text: error.message } }));
    }
  }

  async function confirmEmailVerification(email, verificationState, setter) {
    const normalized = normalizeEmail(email);
    if (!normalized) {
      setter((current) => ({ ...current, message: { kind: "error", text: "이메일을 먼저 입력해 주세요." } }));
      return;
    }
    if (!verificationState.code.trim()) {
      setter((current) => ({ ...current, message: { kind: "error", text: "인증번호를 입력해 주세요." } }));
      return;
    }

    setter((current) => ({ ...current, message: null }));
    try {
      await apiFetch("/api/public/email-verifications/confirm", {
        method: "POST",
        body: JSON.stringify({ email: normalized, code: verificationState.code.trim() }),
      });
      setter((current) => ({
        ...current,
        verifiedEmail: normalized,
        message: { kind: "info", text: "이메일 인증이 완료되었습니다." },
      }));
    } catch (error) {
      setter((current) => ({ ...current, message: { kind: "error", text: error.message } }));
    }
  }

  function updateReservationField(field, value) {
    setReservationForm((current) => {
      const next = { ...current, [field]: value };
      if (field === "guest_email" && reservationVerification.verifiedEmail) {
        const normalized = normalizeEmail(value);
        if (reservationVerification.verifiedEmail !== normalized) {
          setReservationVerification({ code: "", verifiedEmail: "", message: null });
        }
      }
      return next;
    });
  }

  function updateWaitlistField(field, value) {
    setWaitlistForm((current) => {
      const next = { ...current, [field]: value };
      if (field === "guest_email" && waitlistVerification.verifiedEmail) {
        const normalized = normalizeEmail(value);
        if (waitlistVerification.verifiedEmail !== normalized) {
          setWaitlistVerification({ code: "", verifiedEmail: "", message: null });
        }
      }
      return next;
    });
  }

  async function submitReservation(event) {
    event.preventDefault();
    setMessage(null);
    if (reservationVerification.verifiedEmail !== normalizeEmail(reservationForm.guest_email)) {
      setMessage({ kind: "error", text: "예약 전에 이메일 인증을 완료해 주세요." });
      return;
    }

    try {
      const result = await apiFetch(
        `/api/public/restaurants/${selectedRestaurantId}/reservations`,
        {
          method: "POST",
          body: JSON.stringify({
            slot_id: Number(reservationForm.slot_id),
            party_size: Number(reservationForm.party_size),
            guest_name: reservationForm.guest_name,
            guest_email: reservationForm.guest_email,
            phone_number: reservationForm.phone_number,
          }),
        },
      );

      if (!result.ok && result.status === "waitlist_recommended") {
        setMessage({
          kind: "info",
          text: "해당 슬롯은 이미 만석입니다. 아래 대기 등록으로 이어가면 취소 발생 시 순차 알림을 받을 수 있어요.",
        });
        return;
      }

      window.location.href = `/pay/${result.payment_token}`;
    } catch (error) {
      setMessage({ kind: "error", text: error.message });
    }
  }

  async function submitWaitlist(event) {
    event.preventDefault();
    setWaitMessage(null);
    if (waitlistVerification.verifiedEmail !== normalizeEmail(waitlistForm.guest_email)) {
      setWaitMessage({ kind: "error", text: "대기 신청 전에 이메일 인증을 완료해 주세요." });
      return;
    }

    try {
      const result = await apiFetch(
        `/api/public/restaurants/${selectedRestaurantId}/waitlist`,
        {
          method: "POST",
          body: JSON.stringify({
            day: waitlistForm.day,
            time_start: `${waitlistForm.time_start}:00`,
            time_end: `${waitlistForm.time_end}:00`,
            party_size: Number(waitlistForm.party_size),
            guest_name: waitlistForm.guest_name,
            guest_email: waitlistForm.guest_email,
            phone_number: waitlistForm.phone_number,
            notes: waitlistForm.notes,
          }),
        },
      );

      setWaitMessage({
        kind: "info",
        text: `대기 등록이 완료됐어요. 요청 번호는 #${result.waitlist_id} 입니다.`,
      });
    } catch (error) {
      setWaitMessage({ kind: "error", text: error.message });
    }
  }

  if (loading) {
    return (
      <Layout>
        <section className="panel">
          <div className="empty">불러오는 중입니다...</div>
        </section>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="hero">
        <div className="hero-card hero-main">
          <div className="pill">React + Vite UI</div>
          <h2>빈자리 생기면 자동으로 이어지는 식당 예약 경험</h2>
          <p>
            이 웹사이트는 식당이 직접 쓰는 자체 예약 시스템입니다. 테이블 단위 배정, 보증금 결제,
            취소 발생 시 대기자 순차 알림까지 하나의 흐름으로 연결돼 있어요.
          </p>
          <div className="hero-points">
            <div className="hero-point">
              <strong>테이블 배정</strong>
              <span>단일 테이블 우선, 없으면 조합으로 최적 배정</span>
            </div>
            <div className="hero-point">
              <strong>대기열 엔진</strong>
              <span>취소가 생기면 조건에 맞는 손님에게 순차 오퍼</span>
            </div>
            <div className="hero-point">
              <strong>클레임 + 결제</strong>
              <span>TTL 안에 수락과 보증금 결제가 끝나야 확정</span>
            </div>
          </div>
        </div>
        <aside className="hero-card hero-side">
          <h3>Demo 안내</h3>
          <ul>
            <li>기본 식당 Mosu Seoul과 샘플 슬롯이 자동 생성됩니다.</li>
            <li>SMTP가 없으면 이메일은 서버 콘솔에 출력됩니다.</li>
            <li>관리자 화면에서 예약 취소를 누르면 대기열 엔진이 바로 작동합니다.</li>
          </ul>
        </aside>
      </section>

      <div className="grid two">
        <section className="panel">
          <h3>손님 예약</h3>
          <p>원하는 슬롯을 선택하고 보증금 결제로 예약을 확정하세요.</p>
          <Message message={message} />
          <form onSubmit={submitReservation}>
            <div className="form-grid">
              <label className="field full">
                <span>식당</span>
                <select
                  value={selectedRestaurantId}
                  onChange={(event) => {
                    setSelectedRestaurantId(event.target.value);
                    setMessage(null);
                    setWaitMessage(null);
                    setReservationForm((current) => ({ ...current, slot_id: "" }));
                  }}
                >
                  {restaurants.map((restaurant) => (
                    <option key={restaurant.id} value={restaurant.id}>
                      {restaurant.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field full">
                <span>슬롯</span>
                <select
                  value={reservationForm.slot_id}
                  onChange={(event) => updateReservationField("slot_id", event.target.value)}
                >
                  {slots.map((slot) => (
                    <option key={slot.id} value={slot.id}>
                      {slot.day} {formatTime(slot.time)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>인원</span>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={reservationForm.party_size}
                  onChange={(event) => updateReservationField("party_size", event.target.value)}
                />
              </label>
              <label className="field">
                <span>이름</span>
                <input
                  value={reservationForm.guest_name}
                  onChange={(event) => updateReservationField("guest_name", event.target.value)}
                />
              </label>
              <label className="field">
                <span>휴대폰 번호</span>
                <input
                  value={reservationForm.phone_number}
                  onChange={(event) => updateReservationField("phone_number", event.target.value)}
                  placeholder="01012345678"
                />
              </label>
              <label className="field full">
                <span>이메일</span>
                <input
                  type="email"
                  value={reservationForm.guest_email}
                  onChange={(event) => updateReservationField("guest_email", event.target.value)}
                />
              </label>
              <div className="field full">
                <VerificationBox
                  prefix="reservation"
                  email={reservationForm.guest_email}
                  verificationState={reservationVerification}
                  onCodeChange={(value) =>
                    setReservationVerification((current) => ({ ...current, code: value }))
                  }
                  onRequestCode={() =>
                    requestEmailVerification(reservationForm.guest_email, setReservationVerification)
                  }
                  onConfirmCode={() =>
                    confirmEmailVerification(
                      reservationForm.guest_email,
                      reservationVerification,
                      setReservationVerification,
                    )
                  }
                />
              </div>
            </div>
            <div className="button-row">
              <button className="btn primary" type="submit">
                결제 단계로 이동
              </button>
            </div>
          </form>

          <div className="cards spacing-top">
            {slotGroups.length ? (
              slotGroups.map(([day, daySlots]) => (
                <div className="mini-card" key={day}>
                  <p className="eyebrow">{selectedRestaurant?.name || "Restaurant"}</p>
                  <div className="card-head">
                    <strong>{day}</strong>
                    <span className="muted">{daySlots.length} slots</span>
                  </div>
                  <div className="button-row">
                    {daySlots.map((slot) => (
                      <span className="pill" key={slot.id}>
                        {formatTime(slot.time)}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="empty">현재 공개된 슬롯이 없습니다.</div>
            )}
          </div>
        </section>

        <section className="panel">
          <h3>대기 등록</h3>
          <p>원하는 날짜와 시간 범위를 남겨두면 취소 발생 시 이메일 오퍼를 받을 수 있어요.</p>
          <Message message={waitMessage} />
          <form onSubmit={submitWaitlist}>
            <div className="form-grid">
              <label className="field full">
                <span>식당</span>
                <select
                  value={selectedRestaurantId}
                  onChange={(event) => {
                    setSelectedRestaurantId(event.target.value);
                    setMessage(null);
                    setWaitMessage(null);
                    setReservationForm((current) => ({ ...current, slot_id: "" }));
                  }}
                >
                  {restaurants.map((restaurant) => (
                    <option key={restaurant.id} value={restaurant.id}>
                      {restaurant.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>날짜</span>
                <input
                  type="date"
                  value={waitlistForm.day}
                  onChange={(event) => updateWaitlistField("day", event.target.value)}
                />
              </label>
              <label className="field">
                <span>인원</span>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={waitlistForm.party_size}
                  onChange={(event) => updateWaitlistField("party_size", event.target.value)}
                />
              </label>
              <label className="field">
                <span>희망 시작 시간</span>
                <input
                  type="time"
                  value={waitlistForm.time_start}
                  onChange={(event) => updateWaitlistField("time_start", event.target.value)}
                />
              </label>
              <label className="field">
                <span>희망 마감 시간</span>
                <input
                  type="time"
                  value={waitlistForm.time_end}
                  onChange={(event) => updateWaitlistField("time_end", event.target.value)}
                />
              </label>
              <label className="field">
                <span>이름</span>
                <input
                  value={waitlistForm.guest_name}
                  onChange={(event) => updateWaitlistField("guest_name", event.target.value)}
                />
              </label>
              <label className="field">
                <span>휴대폰 번호</span>
                <input
                  value={waitlistForm.phone_number}
                  onChange={(event) => updateWaitlistField("phone_number", event.target.value)}
                  placeholder="01012345678"
                />
              </label>
              <label className="field">
                <span>이메일</span>
                <input
                  type="email"
                  value={waitlistForm.guest_email}
                  onChange={(event) => updateWaitlistField("guest_email", event.target.value)}
                />
              </label>
              <div className="field full">
                <VerificationBox
                  prefix="waitlist"
                  email={waitlistForm.guest_email}
                  verificationState={waitlistVerification}
                  onCodeChange={(value) =>
                    setWaitlistVerification((current) => ({ ...current, code: value }))
                  }
                  onRequestCode={() =>
                    requestEmailVerification(waitlistForm.guest_email, setWaitlistVerification)
                  }
                  onConfirmCode={() =>
                    confirmEmailVerification(
                      waitlistForm.guest_email,
                      waitlistVerification,
                      setWaitlistVerification,
                    )
                  }
                />
              </div>
              <label className="field full">
                <span>메모</span>
                <textarea
                  value={waitlistForm.notes}
                  onChange={(event) => updateWaitlistField("notes", event.target.value)}
                  placeholder="예: 창가 선호, 10분 전후 가능"
                />
              </label>
            </div>
            <div className="button-row">
              <button className="btn primary" type="submit">
                대기열 등록
              </button>
            </div>
          </form>
        </section>
      </div>
    </Layout>
  );
}

function ClaimPage({ token }) {
  const [claim, setClaim] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function loadClaim() {
      setLoading(true);
      try {
        const data = await apiFetch(`/api/public/claims/${token}`);
        if (active) {
          setClaim(data);
        }
      } catch (error) {
        if (active) {
          setMessage({ kind: "error", text: error.message });
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadClaim();
    return () => {
      active = false;
    };
  }, [token]);

  async function acceptClaim() {
    setMessage(null);
    try {
      const result = await apiFetch(`/api/public/claims/${token}/accept`, { method: "POST" });
      window.location.href = `/pay/${result.payment_token}`;
    } catch (error) {
      setMessage({ kind: "error", text: error.message });
    }
  }

  return (
    <Layout>
      <section className="panel narrow-panel">
        <h3>대기 오퍼 수락</h3>
        <Message message={message} />
        {loading ? (
          <div className="empty">오퍼 정보를 불러오는 중입니다...</div>
        ) : claim ? (
          <>
            <p>오퍼를 수락하면 보증금 결제 단계로 이동하고, 결제가 끝나면 예약이 확정됩니다.</p>
            <div className="mini-card">
              <p className="eyebrow">{claim.restaurant_name}</p>
              <h4>
                {claim.day} {formatTime(claim.time)}
              </h4>
              <div className="button-row">
                <StatusBadge status={claim.status} />
                <span className="pill">{claim.party_size}명</span>
                <span className="pill">만료 {claim.expires_at.replace("T", " ").slice(0, 16)} UTC</span>
              </div>
            </div>
            <div className="button-row">
              {claim.status === "active" ? (
                <button className="btn primary" type="button" onClick={acceptClaim}>
                  오퍼 수락 후 결제
                </button>
              ) : (
                <a className="btn primary" href="/">
                  홈으로
                </a>
              )}
            </div>
          </>
        ) : (
          <div className="empty">오퍼 정보를 찾지 못했습니다.</div>
        )}
      </section>
    </Layout>
  );
}

function PaymentPage({ token }) {
  const [payment, setPayment] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function loadPayment() {
      setLoading(true);
      try {
        const data = await apiFetch(`/api/public/payments/${token}`);
        if (active) {
          setPayment(data);
        }
      } catch (error) {
        if (active) {
          setMessage({ kind: "error", text: error.message });
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadPayment();
    return () => {
      active = false;
    };
  }, [token]);

  async function completePayment() {
    setMessage(null);
    try {
      await apiFetch(`/api/public/payments/${token}/complete`, { method: "POST" });
      setMessage({ kind: "info", text: "결제가 완료되어 예약이 확정됐습니다." });
      const data = await apiFetch(`/api/public/payments/${token}`);
      setPayment(data);
    } catch (error) {
      setMessage({ kind: "error", text: error.message });
    }
  }

  return (
    <Layout>
      <section className="panel narrow-panel">
        <h3>보증금 결제</h3>
        <Message message={message} />
        {loading ? (
          <div className="empty">결제 정보를 불러오는 중입니다...</div>
        ) : payment ? (
          <>
            <div className="mini-card">
              <p className="eyebrow">Reservation #{payment.reservation_id}</p>
              <h4>{Number(payment.amount).toLocaleString()} KRW</h4>
              <div className="button-row">
                <StatusBadge status={payment.status} />
                <span className="pill">테이블 {(payment.tables || []).join(", ") || "-"}</span>
              </div>
              <p className="muted">
                결제 만료 시간: {payment.expires_at.replace("T", " ").slice(0, 16)} UTC
              </p>
            </div>
            <div className="button-row">
              {payment.status === "pending" ? (
                <button className="btn primary" type="button" onClick={completePayment}>
                  지금 결제하기
                </button>
              ) : (
                <a className="btn primary" href="/">
                  홈으로
                </a>
              )}
            </div>
          </>
        ) : (
          <div className="empty">결제 정보를 찾지 못했습니다.</div>
        )}
      </section>
    </Layout>
  );
}

function AdminPage() {
  const [token, setToken] = useState(() => window.localStorage.getItem(ADMIN_KEY) || "");
  const [dashboard, setDashboard] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [restaurantForm, setRestaurantForm] = useState({
    name: "",
    description: "",
    contact_email: "",
  });
  const [tableForm, setTableForm] = useState({
    restaurant_id: "",
    name: "",
    capacity: "2",
    combinable_group: "",
  });
  const [slotForm, setSlotForm] = useState({
    restaurant_id: "",
    day: "",
    time: "18:00",
  });
  const [openSlotForm, setOpenSlotForm] = useState({
    slot_id: "",
    party_size_cap: "2",
  });

  useEffect(() => {
    if (!token) {
      return;
    }

    let active = true;
    async function loadDashboard() {
      setLoading(true);
      try {
        const data = await apiFetch("/api/admin/dashboard", {}, token);
        if (!active) {
          return;
        }
        setDashboard(data);
        setTableForm((current) => ({
          ...current,
          restaurant_id: current.restaurant_id || String(data.restaurants[0]?.id || ""),
        }));
        setSlotForm((current) => ({
          ...current,
          restaurant_id: current.restaurant_id || String(data.restaurants[0]?.id || ""),
        }));
        setOpenSlotForm((current) => ({
          ...current,
          slot_id: current.slot_id || String(data.slots[0]?.slot_id || ""),
        }));
      } catch (error) {
        if (!active) {
          return;
        }
        setMessage({ kind: "error", text: error.message });
        if (error.message === "Invalid admin token") {
          window.localStorage.removeItem(ADMIN_KEY);
          setToken("");
          setDashboard(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadDashboard();
    return () => {
      active = false;
    };
  }, [token]);

  async function refreshDashboard(nextMessage = null) {
    if (!token) {
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch("/api/admin/dashboard", {}, token);
      setDashboard(data);
      if (nextMessage) {
        setMessage(nextMessage);
      }
    } catch (error) {
      setMessage({ kind: "error", text: error.message });
    } finally {
      setLoading(false);
    }
  }

  async function submitAdminLogin(event) {
    event.preventDefault();
    setMessage(null);
    try {
      await apiFetch("/api/admin/session", {
        method: "POST",
        body: JSON.stringify({ token }),
      });
      window.localStorage.setItem(ADMIN_KEY, token);
      await refreshDashboard({ kind: "info", text: "관리자 로그인에 성공했습니다." });
    } catch (error) {
      setMessage({ kind: "error", text: error.message });
    }
  }

  function logout() {
    window.localStorage.removeItem(ADMIN_KEY);
    setToken("");
    setDashboard(null);
    setMessage(null);
  }

  async function submitRestaurant(event) {
    event.preventDefault();
    try {
      await apiFetch(
        "/api/admin/restaurants",
        {
          method: "POST",
          body: JSON.stringify(restaurantForm),
        },
        token,
      );
      setRestaurantForm({ name: "", description: "", contact_email: "" });
      await refreshDashboard({ kind: "info", text: "식당을 추가했습니다." });
    } catch (error) {
      setMessage({ kind: "error", text: error.message });
    }
  }

  async function submitTable(event) {
    event.preventDefault();
    try {
      await apiFetch(
        `/api/admin/restaurants/${tableForm.restaurant_id}/tables`,
        {
          method: "POST",
          body: JSON.stringify({
            name: tableForm.name,
            capacity: Number(tableForm.capacity),
            combinable_group: tableForm.combinable_group || null,
          }),
        },
        token,
      );
      setTableForm((current) => ({
        ...current,
        name: "",
        capacity: "2",
        combinable_group: "",
      }));
      await refreshDashboard({ kind: "info", text: "테이블을 추가했습니다." });
    } catch (error) {
      setMessage({ kind: "error", text: error.message });
    }
  }

  async function submitSlot(event) {
    event.preventDefault();
    try {
      await apiFetch(
        `/api/admin/restaurants/${slotForm.restaurant_id}/slots`,
        {
          method: "POST",
          body: JSON.stringify({
            day: slotForm.day,
            time: `${slotForm.time}:00`,
            is_open: true,
          }),
        },
        token,
      );
      await refreshDashboard({ kind: "info", text: "슬롯을 생성했습니다." });
    } catch (error) {
      setMessage({ kind: "error", text: error.message });
    }
  }

  async function submitOpenSlot(event) {
    event.preventDefault();
    try {
      await apiFetch(
        "/api/admin/open-slots",
        {
          method: "POST",
          body: JSON.stringify({
            slot_id: Number(openSlotForm.slot_id),
            party_size_cap: Number(openSlotForm.party_size_cap),
          }),
        },
        token,
      );
      await refreshDashboard({ kind: "info", text: "오픈 슬롯을 만들었습니다." });
    } catch (error) {
      setMessage({ kind: "error", text: error.message });
    }
  }

  async function dispatchOpenSlot(openSlotId) {
    try {
      await apiFetch(`/api/admin/open-slots/${openSlotId}/dispatch`, { method: "POST" }, token);
      await refreshDashboard({ kind: "info", text: "대기열 오퍼를 발송했습니다." });
    } catch (error) {
      setMessage({ kind: "error", text: error.message });
    }
  }

  async function cancelReservation(reservationId) {
    try {
      await apiFetch(`/api/admin/reservations/${reservationId}/cancel`, { method: "POST" }, token);
      await refreshDashboard({ kind: "info", text: "예약을 취소하고 대기열을 재평가했습니다." });
    } catch (error) {
      setMessage({ kind: "error", text: error.message });
    }
  }

  async function runEngine() {
    try {
      const result = await apiFetch("/api/admin/engine/run", { method: "POST" }, token);
      await refreshDashboard({
        kind: "info",
        text: `만료 검사 완료: claim ${result.expired_claims}건, payment ${result.expired_payments}건`,
      });
    } catch (error) {
      setMessage({ kind: "error", text: error.message });
    }
  }

  if (!token) {
    return (
      <Layout>
        <section className="panel narrow-login">
          <h3>관리자 로그인</h3>
          <p>
            기본 토큰은 <strong>admin123</strong> 입니다.
          </p>
          <Message message={message} />
          <form onSubmit={submitAdminLogin}>
            <div className="form-grid">
              <label className="field full">
                <span>Admin Token</span>
                <input
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  placeholder="admin123"
                />
              </label>
            </div>
            <div className="button-row">
              <button className="btn primary" type="submit">
                로그인
              </button>
            </div>
          </form>
        </section>
      </Layout>
    );
  }

  if (loading && !dashboard) {
    return (
      <Layout>
        <section className="panel">
          <div className="empty">대시보드를 불러오는 중입니다...</div>
        </section>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="panel">
        <div className="card-head">
          <div>
            <p className="eyebrow">Admin Dashboard</p>
            <h3>예약 엔진 운영 화면</h3>
          </div>
          <div className="button-row">
            <button className="btn secondary" type="button" onClick={runEngine}>
              만료 검사 실행
            </button>
            <button className="btn ghost" type="button" onClick={logout}>
              로그아웃
            </button>
          </div>
        </div>
        <Message message={message} />
        {dashboard ? (
          <>
            <div className="stats-row">
              <div className="stat">
                <strong>{dashboard.restaurants.length}</strong>
                <span>Restaurants</span>
              </div>
              <div className="stat">
                <strong>{dashboard.slots.length}</strong>
                <span>Slots</span>
              </div>
              <div className="stat">
                <strong>{dashboard.waitlists.length}</strong>
                <span>Waitlists</span>
              </div>
              <div className="stat">
                <strong>{dashboard.logs.length}</strong>
                <span>Notification Logs</span>
              </div>
            </div>

            <div className="grid three">
              <form className="mini-card" onSubmit={submitRestaurant}>
                <h4>식당 추가</h4>
                <div className="form-grid">
                  <label className="field full">
                    <span>이름</span>
                    <input
                      value={restaurantForm.name}
                      onChange={(event) =>
                        setRestaurantForm((current) => ({ ...current, name: event.target.value }))
                      }
                    />
                  </label>
                  <label className="field full">
                    <span>설명</span>
                    <textarea
                      value={restaurantForm.description}
                      onChange={(event) =>
                        setRestaurantForm((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="field full">
                    <span>연락 이메일</span>
                    <input
                      type="email"
                      value={restaurantForm.contact_email}
                      onChange={(event) =>
                        setRestaurantForm((current) => ({
                          ...current,
                          contact_email: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
                <div className="button-row">
                  <button className="btn primary" type="submit">
                    생성
                  </button>
                </div>
              </form>

              <form className="mini-card" onSubmit={submitTable}>
                <h4>테이블 추가</h4>
                <div className="form-grid">
                  <label className="field full">
                    <span>식당</span>
                    <select
                      value={tableForm.restaurant_id}
                      onChange={(event) =>
                        setTableForm((current) => ({
                          ...current,
                          restaurant_id: event.target.value,
                        }))
                      }
                    >
                      {dashboard.restaurants.map((restaurant) => (
                        <option key={restaurant.id} value={restaurant.id}>
                          {restaurant.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>이름</span>
                    <input
                      value={tableForm.name}
                      onChange={(event) =>
                        setTableForm((current) => ({ ...current, name: event.target.value }))
                      }
                    />
                  </label>
                  <label className="field">
                    <span>좌석 수</span>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={tableForm.capacity}
                      onChange={(event) =>
                        setTableForm((current) => ({ ...current, capacity: event.target.value }))
                      }
                    />
                  </label>
                  <label className="field full">
                    <span>조합 그룹</span>
                    <input
                      value={tableForm.combinable_group}
                      onChange={(event) =>
                        setTableForm((current) => ({
                          ...current,
                          combinable_group: event.target.value,
                        }))
                      }
                      placeholder="예: hall"
                    />
                  </label>
                </div>
                <div className="button-row">
                  <button className="btn primary" type="submit">
                    추가
                  </button>
                </div>
              </form>

              <form className="mini-card" onSubmit={submitSlot}>
                <h4>슬롯 추가</h4>
                <div className="form-grid">
                  <label className="field full">
                    <span>식당</span>
                    <select
                      value={slotForm.restaurant_id}
                      onChange={(event) =>
                        setSlotForm((current) => ({
                          ...current,
                          restaurant_id: event.target.value,
                        }))
                      }
                    >
                      {dashboard.restaurants.map((restaurant) => (
                        <option key={restaurant.id} value={restaurant.id}>
                          {restaurant.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>날짜</span>
                    <input
                      type="date"
                      value={slotForm.day}
                      onChange={(event) =>
                        setSlotForm((current) => ({ ...current, day: event.target.value }))
                      }
                    />
                  </label>
                  <label className="field">
                    <span>시간</span>
                    <input
                      type="time"
                      value={slotForm.time}
                      onChange={(event) =>
                        setSlotForm((current) => ({ ...current, time: event.target.value }))
                      }
                    />
                  </label>
                </div>
                <div className="button-row">
                  <button className="btn primary" type="submit">
                    슬롯 생성
                  </button>
                </div>
              </form>
            </div>
          </>
        ) : null}
      </section>

      {dashboard ? (
        <>
          <section className="grid two spacing-top">
            <div className="panel">
              <p className="eyebrow">Open Slots</p>
              <h3>취소분 직접 열기</h3>
              <form onSubmit={submitOpenSlot}>
                <div className="form-grid">
                  <label className="field">
                    <span>슬롯</span>
                    <select
                      value={openSlotForm.slot_id}
                      onChange={(event) =>
                        setOpenSlotForm((current) => ({ ...current, slot_id: event.target.value }))
                      }
                    >
                      {dashboard.slots.map((slot) => (
                        <option key={slot.slot_id} value={slot.slot_id}>
                          {slot.restaurant_name} / {slot.day} {slot.time}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>허용 인원</span>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={openSlotForm.party_size_cap}
                      onChange={(event) =>
                        setOpenSlotForm((current) => ({
                          ...current,
                          party_size_cap: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
                <div className="button-row">
                  <button className="btn primary" type="submit">
                    오픈 슬롯 생성
                  </button>
                </div>
              </form>

              <div className="cards spacing-top">
                {dashboard.tables.length ? (
                  dashboard.tables.map((table) => {
                    const restaurant = dashboard.restaurants.find(
                      (item) => item.id === table.restaurant_id,
                    );
                    return (
                      <div className="mini-card" key={table.id}>
                        <div className="card-head">
                          <strong>{table.name}</strong>
                          <span className="pill">{table.capacity} seats</span>
                        </div>
                        <div className="muted">
                          {restaurant?.name || "-"}
                          {table.combinable_group ? ` / group ${table.combinable_group}` : ""}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="empty">테이블이 아직 없습니다.</div>
                )}
              </div>
            </div>

            <div className="panel">
              <p className="eyebrow">Waitlist</p>
              <h3>대기 요청 현황</h3>
              {dashboard.waitlists.length ? (
                <div className="list-card">
                  <table className="list-table">
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
                      {dashboard.waitlists.map((item) => (
                        <tr key={item.id}>
                          <td>#{item.id}</td>
                          <td>
                            <strong>{item.guest_name}</strong>
                            <div className="muted">{item.guest_email}</div>
                          </td>
                          <td>{item.phone_number || "-"}</td>
                          <td>
                            {item.restaurant_name}
                            <br />
                            {item.day} {item.time_start}-{item.time_end} / {item.party_size}명
                          </td>
                          <td>
                            <StatusBadge status={item.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty">대기 요청이 아직 없습니다.</div>
              )}
            </div>
          </section>

          <section className="panel spacing-top">
            <p className="eyebrow">Reservations</p>
            <h3>슬롯별 예약 현황</h3>
            <div className="cards">
              {dashboard.slots.length ? (
                dashboard.slots.map((slot) => (
                  <div className="slot-card" key={slot.slot_id}>
                    <div className="slot-head">
                      <div>
                        <p className="eyebrow">{slot.restaurant_name}</p>
                        <h4>
                          {slot.day} {slot.time}
                        </h4>
                      </div>
                      <div className="button-row">
                        <StatusBadge status={slot.is_open ? "open" : "closed"} />
                        {slot.open_slot ? (
                          <>
                            <span className="pill">{slot.open_slot.party_size_cap}명 오픈</span>
                            <button
                              className="btn secondary small"
                              type="button"
                              onClick={() => dispatchOpenSlot(slot.open_slot.id)}
                            >
                              대기열 발송
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>

                    {slot.reservations.length ? (
                      <div className="list-card">
                        <table className="list-table">
                          <thead>
                            <tr>
                              <th>ID</th>
                              <th>손님</th>
                              <th>인원</th>
                              <th>테이블</th>
                              <th>결제</th>
                              <th>상태</th>
                              <th>동작</th>
                            </tr>
                          </thead>
                          <tbody>
                            {slot.reservations.map((reservation) => (
                              <tr key={reservation.id}>
                                <td>#{reservation.id}</td>
                                <td>
                                  <strong>{reservation.guest_name}</strong>
                                  <div className="muted">{reservation.guest_email}</div>
                                  <div className="muted">{reservation.phone_number || "-"}</div>
                                </td>
                                <td>{reservation.party_size}명</td>
                                <td>{reservation.tables.join(", ") || "-"}</td>
                                <td>
                                  <StatusBadge status={reservation.payment_status || "none"} />
                                </td>
                                <td>
                                  <StatusBadge status={reservation.status} />
                                </td>
                                <td>
                                  <button
                                    className="btn ghost small"
                                    type="button"
                                    onClick={() => cancelReservation(reservation.id)}
                                  >
                                    취소
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="empty">아직 예약이 없습니다.</div>
                    )}
                  </div>
                ))
              ) : (
                <div className="empty">슬롯이 아직 없습니다.</div>
              )}
            </div>
          </section>

          <section className="panel spacing-top">
            <p className="eyebrow">Logs</p>
            <h3>알림 발송 로그</h3>
            {dashboard.logs.length ? (
              <div className="list-card">
                <table className="list-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Waitlist</th>
                      <th>Claim</th>
                      <th>채널</th>
                      <th>결과</th>
                      <th>시간</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.logs.map((log) => (
                      <tr key={log.id}>
                        <td>#{log.id}</td>
                        <td>{log.waitlist_id}</td>
                        <td>{log.claim_id || "-"}</td>
                        <td>{log.channel}</td>
                        <td>
                          <div>
                            <StatusBadge status={log.result} />
                          </div>
                          <div className="muted">{log.detail}</div>
                        </td>
                        <td>{log.sent_at.replace("T", " ").slice(0, 16)} UTC</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty">로그가 아직 없습니다.</div>
            )}
          </section>
        </>
      ) : null}
    </Layout>
  );
}

export default function App() {
  const route = getRoute();

  if (route.name === "admin") {
    return <AdminPage />;
  }

  if (route.name === "claim") {
    return <ClaimPage token={route.token} />;
  }

  if (route.name === "pay") {
    return <PaymentPage token={route.token} />;
  }

  return <GuestPage />;
}

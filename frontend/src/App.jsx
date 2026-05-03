import { useEffect, useRef, useState } from "react";

const ADMIN_KEY = "smart-booking-admin-token";
const DEPOSIT_PER_PERSON = 100000;
const DAY_KO = ["일", "월", "화", "수", "목", "금", "토"];
const COURSES = [
  { id: "lunch", name: "Lunch Tasting Course", desc: "점심 테이스팅 코스", price: 320000 },
  { id: "dinner", name: "Dinner Tasting Course", desc: "저녁 테이스팅 코스", price: 420000 },
];

function getRoute(pathname = window.location.pathname) {
  if (pathname.startsWith("/admin")) return { name: "admin" };
  if (pathname.startsWith("/claim/")) return { name: "claim", token: pathname.split("/").pop() };
  if (pathname.startsWith("/pay/")) return { name: "pay", token: pathname.split("/").pop() };
  return { name: "guest" };
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function formatTime(value) {
  return String(value || "").slice(0, 5);
}

function fmtDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}.${dd}(${DAY_KO[d.getDay()]})`;
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

function filterFutureSlots(slots) {
  const now = new Date();
  return slots.filter(slot => new Date(`${slot.day}T${slot.time}`) > now);
}

async function apiFetch(path, options = {}, adminToken = null) {
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && options.body && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (adminToken) headers.set("X-Admin-Token", adminToken);
  const response = await fetch(path, { ...options, headers });
  if (!response.ok) {
    let detail = `Request failed: ${response.status}`;
    try {
      const payload = await response.json();
      if (payload.detail) detail = payload.detail;
    } catch (_) {}
    throw new Error(detail);
  }
  const ct = response.headers.get("content-type") || "";
  if (ct.includes("application/json")) return response.json();
  return null;
}

function StatusBadge({ status }) {
  const s = status || "unknown";
  return <span className={`status-badge ${s}`}>{s}</span>;
}

// ── GUEST PAGE ──────────────────────────────────────────────
function GuestPage() {
  const [restaurants, setRestaurants] = useState([]);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState("");
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);

  // modal state
  const [modal, setModal] = useState(null); // null | 'booking' | 'guest' | 'deposit' | 'waitlist'
  const [step, setStep] = useState(1);

  // booking selections
  const [selDay, setSelDay] = useState(null);
  const [selSlotId, setSelSlotId] = useState(null);
  const [selParty, setSelParty] = useState(2);
  const [selCourse, setSelCourse] = useState(COURSES[1]); // default: Dinner

  // booked slots for the verified email
  const [bookedDays, setBookedDays] = useState([]);
  const [bookedSlotIds, setBookedSlotIds] = useState([]);

  // guest info
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [verCode, setVerCode] = useState("");
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [verMsg, setVerMsg] = useState(null);

  // success
  const [view, setView] = useState("hero"); // hero | success
  const [booking, setBooking] = useState(null);
  const [modalMsg, setModalMsg] = useState(null);

  // my reservations
  const [myEmail, setMyEmail] = useState("");
  const [myData, setMyData] = useState(null);
  const [myLoading, setMyLoading] = useState(false);
  const [myMsg, setMyMsg] = useState(null);

  // waitlist
  const [waitDay, setWaitDay] = useState("");
  const [waitTimeStart, setWaitTimeStart] = useState("18:00");
  const [waitTimeEnd, setWaitTimeEnd] = useState("20:00");
  const [waitParty, setWaitParty] = useState(2);
  const [waitName, setWaitName] = useState("");
  const [waitPhone, setWaitPhone] = useState("");
  const [waitEmail, setWaitEmail] = useState("");
  const [waitNotes, setWaitNotes] = useState("");
  const [waitVerCode, setWaitVerCode] = useState("");
  const [waitVerifiedEmail, setWaitVerifiedEmail] = useState("");
  const [waitVerMsg, setWaitVerMsg] = useState(null);
  const [waitMsg, setWaitMsg] = useState(null);

  const heroBgRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => { if (heroBgRef.current) heroBgRef.current.classList.add("loaded"); }, 100);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const data = await apiFetch("/api/public/restaurants");
        if (!active) return;
        setRestaurants(data);
        setSelectedRestaurantId(String(data[0]?.id || ""));
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selectedRestaurantId) { setSlots([]); return; }
    let active = true;
    apiFetch(`/api/public/restaurants/${selectedRestaurantId}/slots`).then(data => {
      if (!active) return;
      const future = filterFutureSlots(data);
      setSlots(future);
      if (future[0]) {
        setSelDay(future[0].day);
        setSelSlotId(future[0].id);
        setWaitDay(future[0].day);
      }
    }).catch(() => {});
    return () => { active = false; };
  }, [selectedRestaurantId]);

  const slotGroups = groupedSlots(slots);
  const timeSlotsForDay = slots.filter(s => s.day === selDay);
  const selectedSlot = slots.find(s => s.id === selSlotId);
  const selectedRestaurant = restaurants.find(r => String(r.id) === String(selectedRestaurantId));
  const deposit = selParty * DEPOSIT_PER_PERSON;

  const isLunchSlot = selectedSlot && (selectedSlot.time.startsWith("12") || selectedSlot.time.startsWith("13"));

  useEffect(() => {
    if (!selectedSlot) return;
    const lunch = selectedSlot.time.startsWith("12") || selectedSlot.time.startsWith("13");
    setSelCourse(COURSES[lunch ? 0 : 1]);
  }, [selSlotId]);

  function openBooking() {
    setStep(1); setModal("booking");
    setModalMsg(null); setVerMsg(null);
    if (slots[0]) { setSelDay(slots[0].day); setSelSlotId(slots[0].id); }
  }
  function openWaitlist() { setModal("waitlist"); setWaitMsg(null); setWaitVerMsg(null); }
  function closeModal() { setModal(null); setModalMsg(null); }

  async function requestCode(email, setMsg) {
    const n = normalizeEmail(email);
    if (!n) { setMsg({ kind: "error", text: "이메일을 입력해 주세요." }); return; }
    setMsg(null);
    try {
      await apiFetch("/api/public/email-verifications/request", {
        method: "POST", body: JSON.stringify({ email: n }),
      });
      setMsg({ kind: "info", text: "인증번호를 이메일로 보냈습니다." });
    } catch (e) { setMsg({ kind: "error", text: e.message }); }
  }

  async function confirmCode(email, code, setVerified, setMsg) {
    const n = normalizeEmail(email);
    if (!n) { setMsg({ kind: "error", text: "이메일을 입력해 주세요." }); return false; }
    if (!code.trim()) { setMsg({ kind: "error", text: "인증번호를 입력해 주세요." }); return false; }
    setMsg(null);
    try {
      await apiFetch("/api/public/email-verifications/confirm", {
        method: "POST", body: JSON.stringify({ email: n, code: code.trim() }),
      });
      setVerified(n);
      setMsg({ kind: "info", text: "인증이 완료되었습니다." });
      return true;
    } catch (e) { setMsg({ kind: "error", text: e.message }); return false; }
  }

  async function fetchBookedSlots(email) {
    try {
      const data = await apiFetch(`/api/public/reservations/booked-slots?email=${encodeURIComponent(email)}`);
      setBookedDays(data.booked_days || []);
      setBookedSlotIds(data.booked_slot_ids || []);
    } catch (_) {}
  }

  async function submitReservation() {
    setModalMsg(null);
    if (verifiedEmail !== normalizeEmail(guestEmail)) {
      setModalMsg({ kind: "error", text: "이메일 인증을 완료해 주세요." }); return;
    }
    try {
      const result = await apiFetch(
        `/api/public/restaurants/${selectedRestaurantId}/reservations`,
        { method: "POST", body: JSON.stringify({
          slot_id: Number(selSlotId),
          party_size: selParty,
          guest_name: guestName,
          guest_email: guestEmail,
          phone_number: guestPhone,
        })},
      );
      if (!result.ok && result.status === "waitlist_recommended") {
        setModalMsg(null);
        setModal("waitlist_auto");
        return;
      }
      // Complete payment in the same serverless instance to avoid DB reset on redirect
      await apiFetch(`/api/public/payments/${result.payment_token}/complete`, { method: "POST" });
      setBooking({
        restaurant: selectedRestaurant?.name,
        day: selDay,
        time: selectedSlot ? formatTime(selectedSlot.time) : "—",
        party: selParty,
        course: selCourse?.name,
        deposit: selParty * DEPOSIT_PER_PERSON,
        waitlist: false,
      });
      closeModal();
      setView("success");
    } catch (e) { setModalMsg({ kind: "error", text: e.message }); }
  }

  async function fetchMyReservations() {
    const n = normalizeEmail(myEmail);
    if (!n) { setMyMsg({ kind: "error", text: "이메일을 입력해 주세요." }); return; }
    setMyLoading(true); setMyMsg(null); setMyData(null);
    try {
      const data = await apiFetch(`/api/public/my-reservations?email=${encodeURIComponent(n)}`);
      setMyData(data);
      if (!data.reservations.length && !data.waitlists.length) {
        setMyMsg({ kind: "info", text: "해당 이메일로 등록된 예약 내역이 없습니다." });
      }
    } catch (e) { setMyMsg({ kind: "error", text: e.message }); }
    finally { setMyLoading(false); }
  }

  async function submitAutoWaitlist() {
    setModalMsg(null);
    try {
      const slotTime = selectedSlot?.time || "00:00:00";
      const result = await apiFetch(
        `/api/public/restaurants/${selectedRestaurantId}/waitlist`,
        { method: "POST", body: JSON.stringify({
          day: selDay,
          time_start: slotTime,
          time_end: slotTime,
          party_size: selParty,
          guest_name: guestName,
          guest_email: guestEmail,
          phone_number: guestPhone,
          notes: selCourse?.name || "",
        })},
      );
      setBooking({
        restaurant: selectedRestaurant?.name,
        day: selDay,
        time: selectedSlot ? formatTime(selectedSlot.time) : "—",
        party: selParty,
        course: selCourse?.name,
        waitlist: true,
        waitlistId: result.waitlist_id,
      });
      closeModal();
      setView("success");
    } catch (e) { setModalMsg({ kind: "error", text: e.message }); }
  }

  async function submitWaitlist() {
    setWaitMsg(null);
    if (waitVerifiedEmail !== normalizeEmail(waitEmail)) {
      setWaitMsg({ kind: "error", text: "이메일 인증을 완료해 주세요." }); return;
    }
    try {
      const result = await apiFetch(
        `/api/public/restaurants/${selectedRestaurantId}/waitlist`,
        { method: "POST", body: JSON.stringify({
          day: waitDay,
          time_start: `${waitTimeStart}:00`,
          time_end: `${waitTimeEnd}:00`,
          party_size: waitParty,
          guest_name: waitName,
          guest_email: waitEmail,
          phone_number: waitPhone,
          notes: waitNotes,
        })},
      );
      setWaitMsg({ kind: "info", text: `대기 등록 완료. 요청 번호 #${result.waitlist_id}` });
    } catch (e) { setWaitMsg({ kind: "error", text: e.message }); }
  }

  const STEP_LABELS = { booking: "01 — 날짜 및 인원", guest: "02 — 방문자 정보", deposit: "03 — 예약금 안내" };
  const STEP_TITLES = { booking: "예약 날짜 선택", guest: "방문자 정보 입력", deposit: "예약금 안내" };
  const STEP_NUM = { booking: 1, guest: 2, deposit: 3 };

  const isSelectedSlotBooked = bookedSlotIds.includes(selSlotId);
  const canStep1 = selSlotId && selParty && selCourse && !isSelectedSlotBooked;
  const canStep2 = guestName && guestPhone && verifiedEmail && verifiedEmail === normalizeEmail(guestEmail) && !isSelectedSlotBooked;

  if (loading) {
    return (
      <div className="screen active" style={{ background: "var(--ink)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: "'Cormorant SC', serif", letterSpacing: "0.3em", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>LOADING</span>
      </div>
    );
  }

  return (
    <>
      {/* HERO */}
      <div className={`screen ${view === "hero" ? "active" : "hidden"}`}>
        <div className="hero-bg" ref={heroBgRef} />
        <div className="hero-grain" />
        <div className="hero-vignette" />

        <nav className="hero-nav">
          <div className="hero-nav-col">
            {restaurants.map(r => (
              <button key={r.id} className="nav-link" onClick={() => { setSelectedRestaurantId(String(r.id)); openBooking(); }}>
                {r.name}
              </button>
            ))}
          </div>
          <div className="hero-nav-col right">
            <button className="nav-link" onClick={() => { setMyData(null); setMyMsg(null); setMyEmail(""); setModal("my_reservations"); }}>내 예약</button>
            <button className="nav-link" onClick={openBooking}>예약</button>
            <a className="nav-link" href="/admin">관리자</a>
          </div>
        </nav>

        <div className="hero-content">
          <div className="hero-eyebrow">FINE DINING RESERVATION PLATFORM</div>
          <div className="hero-title">
            Smart <em>Booking</em> System
          </div>
          <div className="hero-bottom">
            <div className="hero-desc">
              미슐랭 가이드 레스토랑을 위한<br />세련된 예약 경험. 당신의 특별한 저녁을 시작하세요.
            </div>
            <div className="hero-cta">
              <button className="btn-ghost-light" onClick={openBooking}>예약하기</button>
            </div>
          </div>
        </div>
      </div>

      {/* SUCCESS */}
      <div className={`screen success-screen ${view === "success" ? "active" : "hidden"}`}>
        <div className="success-ornament">
          <div className="success-ring"><span className="success-ring-inner">✦</span></div>
          <div className="success-badge">{booking?.waitlist ? "WAITLIST REGISTERED" : "RESERVATION CONFIRMED"}</div>
        </div>
        <div className="success-title">{booking?.waitlist ? "대기 등록 완료" : "예약 완료"}</div>
        <div className="success-sub">
          {booking?.waitlist
            ? "자리가 생기면 순서에 따라 이메일로 안내드립니다"
            : "소중한 식사 시간을 기대하겠습니다"}
        </div>
        {booking && (
          <div className="success-card">
            {(booking.waitlist ? [
              ["레스토랑", booking.restaurant],
              ["코스", booking.course],
              ["날짜", fmtDate(booking.day)],
              ["시간", booking.time],
              ["인원", `${booking.party}명`],
              ["대기 번호", `#${booking.waitlistId}`],
            ] : [
              ["레스토랑", booking.restaurant],
              ["코스", booking.course],
              ["날짜", fmtDate(booking.day)],
              ["시간", booking.time],
              ["인원", `${booking.party}명`],
              ["납부 보증금", `${booking.deposit?.toLocaleString()}원`],
            ]).filter(([, v]) => v).map(([l, v]) => (
              <div key={l} className="success-row">
                <span className="success-row-lbl">{l}</span>
                <span className="success-row-val">{v}</span>
              </div>
            ))}
          </div>
        )}
        <button className="success-back-btn" onClick={() => setView("hero")}>홈으로 돌아가기</button>
      </div>

      {/* BOOKING / WAITLIST MODAL */}
      <div className={`modal-backdrop ${modal ? "" : "hidden"}`} onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
        <div className="modal">

          {/* BOOKING STEPS */}
          {(modal === "booking" || modal === "guest" || modal === "deposit") && (
            <>
              <div className="modal-head">
                <button className="modal-close" onClick={closeModal}>×</button>
                <div className="modal-step-label">{STEP_LABELS[modal]}</div>
                <div className="modal-title">{STEP_TITLES[modal]}</div>
                <div className="modal-progress">
                  {[1, 2, 3].map(n => (
                    <div key={n} className={`modal-prog-seg ${STEP_NUM[modal] >= n ? "done" : ""}`} />
                  ))}
                </div>
              </div>

              <div className="modal-body">
                {/* STEP 1: slot + party */}
                {modal === "booking" && (
                  <>
                    {restaurants.length > 1 && (
                      <div style={{ marginBottom: 24 }}>
                        <span className="sel-label">식당</span>
                        <select className="luxury-select" value={selectedRestaurantId}
                          onChange={e => setSelectedRestaurantId(e.target.value)}>
                          {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                      </div>
                    )}

                    <span className="sel-label">날짜 선택</span>
                    <div className="slot-date-grid">
                      {slotGroups.map(([day]) => {
                        const isDayBooked = bookedDays.includes(day);
                        return (
                          <div key={day}
                            className={`date-chip ${selDay === day && !isDayBooked ? "sel" : ""} ${isDayBooked ? "booked" : ""}`}
                            onClick={() => {
                              if (isDayBooked) return;
                              setSelDay(day); setSelSlotId(slots.find(s => s.day === day)?.id || null);
                            }}>
                            <span className="dc-day">{fmtDate(day).slice(0, 5)}</span>
                            {day.slice(8)}
                            {isDayBooked && <span className="chip-booked-label">예약됨</span>}
                          </div>
                        );
                      })}
                    </div>

                    {selDay && (
                      <>
                        <span className="sel-label">시간 선택</span>
                        <div className="time-chips">
                          {timeSlotsForDay.map(slot => {
                            const isSlotBooked = bookedSlotIds.includes(slot.id);
                            return (
                              <div key={slot.id}
                                className={`time-chip ${selSlotId === slot.id && !isSlotBooked ? "sel" : ""} ${isSlotBooked ? "booked" : ""}`}
                                onClick={() => { if (!isSlotBooked) setSelSlotId(slot.id); }}>
                                {formatTime(slot.time)}
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}

                    <span className="sel-label">인원</span>
                    <div className="party-chips">
                      {[1, 2, 3, 4, 5, 6].map(n => (
                        <div key={n} className={`party-chip ${selParty === n ? "sel" : ""}`}
                          onClick={() => setSelParty(n)}>{n}명</div>
                      ))}
                    </div>

                    <span className="sel-label">코스 선택</span>
                    <div className="course-chips">
                      {COURSES.map(c => {
                        const allowed = isLunchSlot ? c.id === "lunch" : c.id === "dinner";
                        return (
                          <div key={c.id}
                            className={`course-chip ${selCourse?.id === c.id ? "sel" : ""} ${!allowed ? "disabled" : ""}`}
                            onClick={() => { if (allowed) setSelCourse(c); }}>
                            <div className="course-chip-header">
                              <div className="course-chip-name">{c.name}</div>
                              <div className="course-chip-price">{c.price.toLocaleString()}원</div>
                            </div>
                            <div className="course-chip-desc">{c.desc}</div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* STEP 2: guest info + email verification */}
                {modal === "guest" && (
                  <>
                    <div className="info-fields">
                      <div className="info-field">
                        <label>이름</label>
                        <input value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="홍길동" />
                      </div>
                      <div className="info-field">
                        <label>휴대폰 번호</label>
                        <input value={guestPhone} onChange={e => setGuestPhone(e.target.value)} placeholder="01012345678" />
                      </div>
                      <div className="info-field full">
                        <label>이메일</label>
                        <input type="email" value={guestEmail}
                          onChange={e => {
                            setGuestEmail(e.target.value);
                            if (verifiedEmail && verifiedEmail !== normalizeEmail(e.target.value)) {
                              setVerifiedEmail(""); setVerMsg(null);
                            }
                          }}
                          placeholder="name@example.com" />
                      </div>
                      <div className="info-field full">
                        <label>인증번호</label>
                        <div className="verify-row">
                          <div className="info-field" style={{ margin: 0 }}>
                            <input
                              id="reservation-verification-code"
                              value={verCode} onChange={e => setVerCode(e.target.value)}
                              placeholder="6자리 코드" />
                          </div>
                          <button className="verify-btn" type="button"
                            id="reservation-send-code"
                            onClick={() => requestCode(guestEmail, setVerMsg)}>코드 보내기</button>
                          <button className="verify-btn" type="button"
                            id="reservation-verify-code"
                            onClick={async () => {
                              const ok = await confirmCode(guestEmail, verCode, setVerifiedEmail, setVerMsg);
                              if (ok) fetchBookedSlots(normalizeEmail(guestEmail));
                            }}>코드 확인</button>
                        </div>
                        {verMsg && <div className={`verify-msg ${verMsg.kind}`}>{verMsg.text}</div>}
                        <div className={`verify-badge ${verifiedEmail && verifiedEmail === normalizeEmail(guestEmail) ? "done" : "pending"}`}
                          style={{ marginTop: 8, width: "fit-content" }}>
                          {verifiedEmail && verifiedEmail === normalizeEmail(guestEmail) ? "인증 완료" : "인증 필요"}
                        </div>
                      </div>
                    </div>
                    {isSelectedSlotBooked && (
                      <div className="verify-msg error" style={{ marginTop: 12 }}>
                        이 이메일로 이미 예약된 날짜/시간입니다. 이전 단계로 돌아가 다른 시간대를 선택해 주세요.
                      </div>
                    )}
                    {modalMsg && <div className={`verify-msg ${modalMsg.kind}`} style={{ marginTop: 16 }}>{modalMsg.text}</div>}
                  </>
                )}

                {/* STEP 3: deposit */}
                {modal === "deposit" && (
                  <>
                    <div className="confirm-card">
                      <div className="confirm-rest-name">{selectedRestaurant?.name}</div>
                      <div className="confirm-rest-sub">{selCourse?.name}</div>
                      <div className="confirm-details">
                        <div className="confirm-detail">
                          <div className="confirm-detail-icon">📅</div>
                          <div className="confirm-detail-val">{fmtDate(selDay)}</div>
                        </div>
                        <div className="confirm-detail">
                          <div className="confirm-detail-icon">🕐</div>
                          <div className="confirm-detail-val">{selectedSlot ? formatTime(selectedSlot.time) : "—"}</div>
                        </div>
                        <div className="confirm-detail">
                          <div className="confirm-detail-icon">👤</div>
                          <div className="confirm-detail-val">{selParty}명</div>
                        </div>
                      </div>
                    </div>
                    <div className="deposit-notice">
                      <span>ℹ</span>
                      <span>예약 확정을 위한 보증금이 결제됩니다. 코스 요금은 현장에서 결제합니다.</span>
                    </div>
                    <table className="deposit-table">
                      <tbody>
                        <tr><td>선택 코스</td><td>{selCourse?.name}</td></tr>
                        <tr><td>코스 금액 (현장결제)</td><td>{selCourse?.price.toLocaleString()}원 / 인</td></tr>
                        <tr className="deposit-divider"><td colSpan="2"></td></tr>
                        <tr><td>1인당 예약 보증금</td><td>{DEPOSIT_PER_PERSON.toLocaleString()}원</td></tr>
                        <tr><td>× 총 예약 인원</td><td>{selParty}명</td></tr>
                        <tr className="deposit-total"><td>지금 결제 금액</td><td>{deposit.toLocaleString()}원</td></tr>
                      </tbody>
                    </table>
                    <div className="refund-box">
                      <strong>환불정책</strong>
                      · 노쇼 시: 환불 불가<br />
                      · 당일 취소: 환불 불가<br />
                      · 1일 전 취소: 50% 환불<br />
                      · 2일 전 이상: 100% 환불
                    </div>
                    {modalMsg && <div className={`verify-msg ${modalMsg.kind}`} style={{ marginTop: 16 }}>{modalMsg.text}</div>}
                  </>
                )}
              </div>

              <div className="modal-foot">
                {modal === "booking" && (
                  <>
                    <button className="modal-back-btn" onClick={closeModal}>닫기</button>
                    <button className="modal-next-btn" disabled={!canStep1} onClick={() => setModal("guest")}>다음</button>
                  </>
                )}
                {modal === "guest" && (
                  <>
                    <button className="modal-back-btn" onClick={() => setModal("booking")}>이전</button>
                    <button className="modal-next-btn" disabled={!canStep2} onClick={() => { setModalMsg(null); setModal("deposit"); }}>다음</button>
                  </>
                )}
                {modal === "deposit" && (
                  <>
                    <button className="modal-back-btn" onClick={() => setModal("guest")}>이전</button>
                    <button className="modal-next-btn gold" onClick={submitReservation}>결제하기</button>
                  </>
                )}
              </div>
            </>
          )}

          {/* MY RESERVATIONS MODAL */}
          {modal === "my_reservations" && (
            <>
              <div className="modal-head">
                <button className="modal-close" onClick={closeModal}>×</button>
                <div className="modal-step-label">— 예약 조회</div>
                <div className="modal-title">내 예약 확인</div>
              </div>
              <div className="modal-body">
                <div className="info-fields">
                  <div className="info-field full">
                    <label>이메일</label>
                    <div className="verify-row">
                      <div className="info-field" style={{ margin: 0, flex: 1 }}>
                        <input type="email" value={myEmail}
                          onChange={e => setMyEmail(e.target.value)}
                          onKeyDown={e => e.key === "Enter" && fetchMyReservations()}
                          placeholder="name@example.com" />
                      </div>
                      <button className="verify-btn" type="button"
                        onClick={fetchMyReservations} disabled={myLoading}>
                        {myLoading ? "조회 중…" : "조회"}
                      </button>
                    </div>
                  </div>
                </div>

                {myMsg && <div className={`verify-msg ${myMsg.kind}`} style={{ marginTop: 8 }}>{myMsg.text}</div>}

                {myData && (myData.reservations.length > 0 || myData.waitlists.length > 0) && (
                  <div style={{ marginTop: 24 }}>
                    {myData.reservations.length > 0 && (
                      <>
                        <div className="sel-label" style={{ marginBottom: 10 }}>예약 내역</div>
                        {myData.reservations.map(r => (
                          <div key={r.id} className="my-res-card">
                            <div className="my-res-top">
                              <span className="my-res-restaurant">{r.restaurant}</span>
                              <span className={`status-badge ${r.status}`}>
                                {r.status === "confirmed" ? "예약 확정" : "결제 대기"}
                              </span>
                            </div>
                            <div className="my-res-row">
                              <span>📅 {fmtDate(r.day)}</span>
                              <span>🕐 {r.time}</span>
                              <span>👤 {r.party_size}명</span>
                            </div>
                            {r.tables.length > 0 && (
                              <div className="my-res-sub">테이블 {r.tables.join(", ")}</div>
                            )}
                          </div>
                        ))}
                      </>
                    )}

                    {myData.waitlists.length > 0 && (
                      <>
                        <div className="sel-label" style={{ marginTop: 20, marginBottom: 10 }}>대기 내역</div>
                        {myData.waitlists.map(w => (
                          <div key={w.id} className="my-res-card waitlist">
                            <div className="my-res-top">
                              <span className="my-res-restaurant">{w.restaurant}</span>
                              <span className={`status-badge ${w.status === "offered" ? "open" : "pending"}`}>
                                {w.status === "offered" ? "오퍼 수신" : "대기 중"}
                              </span>
                            </div>
                            <div className="my-res-row">
                              <span>📅 {fmtDate(w.day)}</span>
                              <span>🕐 {w.time}</span>
                              <span>👤 {w.party_size}명</span>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
              <div className="modal-foot">
                <button className="modal-next-btn" style={{ width: "100%" }} onClick={closeModal}>닫기</button>
              </div>
            </>
          )}

          {/* AUTO WAITLIST STEP (만석 → 즉시 대기 등록) */}
          {modal === "waitlist_auto" && (
            <>
              <div className="modal-head">
                <button className="modal-close" onClick={closeModal}>×</button>
                <div className="modal-step-label">— 예약 대기</div>
                <div className="modal-title">만석 안내</div>
              </div>
              <div className="modal-body">
                <div className="confirm-card">
                  <div className="confirm-rest-name">{selectedRestaurant?.name}</div>
                  <div className="confirm-rest-sub">{selCourse?.name}</div>
                  <div className="confirm-details">
                    <div className="confirm-detail">
                      <div className="confirm-detail-icon">📅</div>
                      <div className="confirm-detail-val">{fmtDate(selDay)}</div>
                    </div>
                    <div className="confirm-detail">
                      <div className="confirm-detail-icon">🕐</div>
                      <div className="confirm-detail-val">{selectedSlot ? formatTime(selectedSlot.time) : "—"}</div>
                    </div>
                    <div className="confirm-detail">
                      <div className="confirm-detail-icon">👤</div>
                      <div className="confirm-detail-val">{selParty}명</div>
                    </div>
                  </div>
                </div>
                <div className="deposit-notice" style={{ marginTop: 20 }}>
                  <span>ℹ</span>
                  <span>선택하신 시간대가 현재 만석입니다. 대기열에 등록하시면 예약 취소 발생 시 순서에 따라 이메일로 안내드립니다.</span>
                </div>
                {modalMsg && <div className={`verify-msg ${modalMsg.kind}`} style={{ marginTop: 16 }}>{modalMsg.text}</div>}
              </div>
              <div className="modal-foot">
                <button className="modal-back-btn" onClick={() => { setModalMsg(null); setModal("booking"); }}>다른 시간 선택</button>
                <button className="modal-next-btn gold" onClick={submitAutoWaitlist}>대기열 등록</button>
              </div>
            </>
          )}

          {/* WAITLIST MODAL */}
          {modal === "waitlist" && (
            <>
              <div className="modal-head">
                <button className="modal-close" onClick={closeModal}>×</button>
                <div className="modal-step-label">대기 등록</div>
                <div className="modal-title">대기열에 등록하기</div>
              </div>
              <div className="modal-body">
                <div className="info-fields">
                  {restaurants.length > 1 && (
                    <div className="info-field full">
                      <label>식당</label>
                      <select className="luxury-select" value={selectedRestaurantId}
                        onChange={e => setSelectedRestaurantId(e.target.value)}>
                        {restaurants.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="info-field">
                    <label>날짜</label>
                    <input type="date" value={waitDay} onChange={e => setWaitDay(e.target.value)} />
                  </div>
                  <div className="info-field">
                    <label>인원</label>
                    <input type="number" min="1" max="20" value={waitParty} onChange={e => setWaitParty(Number(e.target.value))} />
                  </div>
                  <div className="info-field">
                    <label>희망 시작 시간</label>
                    <input type="time" value={waitTimeStart} onChange={e => setWaitTimeStart(e.target.value)} />
                  </div>
                  <div className="info-field">
                    <label>희망 마감 시간</label>
                    <input type="time" value={waitTimeEnd} onChange={e => setWaitTimeEnd(e.target.value)} />
                  </div>
                  <div className="info-field">
                    <label>이름</label>
                    <input value={waitName} onChange={e => setWaitName(e.target.value)} placeholder="홍길동" />
                  </div>
                  <div className="info-field">
                    <label>휴대폰 번호</label>
                    <input value={waitPhone} onChange={e => setWaitPhone(e.target.value)} placeholder="01012345678" />
                  </div>
                  <div className="info-field full">
                    <label>이메일</label>
                    <input type="email" value={waitEmail}
                      onChange={e => {
                        setWaitEmail(e.target.value);
                        if (waitVerifiedEmail && waitVerifiedEmail !== normalizeEmail(e.target.value)) {
                          setWaitVerifiedEmail(""); setWaitVerMsg(null);
                        }
                      }}
                      placeholder="name@example.com" />
                  </div>
                  <div className="info-field full">
                    <label>인증번호</label>
                    <div className="verify-row">
                      <div className="info-field" style={{ margin: 0 }}>
                        <input value={waitVerCode} onChange={e => setWaitVerCode(e.target.value)} placeholder="6자리 코드" />
                      </div>
                      <button className="verify-btn" type="button" onClick={() => requestCode(waitEmail, setWaitVerMsg)}>코드 보내기</button>
                      <button className="verify-btn" type="button" onClick={() => confirmCode(waitEmail, waitVerCode, setWaitVerifiedEmail, setWaitVerMsg)}>코드 확인</button>
                    </div>
                    {waitVerMsg && <div className={`verify-msg ${waitVerMsg.kind}`}>{waitVerMsg.text}</div>}
                    <div className={`verify-badge ${waitVerifiedEmail && waitVerifiedEmail === normalizeEmail(waitEmail) ? "done" : "pending"}`}
                      style={{ marginTop: 8, width: "fit-content" }}>
                      {waitVerifiedEmail && waitVerifiedEmail === normalizeEmail(waitEmail) ? "인증 완료" : "인증 필요"}
                    </div>
                  </div>
                  <div className="info-field full">
                    <label>메모 (선택)</label>
                    <textarea value={waitNotes} onChange={e => setWaitNotes(e.target.value)}
                      placeholder="예: 창가 선호, 10분 전후 가능" rows={3} />
                  </div>
                </div>
                {waitMsg && <div className={`verify-msg ${waitMsg.kind}`} style={{ marginTop: 16 }}>{waitMsg.text}</div>}
              </div>
              <div className="modal-foot">
                <button className="modal-back-btn" onClick={closeModal}>닫기</button>
                <button className="modal-next-btn" onClick={submitWaitlist}>대기열 등록</button>
              </div>
            </>
          )}

        </div>
      </div>
    </>
  );
}

// ── CLAIM PAGE ──────────────────────────────────────────────
function ClaimPage({ token }) {
  const [claim, setClaim] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    apiFetch(`/api/public/claims/${token}`)
      .then(data => { if (active) setClaim(data); })
      .catch(e => { if (active) setMessage({ kind: "error", text: e.message }); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  async function acceptClaim() {
    setMessage(null);
    try {
      const result = await apiFetch(`/api/public/claims/${token}/accept`, { method: "POST" });
      window.location.href = `/pay/${result.payment_token}`;
    } catch (e) { setMessage({ kind: "error", text: e.message }); }
  }

  return (
    <div className="luxury-page">
      <nav className="luxury-page-nav">
        <span className="luxury-brand">Smart Booking</span>
        <a href="/" style={{ fontFamily: "'Cormorant SC', serif", fontSize: 11, letterSpacing: "0.2em", color: "var(--sepia-mid)" }}>← 홈</a>
      </nav>
      <div className="luxury-page-body">
        <div className="luxury-page-title">대기 오퍼 수락</div>
        <div className="luxury-page-sub">Waitlist Offer</div>
        {message && <div className={`luxury-msg ${message.kind}`}>{message.text}</div>}
        {loading ? (
          <div style={{ fontFamily: "'Cormorant Garamond', serif", color: "var(--sepia-light)", fontSize: 18 }}>불러오는 중...</div>
        ) : claim ? (
          <>
            <div className="luxury-info-card">
              {[
                ["레스토랑", claim.restaurant_name],
                ["날짜", claim.day],
                ["시간", formatTime(claim.time)],
                ["인원", `${claim.party_size}명`],
                ["상태", claim.status],
                ["만료", claim.expires_at.replace("T", " ").slice(0, 16) + " UTC"],
              ].map(([l, v]) => (
                <div key={l} className="luxury-info-row">
                  <span className="luxury-info-lbl">{l}</span>
                  <span className="luxury-info-val">{v}</span>
                </div>
              ))}
            </div>
            <p style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 15, color: "var(--sepia-mid)", lineHeight: 1.7, marginBottom: 24 }}>
              오퍼를 수락하면 보증금 결제 단계로 이동합니다. 결제가 완료되면 예약이 확정됩니다.
            </p>
            {claim.status === "active" ? (
              <button className="luxury-action-btn gold" onClick={acceptClaim}>오퍼 수락 후 결제</button>
            ) : (
              <a className="luxury-secondary-btn" href="/">홈으로 돌아가기</a>
            )}
          </>
        ) : (
          <div style={{ fontFamily: "'Cormorant Garamond', serif", color: "var(--sepia-light)", fontSize: 18 }}>오퍼 정보를 찾지 못했습니다.</div>
        )}
      </div>
    </div>
  );
}

// ── PAYMENT PAGE ────────────────────────────────────────────
function PaymentPage({ token }) {
  const [payment, setPayment] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    apiFetch(`/api/public/payments/${token}`)
      .then(data => { if (active) setPayment(data); })
      .catch(e => { if (active) setMessage({ kind: "error", text: e.message }); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  async function completePayment() {
    setMessage(null);
    try {
      await apiFetch(`/api/public/payments/${token}/complete`, { method: "POST" });
      const data = await apiFetch(`/api/public/payments/${token}`);
      setPayment(data);
      setMessage({ kind: "info", text: "결제가 완료되어 예약이 확정됐습니다." });
    } catch (e) { setMessage({ kind: "error", text: e.message }); }
  }

  return (
    <div className="luxury-page">
      <nav className="luxury-page-nav">
        <span className="luxury-brand">Smart Booking</span>
        <a href="/" style={{ fontFamily: "'Cormorant SC', serif", fontSize: 11, letterSpacing: "0.2em", color: "var(--sepia-mid)" }}>← 홈</a>
      </nav>
      <div className="luxury-page-body">
        <div className="luxury-page-title">보증금 결제</div>
        <div className="luxury-page-sub">Deposit Payment</div>
        {message && <div className={`luxury-msg ${message.kind}`}>{message.text}</div>}
        {loading ? (
          <div style={{ fontFamily: "'Cormorant Garamond', serif", color: "var(--sepia-light)", fontSize: 18 }}>불러오는 중...</div>
        ) : payment ? (
          <>
            <div className="luxury-info-card">
              {[
                ["예약 번호", `#${payment.reservation_id}`],
                ["결제 금액", `${Number(payment.amount).toLocaleString()} KRW`],
                ["테이블", (payment.tables || []).join(", ") || "-"],
                ["상태", payment.status],
                ["결제 만료", payment.expires_at.replace("T", " ").slice(0, 16) + " UTC"],
              ].map(([l, v]) => (
                <div key={l} className="luxury-info-row">
                  <span className="luxury-info-lbl">{l}</span>
                  <span className="luxury-info-val">{v}</span>
                </div>
              ))}
            </div>
            {payment.status === "pending" ? (
              <button className="luxury-action-btn gold" onClick={completePayment}>지금 결제하기</button>
            ) : (
              <a className="luxury-secondary-btn" href="/">홈으로 돌아가기</a>
            )}
          </>
        ) : (
          <div style={{ fontFamily: "'Cormorant Garamond', serif", color: "var(--sepia-light)", fontSize: 18 }}>결제 정보를 찾지 못했습니다.</div>
        )}
      </div>
    </div>
  );
}

// ── ADMIN PAGE ──────────────────────────────────────────────
function AdminPage() {
  const [token, setToken] = useState(() => window.localStorage.getItem(ADMIN_KEY) || "");
  const [inputToken, setInputToken] = useState("");
  const [dashboard, setDashboard] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [restaurantForm, setRestaurantForm] = useState({ name: "", description: "", contact_email: "" });
  const [tableForm, setTableForm] = useState({ restaurant_id: "", name: "", capacity: "2", combinable_group: "" });
  const [slotForm, setSlotForm] = useState({ restaurant_id: "", day: "", time: "18:00" });
  const [openSlotForm, setOpenSlotForm] = useState({ slot_id: "", party_size_cap: "2" });

  useEffect(() => {
    if (!token) return;
    let active = true;
    setLoading(true);
    apiFetch("/api/admin/dashboard", {}, token)
      .then(data => {
        if (!active) return;
        setDashboard(data);
        setMessage(null);
        setTableForm(c => ({ ...c, restaurant_id: c.restaurant_id || String(data.restaurants[0]?.id || "") }));
        setSlotForm(c => ({ ...c, restaurant_id: c.restaurant_id || String(data.restaurants[0]?.id || "") }));
        setOpenSlotForm(c => ({ ...c, slot_id: c.slot_id || String(data.slots[0]?.slot_id || "") }));
      })
      .catch(e => {
        if (!active) return;
        setMessage({ kind: "error", text: e.message });
        if (e.message === "Invalid admin token") { window.localStorage.removeItem(ADMIN_KEY); setToken(""); setDashboard(null); }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  async function refresh(msg) {
    if (!token) return;
    setLoading(true);
    try {
      const data = await apiFetch("/api/admin/dashboard", {}, token);
      setDashboard(data);
      if (msg) setMessage(msg);
    } catch (e) { setMessage({ kind: "error", text: e.message }); }
    finally { setLoading(false); }
  }

  async function login(e) {
    e.preventDefault(); setMessage(null);
    try {
      await apiFetch("/api/admin/session", { method: "POST", body: JSON.stringify({ token: inputToken }) });
      window.localStorage.setItem(ADMIN_KEY, inputToken);
      setToken(inputToken);
    } catch (err) { setMessage({ kind: "error", text: err.message }); }
  }

  function logout() { window.localStorage.removeItem(ADMIN_KEY); setToken(""); setInputToken(""); setDashboard(null); setMessage(null); }

  async function submitRestaurant(e) {
    e.preventDefault();
    try { await apiFetch("/api/admin/restaurants", { method: "POST", body: JSON.stringify(restaurantForm) }, token); setRestaurantForm({ name: "", description: "", contact_email: "" }); await refresh({ kind: "info", text: "식당 추가 완료." }); }
    catch (err) { setMessage({ kind: "error", text: err.message }); }
  }
  async function submitTable(e) {
    e.preventDefault();
    try { await apiFetch(`/api/admin/restaurants/${tableForm.restaurant_id}/tables`, { method: "POST", body: JSON.stringify({ name: tableForm.name, capacity: Number(tableForm.capacity), combinable_group: tableForm.combinable_group || null }) }, token); setTableForm(c => ({ ...c, name: "", capacity: "2", combinable_group: "" })); await refresh({ kind: "info", text: "테이블 추가 완료." }); }
    catch (err) { setMessage({ kind: "error", text: err.message }); }
  }
  async function submitSlot(e) {
    e.preventDefault();
    try { await apiFetch(`/api/admin/restaurants/${slotForm.restaurant_id}/slots`, { method: "POST", body: JSON.stringify({ day: slotForm.day, time: `${slotForm.time}:00`, is_open: true }) }, token); await refresh({ kind: "info", text: "슬롯 생성 완료." }); }
    catch (err) { setMessage({ kind: "error", text: err.message }); }
  }
  async function submitOpenSlot(e) {
    e.preventDefault();
    try { await apiFetch("/api/admin/open-slots", { method: "POST", body: JSON.stringify({ slot_id: Number(openSlotForm.slot_id), party_size_cap: Number(openSlotForm.party_size_cap) }) }, token); await refresh({ kind: "info", text: "오픈 슬롯 생성 완료." }); }
    catch (err) { setMessage({ kind: "error", text: err.message }); }
  }
  async function dispatchOpenSlot(id) {
    try { await apiFetch(`/api/admin/open-slots/${id}/dispatch`, { method: "POST" }, token); await refresh({ kind: "info", text: "오퍼 발송 완료." }); }
    catch (err) { setMessage({ kind: "error", text: err.message }); }
  }
  async function cancelReservation(id) {
    try { await apiFetch(`/api/admin/reservations/${id}/cancel`, { method: "POST" }, token); await refresh({ kind: "info", text: "예약 취소 및 대기열 재평가 완료." }); }
    catch (err) { setMessage({ kind: "error", text: err.message }); }
  }
  async function deleteReservation(id) {
    if (!confirm(`예약 #${id}을(를) 완전히 삭제하시겠습니까?`)) return;
    try { await apiFetch(`/api/admin/reservations/${id}`, { method: "DELETE" }, token); await refresh({ kind: "info", text: "예약 삭제 완료." }); }
    catch (err) { setMessage({ kind: "error", text: err.message }); }
  }
  async function deleteAllReservations() {
    if (!confirm("모든 예약 및 대기 요청을 완전히 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) return;
    try { const r = await apiFetch("/api/admin/reservations", { method: "DELETE" }, token); await refresh({ kind: "info", text: `예약 ${r.deleted}건 및 대기 요청 전체 삭제 완료.` }); }
    catch (err) { setMessage({ kind: "error", text: err.message }); }
  }
  async function deleteWaitlist(id) {
    if (!confirm(`대기 요청 #${id}을(를) 삭제하시겠습니까?`)) return;
    try { await apiFetch(`/api/admin/waitlist/${id}`, { method: "DELETE" }, token); await refresh({ kind: "info", text: "대기 요청 삭제 완료." }); }
    catch (err) { setMessage({ kind: "error", text: err.message }); }
  }
  async function deleteRestaurant(id, name) {
    if (!confirm(`"${name}" 식당과 모든 관련 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) return;
    try { await apiFetch(`/api/admin/restaurants/${id}`, { method: "DELETE" }, token); await refresh({ kind: "info", text: `${name} 삭제 완료.` }); }
    catch (err) { setMessage({ kind: "error", text: err.message }); }
  }
  async function runEngine() {
    try { const r = await apiFetch("/api/admin/engine/run", { method: "POST" }, token); await refresh({ kind: "info", text: `만료 검사 완료: claim ${r.expired_claims}건, payment ${r.expired_payments}건` }); }
    catch (err) { setMessage({ kind: "error", text: err.message }); }
  }

  if (!token) return (
    <div className="admin-login-wrap">
      <div className="admin-login-card">
        <div className="title">관리자 로그인</div>
        <div className="sub">ADMIN ACCESS</div>
        {message && <div className={`luxury-msg ${message.kind}`}>{message.text}</div>}
        <form onSubmit={login}>
          <div className="admin-field">
            <label>Admin Token</label>
            <input value={inputToken} onChange={e => setInputToken(e.target.value)} placeholder="admin123" />
          </div>
          <button className="admin-btn" type="submit" style={{ width: "100%", marginTop: 16 }}>로그인</button>
        </form>
      </div>
    </div>
  );

  if (loading && !dashboard) return (
    <div className="admin-shell">
      <nav className="admin-nav"><span className="admin-brand">Smart Booking — Admin</span></nav>
      <div className="admin-main" style={{ fontFamily: "'Cormorant Garamond', serif", color: "var(--sepia-light)", fontSize: 18 }}>불러오는 중...</div>
    </div>
  );

  return (
    <div className="admin-shell">
      <nav className="admin-nav">
        <span className="admin-brand">Smart Booking — Admin</span>
        <div className="admin-nav-right">
          <button className="admin-btn ghost" onClick={() => window.location.href = "/"}>홈으로</button>
          <button className="admin-btn" onClick={runEngine}>만료 검사 실행</button>
          <button className="admin-btn danger" onClick={deleteAllReservations}>전체 삭제</button>
          <button className="admin-btn ghost" onClick={logout}>로그아웃</button>
        </div>
      </nav>
      <div className="admin-main">
        {message && <div className={`luxury-msg ${message.kind}`} style={{ marginBottom: 24 }}>{message.text}</div>}

        {dashboard && (
          <>
            <div className="admin-stats">
              {[["Restaurants", dashboard.restaurants.length], ["Slots", dashboard.slots.length], ["Waitlists", dashboard.waitlists.length], ["Logs", dashboard.logs.length]].map(([l, v]) => (
                <div key={l} className="admin-stat"><div className="admin-stat-val">{v}</div><div className="admin-stat-lbl">{l}</div></div>
              ))}
            </div>

            <div className="admin-section">
              <div className="admin-section-title">식당 관리</div>
              <div className="admin-table-wrap" style={{ marginBottom: 24 }}>
                <table className="admin-table">
                  <thead><tr><th>ID</th><th>이름</th><th>설명</th><th>이메일</th><th></th></tr></thead>
                  <tbody>
                    {dashboard.restaurants.map(r => (
                      <tr key={r.id}>
                        <td>#{r.id}</td>
                        <td><strong>{r.name}</strong></td>
                        <td className="muted">{r.description || "-"}</td>
                        <td className="muted">{r.contact_email || "-"}</td>
                        <td><button className="admin-btn small danger" onClick={() => deleteRestaurant(r.id, r.name)}>삭제</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="admin-section">
              <div className="admin-section-title">생성</div>
              <div className="admin-grid-3">
                <form className="admin-card" onSubmit={submitRestaurant}>
                  <h4>식당 추가</h4>
                  {[["이름","name","text",restaurantForm.name,v=>setRestaurantForm(c=>({...c,name:v}))],["설명","description","text",restaurantForm.description,v=>setRestaurantForm(c=>({...c,description:v}))],["연락 이메일","contact_email","email",restaurantForm.contact_email,v=>setRestaurantForm(c=>({...c,contact_email:v}))]].map(([label,,type,val,set])=>(
                    <div key={label} className="admin-field"><label>{label}</label><input type={type} value={val} onChange={e=>set(e.target.value)} /></div>
                  ))}
                  <button className="admin-btn" type="submit">생성</button>
                </form>
                <form className="admin-card" onSubmit={submitTable}>
                  <h4>테이블 추가</h4>
                  <div className="admin-field"><label>식당</label>
                    <select value={tableForm.restaurant_id} onChange={e=>setTableForm(c=>({...c,restaurant_id:e.target.value}))}>
                      {dashboard.restaurants.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>
                  {[["이름","name","text",tableForm.name,v=>setTableForm(c=>({...c,name:v}))],["좌석 수","capacity","number",tableForm.capacity,v=>setTableForm(c=>({...c,capacity:v}))],["조합 그룹","combinable_group","text",tableForm.combinable_group,v=>setTableForm(c=>({...c,combinable_group:v}))]].map(([label,,type,val,set])=>(
                    <div key={label} className="admin-field"><label>{label}</label><input type={type} value={val} onChange={e=>set(e.target.value)} placeholder={label==="조합 그룹"?"예: hall":""} /></div>
                  ))}
                  <button className="admin-btn" type="submit">추가</button>
                </form>
                <form className="admin-card" onSubmit={submitSlot}>
                  <h4>슬롯 추가</h4>
                  <div className="admin-field"><label>식당</label>
                    <select value={slotForm.restaurant_id} onChange={e=>setSlotForm(c=>({...c,restaurant_id:e.target.value}))}>
                      {dashboard.restaurants.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>
                  <div className="admin-field"><label>날짜</label><input type="date" value={slotForm.day} onChange={e=>setSlotForm(c=>({...c,day:e.target.value}))} /></div>
                  <div className="admin-field"><label>시간</label><input type="time" value={slotForm.time} onChange={e=>setSlotForm(c=>({...c,time:e.target.value}))} /></div>
                  <button className="admin-btn" type="submit">슬롯 생성</button>
                </form>
              </div>
            </div>

            <div className="admin-section">
              <div className="admin-grid-2">
                <div>
                  <div className="admin-section-title">오픈 슬롯</div>
                  <form className="admin-card" onSubmit={submitOpenSlot}>
                    <div className="admin-field"><label>슬롯</label>
                      <select value={openSlotForm.slot_id} onChange={e=>setOpenSlotForm(c=>({...c,slot_id:e.target.value}))}>
                        {dashboard.slots.map(s=><option key={s.slot_id} value={s.slot_id}>{s.restaurant_name} / {s.day} {s.time}</option>)}
                      </select>
                    </div>
                    <div className="admin-field"><label>허용 인원</label><input type="number" min="1" max="20" value={openSlotForm.party_size_cap} onChange={e=>setOpenSlotForm(c=>({...c,party_size_cap:e.target.value}))} /></div>
                    <button className="admin-btn" type="submit">오픈 슬롯 생성</button>
                  </form>
                </div>
                <div>
                  <div className="admin-section-title">대기 요청</div>
                  {dashboard.waitlists.length ? (
                    <div className="admin-table-wrap">
                      <table className="admin-table">
                        <thead><tr><th>ID</th><th>손님</th><th>요청</th><th>상태</th><th></th></tr></thead>
                        <tbody>
                          {dashboard.waitlists.map(w=>(
                            <tr key={w.id}>
                              <td>#{w.id}</td>
                              <td><strong>{w.guest_name}</strong><div className="muted">{w.guest_email}</div></td>
                              <td>{w.restaurant_name}<br />{w.day} {w.time_start}–{w.time_end} / {w.party_size}명</td>
                              <td><StatusBadge status={w.status} /></td>
                              <td><button className="admin-btn small danger" onClick={() => deleteWaitlist(w.id)}>삭제</button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <div style={{ fontFamily: "'Cormorant Garamond', serif", color: "var(--sepia-light)", fontSize: 16, padding: "20px 0" }}>대기 요청이 없습니다.</div>}
                </div>
              </div>
            </div>

            <div className="admin-section">
              <div className="admin-section-title">슬롯별 예약 현황</div>
              {dashboard.slots.map(slot => (
                <div key={slot.slot_id} className="admin-slot-card">
                  <div className="admin-slot-head">
                    <div>
                      <div className="eyebrow">{slot.restaurant_name}</div>
                      <h4>{slot.day} {slot.time}</h4>
                    </div>
                    <div className="admin-slot-head-right">
                      <StatusBadge status={slot.is_open ? "open" : "closed"} />
                      {slot.open_slot && (
                        <>
                          <span style={{ fontFamily: "'Cormorant SC', serif", fontSize: 9, letterSpacing: "0.15em", color: "var(--sepia-mid)", padding: "3px 8px", border: "1px solid rgba(0,0,0,0.15)" }}>{slot.open_slot.party_size_cap}명 오픈</span>
                          <button className="admin-btn small" onClick={() => dispatchOpenSlot(slot.open_slot.id)}>대기열 발송</button>
                        </>
                      )}
                    </div>
                  </div>
                  {slot.reservations.length ? (
                    <div className="admin-table-wrap">
                      <table className="admin-table">
                        <thead><tr><th>ID</th><th>손님</th><th>인원</th><th>테이블</th><th>결제</th><th>상태</th><th></th></tr></thead>
                        <tbody>
                          {slot.reservations.map(r => (
                            <tr key={r.id}>
                              <td>#{r.id}</td>
                              <td><strong>{r.guest_name}</strong><div className="muted">{r.guest_email}</div><div className="muted">{r.phone_number || "-"}</div></td>
                              <td>{r.party_size}명</td>
                              <td>{r.tables.join(", ") || "-"}</td>
                              <td><StatusBadge status={r.payment_status || "none"} /></td>
                              <td><StatusBadge status={r.status} /></td>
                              <td style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                <button className="admin-btn small danger" onClick={() => cancelReservation(r.id)}>취소</button>
                                <button className="admin-btn small danger" onClick={() => deleteReservation(r.id)}>삭제</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <div style={{ padding: "16px 20px", fontFamily: "'Cormorant Garamond', serif", color: "var(--sepia-light)", fontSize: 15 }}>예약 없음</div>}
                </div>
              ))}
            </div>

            <div className="admin-section">
              <div className="admin-section-title">알림 발송 로그</div>
              {dashboard.logs.length ? (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead><tr><th>ID</th><th>Waitlist</th><th>Claim</th><th>채널</th><th>결과</th><th>시간</th></tr></thead>
                    <tbody>
                      {dashboard.logs.map(log => (
                        <tr key={log.id}>
                          <td>#{log.id}</td>
                          <td>{log.waitlist_id}</td>
                          <td>{log.claim_id || "-"}</td>
                          <td>{log.channel}</td>
                          <td><StatusBadge status={log.result} /><div className="muted">{log.detail}</div></td>
                          <td>{log.sent_at.replace("T", " ").slice(0, 16)} UTC</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <div style={{ fontFamily: "'Cormorant Garamond', serif", color: "var(--sepia-light)", fontSize: 16, padding: "12px 0" }}>로그 없음</div>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── ROUTER ──────────────────────────────────────────────────
export default function App() {
  const route = getRoute();
  if (route.name === "admin") return <AdminPage />;
  if (route.name === "claim") return <ClaimPage token={route.token} />;
  if (route.name === "pay") return <PaymentPage token={route.token} />;
  return <GuestPage />;
}

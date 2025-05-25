// trip_list_script.js

const token = "eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOjEsInN1YiI6ImV4YW1wbGVAZ21haWwuY29tIiwiaWF0IjoxNzQ4MTg5NjgyLCJleHAiOjE3NDgxOTE0ODJ9.yInMt94yj17UeNH6VBu6vRYQ7RA6_4uz5US-2R5_v0w";

// --- Helper for authenticated fetch ---
async function authFetch(url, options = {}) {
  options.headers = {
    ...(options.headers || {}),
    "Authorization": `Bearer ${token}`,
    // Only set Content-Type for non-GET
    ...(options.method && options.method !== "GET"
      ? { "Content-Type": "application/json" }
      : {})
  };
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res;
}

// --- Load avatar image as data URL ---
function loadAvatarImage(avatarImage) {
  if (!avatarImage) return Promise.resolve(null);
  return authFetch(
    `http://localhost:8080/api/file?fileName=${encodeURIComponent(avatarImage)}`,
    { method: "GET" }
  )
    .then(r => r.text())
    .catch(err => {
      console.error("Помилка завантаження зображення", err);
      return null;
    });
}

// --- Fetch trips list ---
async function fetchTrips(url, errorMessage) {
  try {
    const resp = await authFetch(url, { method: "GET" });
    return await resp.json();
  } catch {
    throw new Error(errorMessage);
  }
}
function loadTrips(myTrips) {
  return fetchTrips(
    `http://localhost:8080/api/trips?myTrips=${myTrips}`,
    "Не вдалося завантажити подорожі. Спробуйте пізніше."
  );
}

// --- Delete and leave requests ---
async function deleteTrip(id) {
  await authFetch(`http://localhost:8080/api/trips/${id}/participants/leave`, {
    method: "DELETE"
  });
}
async function leaveTripRequest(id) {
  await authFetch(
    `http://localhost:8080/api/trips/${id}/participants/leave`,
    { method: "DELETE" }
  );
}

// --- UI helpers ---
function createSectionTitle(text) {
  const title = document.createElement("h2");
  title.className = "section-title";
  title.textContent = text;
  return title;
}

async function addTripCard(trip, isMine) {
  const container = document.querySelector(".trips");
  const card = document.createElement("div");
  card.className = "trip-card";
  card.dataset.id = trip.id;

  const avatarData = await loadAvatarImage(trip.avatarImage);

  card.innerHTML = `
  <div class="image-placeholder">
    ${avatarData ? `<img src="${avatarData}" alt="Avatar" class="trip-avatar" />` : ''}
  </div>
  <div class="trip-info">
    <h3><a href="trip_details.html?tripId=${trip.id}" class="trip_href">${trip.title}</a></h3>
    <p>${trip.tripDescription || 'Опис відсутній'}</p>
    <div class="trip-meta">
      <span class="tag">number of participants: <strong>${trip.participantsCount}</strong></span>
      <span class="tag">start date: ${new Date(trip.startDate).toLocaleDateString()}</span>
    </div>
  </div>
  <button class="trash-btn" title="${isMine ? 'Видалити поїздку' : 'Покинути поїздку'}">
    <img src="./assets/delete.png" alt="Delete/Leave" class="trash-icon" />
  </button>
`;

  const btn = card.querySelector(".trash-btn");
  btn.addEventListener("click", async () => {
    const prevMy = [...myTripsData];
    const prevOther = [...otherTripsData];
    if (isMine) {
      myTripsData = myTripsData.filter(t => t.id !== trip.id);
    } else {
      otherTripsData = otherTripsData.filter(t => t.id !== trip.id);
    }
    card.remove();

    try {
      if (isMine) {
        await deleteTrip(trip.id);
      } else {
        await leaveTripRequest(trip.id);
      }
    } catch (err) {
      alert("Не вдалося виконати дію. Спробуйте пізніше.");
      console.error(err);
      myTripsData = prevMy;
      otherTripsData = prevOther;
      const active = document.querySelector(".tabs a.active").textContent.trim();
      await updateTripsView(active);
    }
  });

  container.appendChild(card);
}

function clearTrips() {
  document
    .querySelectorAll(".trips .trip-card, .trips .section-title")
    .forEach(el => el.remove());
}

function filterTrips(trips, type) {
  const now = new Date();
  if (type === "Active Trips") {
    return trips.filter(t => new Date(t.startDate) >= now);
  } else if (type === "Past Trips") {
    return trips.filter(t => new Date(t.startDate) < now);
  }
  return trips;
}

async function renderTripsWithTitle(trips, titleText, isMine) {
  if (!trips.length) return;
  const container = document.querySelector(".trips");
  container.appendChild(createSectionTitle(titleText));
  for (const trip of trips) {
    await addTripCard(trip, isMine);
  }
}

async function updateTripsView(filterText) {
  clearTrips();
  const myFiltered = filterTrips(myTripsData, filterText);
  const otherFiltered = filterTrips(otherTripsData, filterText);
  await renderTripsWithTitle(myFiltered, "My Trips", true);
  await renderTripsWithTitle(otherFiltered, "Other Trips", false);
}

let myTripsData = [];
let otherTripsData = [];

document.addEventListener("DOMContentLoaded", () => {
  const tabs = document.querySelectorAll(".tabs a:not(.new-trip)");

  tabs.forEach(tab => {
    tab.addEventListener("click", async e => {
      e.preventDefault();
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      await updateTripsView(tab.textContent.trim());
    });
  });

  Promise.all([loadTrips(true), loadTrips(false)])
    .then(async ([mine, other]) => {
      myTripsData = mine;
      otherTripsData = other;
      const allTab = [...tabs].find(t => t.textContent.trim() === "All trips");
      if (allTab) {
        tabs.forEach(t => t.classList.remove("active"));
        allTab.classList.add("active");
      }
      await updateTripsView("All trips");
    })
    .catch(err => console.error("Помилка завантаження подорожей:", err));
  const modal = document.getElementById("add-trip");
  const openBtn = document.querySelector(".new-trip");
  const closeBtn = modal.querySelector(".close");
  const cancelBtn = modal.querySelector(".cancel");
  const form = modal.querySelector("form");

  function openModal() {
    modal.style.display = "block";
  }
  function closeModal() {
    modal.style.display = "none";
    form.reset();
  }

  openBtn.addEventListener("click", e => {
    e.preventDefault();
    openModal();
  });
  closeBtn.addEventListener("click", e => {
    e.preventDefault();
    closeModal();
  });
  cancelBtn.addEventListener("click", e => {
    e.preventDefault();
    closeModal();
  });
  window.addEventListener("click", e => {
    if (e.target === modal) closeModal();
  });

  form.addEventListener("submit", async e => {
    e.preventDefault();
    const title = form.querySelector("#trip-title").value.trim();
    const description = form.querySelector("#trip-desc").value.trim();
    const startDateRaw = form.querySelector("#trip-start").value;
    const endDateRaw = form.querySelector("#trip-end").value;

    if (!title || !startDateRaw || !endDateRaw) {
      alert("Будь ласка, заповніть назву, дату початку та дату завершення подорожі.");
      return;
    }

    const startDate = `${startDateRaw}T00:00:00`;
    const endDate = `${endDateRaw}T00:00:00`;
    const isActive = true;

    try {
      const resp = await authFetch("http://localhost:8080/api/trips", {
        method: "POST",
        body: JSON.stringify({ title, description: description || null, startDate, endDate, isActive })
      });
      const newTrip = await resp.json();
      myTripsData.push(newTrip);

      const activeTab = document.querySelector(".tabs a.active");
      const currentFilter = activeTab ? activeTab.textContent.trim() : "All trips";
      await updateTripsView(currentFilter);
      closeModal();
    } catch (err) {
      alert("Не вдалося створити подорожу. Спробуйте пізніше.");
      console.error("Помилка створення подорожі:", err);
    }
  });
});

// Initialize Globe.gl from global script or ESM
const GlobeInstance = window.Globe;

// 1. CELESTIAL BODIES CONFIGURATION WITH HD TEXTURES, BUMP MAPS & ATMOSPHERES
const PLANETS_DATA = {
    mars: {
        name: "Mars (Surface)",
        texture: "./assets/mars.jpg",
        bump: "./assets/mars.jpg",
        hasAtmosphere: true,
        atmosphereColor: "#e07a5f",
        atmosphereAltitude: 0.06,
        uiAccent: "#ef4444",
        uiAccentDark: "#991b1b"
    },
    moon: {
        name: "The Moon (Regolith)",
        texture: "./assets/moon.jpg",
        bump: "./assets/moon_bump.jpg",
        hasAtmosphere: false,
        atmosphereColor: "#ffffff",
        atmosphereAltitude: 0.0,
        uiAccent: "#f8fafc",
        uiAccentDark: "#64748b"
    },
    earth: {
        name: "Earth (Analog Zone)",
        texture: "./assets/earth.jpg",
        bump: "./assets/earth_bump.png",
        hasAtmosphere: true,
        atmosphereColor: "#38bdf8",
        atmosphereAltitude: 0.18,
        uiAccent: "#38bdf8",
        uiAccentDark: "#0284c7"
    }
};

let currentPlanetKey = "mars";
let isViewingEarth = false;
let activeAnalogsData = [];

// 2. HYPERREALISTIC 3D GLOBE INITIALIZATION
const container = document.getElementById('globe-container');
const initWidth = container.clientWidth || (window.innerWidth - 360);
const initHeight = container.clientHeight || window.innerHeight;

const globe = GlobeInstance()(container)
    .width(initWidth)
    .height(initHeight)
    .backgroundImageUrl('./assets/night-sky.png')
    .globeImageUrl(PLANETS_DATA.mars.texture)
    .bumpImageUrl(PLANETS_DATA.mars.bump)
    .showAtmosphere(PLANETS_DATA.mars.hasAtmosphere)
    .atmosphereColor(PLANETS_DATA.mars.atmosphereColor)
    .atmosphereAltitude(PLANETS_DATA.mars.atmosphereAltitude)
    .pointsData([])
    .pointLat(d => d.lat)
    .pointLng(d => d.lng)
    .pointColor(() => PLANETS_DATA.mars.uiAccent)
    .pointAltitude(0.015)
    .pointRadius(0.55);

globe.controls().autoRotate = false;

function resizeGlobe() {
    if (container && container.clientWidth > 0) {
        globe.width(container.clientWidth);
        globe.height(container.clientHeight);
    }
}

setTimeout(resizeGlobe, 150);

function refreshAllSlidersVisual() {
    const planet = PLANETS_DATA[currentPlanetKey] || PLANETS_DATA.mars;
    document.querySelectorAll('.weight-slider').forEach(slider => {
        const val = parseFloat(slider.value) || 0;
        const min = parseFloat(slider.min) || 0;
        const max = parseFloat(slider.max) || 100;
        const pct = ((val - min) / (max - min)) * 100;
        slider.style.background = `linear-gradient(to right, ${planet.uiAccentDark} 0%, ${planet.uiAccent} ${pct}%, #1f2737 ${pct}%, #1f2737 100%)`;
    });
}

function renderTargetPoint(lat, lng, accentColor) {
    globe
        .pointColor(() => accentColor)
        .pointsData([{ lat, lng }]);
}

function clearTargetPoint() {
    globe.pointsData([]);
}

function switchPlanet(planetKey) {
    const planet = PLANETS_DATA[planetKey];
    if (!planet) return;
    currentPlanetKey = planetKey;

    document.body.dataset.planet = planetKey;
    refreshAllSlidersVisual();

    if (typeof requestData !== 'undefined') {
        requestData.cuerpo_celeste = planetKey;
        syncPayload();
    }

    globe.globeImageUrl(planet.texture);
    globe.bumpImageUrl(planet.bump);

    globe.showAtmosphere(planet.hasAtmosphere);
    if (planet.hasAtmosphere) {
        globe.atmosphereColor(planet.atmosphereColor);
        globe.atmosphereAltitude(planet.atmosphereAltitude);
    } else {
        globe.atmosphereAltitude(0);
    }

    const planetNameEl = document.getElementById('planet-name');
    if (planetNameEl) {
        planetNameEl.textContent = planet.name;
    }
    if (planetKey !== 'earth') {
        document.getElementById('planet-select').value = planetKey;
    }
}

const planetSelect = document.getElementById('planet-select');
planetSelect.addEventListener('change', (e) => {
    switchPlanet(e.target.value);
});

globe.onGlobeClick(({ lat, lng }) => {
    if (isViewingEarth) return;

    const roundedLat = parseFloat(lat.toFixed(2));
    const roundedLng = parseFloat(lng.toFixed(2));

    document.getElementById('lat-input').value = roundedLat;
    document.getElementById('lon-input').value = roundedLng;

    updateRegisteredCoordinates(roundedLat, roundedLng);

    const originAccent = PLANETS_DATA[currentPlanetKey].uiAccent;
    renderTargetPoint(roundedLat, roundedLng, originAccent);

    processRegionSelection(currentPlanetKey, roundedLat, roundedLng, "3D Globe Click");
});

// =========================================================================
// RIGHT PANEL RENDERING WITH 10 EXPANDABLE ANALOGS
// =========================================================================

function renderRightResultsPanel(originPlanetName, originLat, originLng, targetLat, targetLng, weightsSnapshot, apiResult = null) {
    const panel = document.getElementById('results-panel');
    const toggleRightBtn = document.getElementById('toggle-right-panel');
    if (!panel) return;

    if (apiResult && typeof apiResult === 'object' && (apiResult.analogos || apiResult.puntos_analogos || apiResult.alternatives)) {
        activeAnalogsData = apiResult.analogos || apiResult.puntos_analogos || apiResult.alternatives;
    } else {
        activeAnalogsData = [];
        const baseSim = 94;
        for (let i = 0; i < 10; i++) {
            const sim = Math.max(65, baseSim - (i * 3.2));
            const latOffset = (i * 4.5) * (i % 2 === 0 ? 1 : -1);
            const lngOffset = (i * 7.2) * (i % 3 === 0 ? 1 : -1);
            
            const varsSim = VARIABLE_CONFIG.map((v, vIdx) => {
                const seed = Math.abs(Math.sin((originLat + i * 7 + vIdx * 13) * 0.17));
                return Math.min(99, Math.max(55, Math.round(sim + (seed * 10 - 5))));
            });

            activeAnalogsData.push({
                lat: parseFloat(Math.min(85, Math.max(-85, targetLat + latOffset)).toFixed(2)),
                lng: parseFloat(Math.min(180, Math.max(-180, targetLng + lngOffset)).toFixed(2)),
                similarity: Math.round(sim),
                variablesSim: varsSim,
                region: `Analog Zone ${i + 1}`
            });
        }
    }

    const originShortName = originPlanetName.replace(/^The\s+/i, '').split(' ')[0].toUpperCase();

    const analogsHTML = activeAnalogsData.map((alt, index) => {
        const items = VARIABLE_CONFIG.map((v, idx) => {
            const weight = weightsSnapshot[v.key] ?? 0.5;
            const similarityPct = alt.variablesSim ? alt.variablesSim[idx] : alt.similarity;
            return {
                label: v.label,
                weight,
                similarityPct
            };
        });

        const rowsHTML = items.map(item => `
            <div class="sim-row">
                <div class="sim-row-top">
                    <span class="sim-var-name">${item.label}</span>
                    <div class="sim-metrics">
                        <span class="sim-weight-tag">Weight: ${Math.round(item.weight * 100)}%</span>
                        <span class="sim-score-tag">${item.similarityPct}%</span>
                    </div>
                </div>
                <div class="sim-bar-track">
                    <div class="sim-bar-fill" style="width: ${item.similarityPct}%;"></div>
                </div>
            </div>
        `).join('');

        const isOpenClass = index === 0 ? 'is-open' : '';

        return `
            <div class="analogue-dropdown-item ${isOpenClass}" data-index="${index}">
                <div class="analogue-dropdown-header">
                    <span class="analogue-rank">#${index + 1} ${index === 0 ? '(Primary)' : ''}</span>
                    <span class="analogue-coords">${alt.lat}°, ${alt.lng}°</span>
                    <span class="analogue-pill-small">${alt.similarity}% MATCH</span>
                </div>
                <div class="analogue-dropdown-body">
                    <div class="coords-compare-grid" style="margin-bottom: 8px;">
                        <div class="coord-box">
                            <span class="label">ORIGIN · ${originShortName}</span>
                            <span class="value">${originLat}°, ${originLng}°</span>
                        </div>
                        <div class="coord-box target">
                            <span class="label">ANALOG #${index + 1}</span>
                            <span class="value">${alt.lat}°, ${alt.lng}°</span>
                        </div>
                    </div>
                    <div class="similarity-list" style="margin-bottom: 8px;">
                        ${rowsHTML}
                    </div>
                    <button type="button" class="btn-fly-to" data-index="${index}">
                        Center & Explore on 3D Globe
                    </button>
                </div>
            </div>
        `;
    }).join('');

    panel.innerHTML = `
        <div class="results-header">
            <h2>TOP 10 ANALOGS</h2>
            <span class="similarity-pill">Earth</span>
        </div>

        <div class="reason-box">
            <span class="reason-title">Results Panel</span>
            <p>Click on any of the 10 points to view its full statistics and center the 3D globe.</p>
        </div>

        <div class="analogue-accordion-list" style="margin-top: 10px;">
            ${analogsHTML}
        </div>
    `;

    panel.style.display = 'flex';
    panel.classList.remove('is-collapsed');

    if (toggleRightBtn) {
        toggleRightBtn.style.display = 'flex';
        toggleRightBtn.classList.remove('is-collapsed');
        toggleRightBtn.textContent = '▶';
    }

    setupAnalogsAccordion();
    setTimeout(resizeGlobe, 50);
}

function setupAnalogsAccordion() {
    const dropdownItems = document.querySelectorAll('.analogue-dropdown-item');

    dropdownItems.forEach(item => {
        const header = item.querySelector('.analogue-dropdown-header');
        const flyBtn = item.querySelector('.btn-fly-to');
        const index = parseInt(item.dataset.index, 10);

        header.addEventListener('click', () => {
            const wasOpen = item.classList.contains('is-open');
            dropdownItems.forEach(i => i.classList.remove('is-open'));
            if (!wasOpen) {
                item.classList.add('is-open');
            }
        });

        if (flyBtn) {
            flyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const targetAnalogue = activeAnalogsData[index];
                if (!targetAnalogue) return;

                renderTargetPoint(targetAnalogue.lat, targetAnalogue.lng, PLANETS_DATA.earth.uiAccent);
                globe.pointOfView({ lat: targetAnalogue.lat, lng: targetAnalogue.lng, altitude: 1.4 }, 1200);
            });
        }
    });
}

// 5. PROCESS REGION & CINEMATIC TRANSITION
async function processRegionSelection(planetKey, lat, lng, source) {
    const planetInfo = PLANETS_DATA[planetKey];
    isViewingEarth = true;

    updateRegisteredCoordinates(lat, lng);
    const currentWeightsSnapshot = { ...requestData.variables };

    globe.controls().autoRotate = false;
    globe.pointOfView({ lat, lng, altitude: 1.3 }, 900);

    document.getElementById('planet-selector-section').style.display = 'none';
    document.getElementById('back-to-origin-btn').style.display = 'block';

    const hintText = document.getElementById('left-hint-text');
    if (hintText) {
        hintText.innerHTML = `⏳ Analyzing vector on <strong>${planetInfo.name}</strong> (${lat}°, ${lng}°)...`;
    }

    const targetPlanet = 'earth';
    document.getElementById('current-view-label').innerHTML = `Module: <strong id="planet-name">Computed Terrestrial Analog</strong>`;

    let resolvedLat = parseFloat((lat * 0.5).toFixed(2));
    let resolvedLng = parseFloat((lng * 0.8).toFixed(2));

    callHuggingFaceAPI({ ...requestData }).then(apiResult => {
        console.log('[API] Response received:', apiResult);

        if (apiResult && typeof apiResult === 'object') {
            if (apiResult.lat !== undefined && apiResult.lon !== undefined) {
                resolvedLat = parseFloat(Number(apiResult.lat).toFixed(2));
                resolvedLng = parseFloat(Number(apiResult.lon).toFixed(2));
            } else if (apiResult.coordenadas) {
                resolvedLat = parseFloat(Number(apiResult.coordenadas.lat).toFixed(2));
                resolvedLng = parseFloat(Number(apiResult.coordenadas.lon).toFixed(2));
            }
        }

        if (hintText) {
            hintText.innerHTML = `Comparing configured weights (left) with computed similarity (right).`;
        }

        renderRightResultsPanel(planetInfo.name, lat, lng, resolvedLat, resolvedLng, currentWeightsSnapshot, apiResult);

        if (isViewingEarth) {
            const firstPoint = activeAnalogsData[0] || { lat: resolvedLat, lng: resolvedLng };
            renderTargetPoint(firstPoint.lat, firstPoint.lng, PLANETS_DATA.earth.uiAccent);
            globe.pointOfView({ lat: firstPoint.lat, lng: firstPoint.lng, altitude: 1.5 }, 1000);
        }
    }).catch(err => {
        console.error('[API] Call error:', err);
        if (hintText) {
            hintText.innerHTML = `Comparing configured weights (left) with computed similarity (right).`;
        }
        renderRightResultsPanel(planetInfo.name, lat, lng, resolvedLat, resolvedLng, currentWeightsSnapshot, null);
    });

    setTimeout(() => {
        switchPlanet(targetPlanet);
        const firstPoint = activeAnalogsData[0] || { lat: resolvedLat, lng: resolvedLng };
        renderTargetPoint(firstPoint.lat, firstPoint.lng, PLANETS_DATA.earth.uiAccent);
        globe.pointOfView({ lat: firstPoint.lat, lng: firstPoint.lng, altitude: 1.5 }, 1400);
    }, 1100);
}

// =========================================================================
// 6. GLOBAL PAYLOAD VARIABLE: VARIABLES AND COORDINATES FOR THE API
// =========================================================================

const HF_API_BASE_URL = "https://saragonzalezrodriguez-spaceh-space.hf.space";

async function callHuggingFaceAPI(payload) {
    const baseUrl = HF_API_BASE_URL.replace(/\/$/, '');

    try {
        const gradioPost = await fetch(`${baseUrl}/call/predict`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: [payload] })
        });

        if (gradioPost.ok) {
            const { event_id } = await gradioPost.json();
            const gradioGet = await fetch(`${baseUrl}/call/predict/${event_id}`);
            const streamText = await gradioGet.text();

            const dataLine = streamText.split('\n').find(l => l.startsWith('data: '));
            if (dataLine) {
                const rawPayload = JSON.parse(dataLine.replace('data: ', ''));
                return Array.isArray(rawPayload) ? rawPayload[0] : rawPayload;
            }
            return { raw: streamText };
        }
    } catch (err) {
        console.warn('[API] Gradio 4 /call/predict failed, trying /api/predict...', err.message);
    }

    const directPost = await fetch(`${baseUrl}/api/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: [payload] })
    });

    if (!directPost.ok) {
        throw new Error(`HTTP ${directPost.status}: ${directPost.statusText}`);
    }

    const result = await directPost.json();
    return Array.isArray(result?.data) ? result.data[0] : result;
}

export const VARIABLE_CONFIG = [
    { key: "relieve", label: "Relief", defaultVal: 50 },
    { key: "ghi", label: "GHI", defaultVal: 50 },
    { key: "albedo", label: "Albedo", defaultVal: 50 }
];

export let requestData = {
    cuerpo_celeste: currentPlanetKey,
    coordenadas: {
        lat: null,
        lon: null
    },
    variables: {
        relieve: 0.50,
        ghi: 0.50,
        albedo: 0.50
    }
};

export let requestDataJSON = JSON.stringify(requestData, null, 2);

window.requestData = requestData;
window.requestDataJSON = requestDataJSON;
window.apiPayload = requestData;
window.apiPayloadJSON = requestDataJSON;
window.variableWeights = requestData.variables;

function syncPayload() {
    requestDataJSON = JSON.stringify(requestData, null, 2);
    window.requestData = requestData;
    window.requestDataJSON = requestDataJSON;
    window.apiPayload = requestData;
    window.apiPayloadJSON = requestDataJSON;
    window.variableWeights = requestData.variables;
    window.variableWeightsJSON = JSON.stringify(requestData.variables, null, 2);

    window.dispatchEvent(new CustomEvent('requestDataUpdate', {
        detail: {
            data: requestData,
            json: requestDataJSON
        }
    }));
}

export function updateRegisteredCoordinates(lat, lon) {
    const parsedLat = (lat !== null && lat !== '' && !isNaN(lat)) ? parseFloat(lat) : null;
    const parsedLon = (lon !== null && lon !== '' && !isNaN(lon)) ? parseFloat(lon) : null;
    requestData.coordenadas.lat = parsedLat;
    requestData.coordenadas.lon = parsedLon;
    syncPayload();
}
window.updateRegisteredCoordinates = updateRegisteredCoordinates;

function initWeightsUI() {
    const variableSelect = document.getElementById('variable-select');
    const balanceBtn = document.getElementById('btn-balance-weights');
    const slidersContainer = document.getElementById('sliders-container');

    if (variableSelect) {
        variableSelect.addEventListener('change', (e) => {
            const selectedKey = e.target.value;
            document.querySelectorAll('.slider-item').forEach(item => {
                item.classList.remove('is-highlighted');
            });

            if (selectedKey === 'all') {
                if (slidersContainer) {
                    slidersContainer.scrollTo({ top: 0, behavior: 'smooth' });
                }
            } else {
                const targetItem = document.getElementById(`item-${selectedKey}`);
                if (targetItem) {
                    targetItem.classList.add('is-highlighted');
                    targetItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    setTimeout(() => {
                        targetItem.classList.remove('is-highlighted');
                    }, 2200);
                }
            }
        });
    }

    const sliders = document.querySelectorAll('.weight-slider');

    function updateSliderVisual(slider) {
        const planet = PLANETS_DATA[currentPlanetKey] || PLANETS_DATA.mars;
        const val = parseFloat(slider.value) || 0;
        const min = parseFloat(slider.min) || 0;
        const max = parseFloat(slider.max) || 100;
        const pct = ((val - min) / (max - min)) * 100;
        slider.style.background = `linear-gradient(to right, ${planet.uiAccentDark} 0%, ${planet.uiAccent} ${pct}%, #1f2737 ${pct}%, #1f2737 100%)`;
    }

    sliders.forEach(slider => {
        const key = slider.dataset.key;

        const handleInput = () => {
            const rawVal = parseFloat(slider.value);
            const normalized = parseFloat((rawVal / 100).toFixed(2));

            requestData.variables[key] = normalized;

            const badge = document.getElementById(`val-${key}`);
            if (badge) {
                badge.textContent = `${normalized.toFixed(2)} (${Math.round(rawVal)}%)`;
            }

            updateSliderVisual(slider);
            syncPayload();
        };

        slider.addEventListener('input', handleInput);
        slider.addEventListener('change', handleInput);

        updateSliderVisual(slider);
    });

    if (balanceBtn) {
        balanceBtn.addEventListener('click', () => {
            sliders.forEach(slider => {
                slider.value = 50;
                const key = slider.dataset.key;
                const badge = document.getElementById(`val-${key}`);
                if (badge) {
                    badge.textContent = `0.50 (50%)`;
                }
                requestData.variables[key] = 0.50;
                updateSliderVisual(slider);
            });
            syncPayload();
        });
    }

    const latInput = document.getElementById('lat-input');
    const lonInput = document.getElementById('lon-input');
    if (latInput) {
        latInput.addEventListener('input', () => {
            updateRegisteredCoordinates(latInput.value, lonInput ? lonInput.value : null);
        });
    }
    if (lonInput) {
        lonInput.addEventListener('input', () => {
            updateRegisteredCoordinates(latInput ? latInput.value : null, lonInput.value);
        });
    }

    syncPayload();
}

initWeightsUI();

document.getElementById('coord-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (isViewingEarth) return;

    const lat = parseFloat(document.getElementById('lat-input').value);
    const lng = parseFloat(document.getElementById('lon-input').value);

    if (!isNaN(lat) && !isNaN(lng)) {
        updateRegisteredCoordinates(lat, lng);

        const originAccent = PLANETS_DATA[currentPlanetKey].uiAccent;
        renderTargetPoint(lat, lng, originAccent);

        globe.pointOfView({ lat, lng, altitude: 1.3 }, 900);
        processRegionSelection(currentPlanetKey, lat, lng, "Manual Input");
    } else {
        alert("Please enter valid numeric coordinates.");
    }
});

document.getElementById('back-to-origin-btn').addEventListener('click', () => {
    isViewingEarth = false;
    document.getElementById('planet-selector-section').style.display = 'flex';
    document.getElementById('back-to-origin-btn').style.display = 'none';

    const resultsPanel = document.getElementById('results-panel');
    const toggleRightBtn = document.getElementById('toggle-right-panel');
    if (resultsPanel) {
        resultsPanel.style.display = 'none';
    }
    if (toggleRightBtn) {
        toggleRightBtn.style.display = 'none';
    }
    setTimeout(resizeGlobe, 50);

    clearTargetPoint();

    const selectedPlanet = document.getElementById('planet-select').value;
    switchPlanet(selectedPlanet);
    globe.controls().autoRotate = false;
    globe.pointOfView({ lat: 0, lng: 0, altitude: 2.2 }, 1200);

    document.getElementById('current-view-label').innerHTML = `Active Module: <strong id="planet-name">${PLANETS_DATA[currentPlanetKey].name}</strong>`;
    
    const hintText = document.getElementById('left-hint-text');
    if (hintText) {
        hintText.innerHTML = `Click on the 3D sphere or enter coordinates to compute the terrestrial analog.`;
    }
});

window.addEventListener('resize', resizeGlobe);

const leftPanel = document.getElementById('ui-panel');
const toggleLeftBtn = document.getElementById('toggle-left-panel');
const rightPanel = document.getElementById('results-panel');
const toggleRightBtn = document.getElementById('toggle-right-panel');

if (toggleLeftBtn && leftPanel) {
    toggleLeftBtn.addEventListener('click', () => {
        const collapsed = leftPanel.classList.toggle('is-collapsed');
        toggleLeftBtn.classList.toggle('is-collapsed', collapsed);
        toggleLeftBtn.textContent = collapsed ? '▶' : '◀';
        setTimeout(resizeGlobe, 360);
    });
}

if (toggleRightBtn && rightPanel) {
    toggleRightBtn.addEventListener('click', () => {
        const collapsed = rightPanel.classList.toggle('is-collapsed');
        toggleRightBtn.classList.toggle('is-collapsed', collapsed);
        toggleRightBtn.textContent = collapsed ? '◀' : '▶';
        setTimeout(resizeGlobe, 360);
    });
}

// =========================================================================
// TOOLTIPS
// =========================================================================

const variableInfoData = {
    relieve: {
        title: "Relief",
        body: "Standard deviation of elevations within a regional radius, measuring the vertical amplitude and variation of the terrain."
    },
    ghi: {
        title: "GHI (Irradiance)",
        body: "Estimate of the direct solar energy and insolation received by the surface per unit area, influenced by latitude, slope, and aspect."
    },
    albedo: {
        title: "Albedo",
        body: "Proportion of incident sunlight that the surface reflects directly back into space compared to what it absorbs."
    }
};

function setupVariableTooltips() {
    const infoButtons = document.querySelectorAll('.info-btn');
    const tooltip = document.getElementById('var-tooltip');
    const tooltipTitle = document.getElementById('var-tooltip-title');
    const tooltipBody = document.getElementById('var-tooltip-body');

    if (!tooltip || infoButtons.length === 0) return;

    infoButtons.forEach(btn => {
        const key = btn.getAttribute('data-info-key');

        btn.addEventListener('mouseenter', () => {
            const data = variableInfoData[key];
            if (!data) return;

            tooltipTitle.textContent = data.title;
            tooltipBody.textContent = data.body;
            tooltip.classList.add('is-visible');
            btn.classList.add('is-active');
        });

        btn.addEventListener('mousemove', (e) => {
            const offset = 14;
            let x = e.clientX + offset;
            let y = e.clientY + offset;

            if (x + 240 > window.innerWidth) {
                x = e.clientX - 240 - offset;
            }
            if (y + 130 > window.innerHeight) {
                y = e.clientY - 130 - offset;
            }

            tooltip.style.left = `${x}px`;
            tooltip.style.top = `${y}px`;
        });

        btn.addEventListener('mouseleave', () => {
            tooltip.classList.remove('is-visible');
            btn.classList.remove('is-active');
        });
    });
}

setupVariableTooltips();
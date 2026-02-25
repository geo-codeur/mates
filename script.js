// ========================================
// CONFIGURATION MAPBOX
// ========================================
const MAPBOX_TOKEN =
  "pk.eyJ1Ijoic2V5ZGljYW0iLCJhIjoiY21oM3VmczNyMWp1czJtcjR1enFhYzg4byJ9.eBCpaqXGBDEbXXTXvL0dgQ";
const MAPBOX_STYLE = "mapbox://styles/seydicam/cmh3v3rzb003801qycynj4kd4";
const INITIAL_CENTER = [49.417, 2.826]; // [lat, lng] pour Leaflet
const INITIAL_ZOOM = 10.5;

// ========================================
// FONCTIONS DE CONVERSION DE COORDONNÉES
// ========================================
// Convertir de Leaflet [lat, lng] vers Mapbox [lng, lat]
function leafletToMapbox(latLng) {
  return [latLng[1], latLng[0]]; // inverse lat/lng
}

// Convertir de Mapbox [lng, lat] vers Leaflet [lat, lng]
function mapboxToLeaflet(lngLat) {
  return [lngLat[1], lngLat[0]]; // inverse lng/lat
}

// ========================================
// VARIABLES GLOBALES
// ========================================
let leafletMap;
let mapboxMap;
let is3DActive = false;
let currentCenter = INITIAL_CENTER; // Toujours en format Leaflet [lat, lng]
let currentZoom = INITIAL_ZOOM;
let mapboxInitialized = false;
let geocoder = null;
let geojsonData, geojsonLayer;

// Éléments DOM
const toggleCheckbox = document.getElementById("toggle-3d-checkbox");
const mapDiv = document.getElementById("map");
const mapboxMapDiv = document.getElementById("mapbox-map");
const loader = document.getElementById("loader");

// ========================================
// INITIALISATION DE LA CARTE LEAFLET (2D)
// ========================================
const map = L.map("map", {
  zoomControl: false,
}).setView(currentCenter, INITIAL_ZOOM);

// Fonds de carte
const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap",
});

const satellite = L.tileLayer(
  "http://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  {
    attribution: "ArcGIS Esri Imagery",
  },
);

const dark = L.tileLayer(
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
);

const googleHybrid = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  {
    attribution: "Tiles © Esri — Source: Esri, IGN",
  },
);

// ✅ NOUVEAU : Esri Light Gray
const esriLightGray = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
  {
    attribution: "Tiles © Esri — Esri, DeLorme, NAVTEQ",
    // maxZoom: 16,
  },
).addTo(map);

const googleLabels = L.tileLayer(
  "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
  {
    attribution: "Labels © Esri",
  },
);

const googleHybridGroup = L.layerGroup([googleHybrid, googleLabels]);

// // Créer un LayerGroup vide pour la couche GeoJSON
// const geojsonLayerGroup = L.layerGroup().addTo(map);

// Fonds de carte
const baseMaps = {
  OpenStreetMap: osm,
  "Image Aérienne": satellite,
  "Carte Sombre": dark,
  "Google Hybrid": googleHybridGroup,
  "Esri Light Gray": esriLightGray,
};

// Contrôles (fonds + surcouches)
L.control.layers(baseMaps).addTo(map);

// 📏 Échelle cartographique
L.control.scale({ imperial: false }).addTo(map);

// Sauvegarder la position lors des déplacements
map.on("moveend", function () {
  const center = map.getCenter();
  currentCenter = [center.lat, center.lng];
  currentZoom = map.getZoom();
  console.log(
    "Position Leaflet mise à jour:",
    currentCenter,
    "Zoom:",
    currentZoom,
  );
});

leafletMap = map; // Référence globale

console.log("Carte Leaflet initialisée");

// ========================================
// INITIALISATION DE LA CARTE MAPBOX (3D)
// ========================================
function initMapboxMap() {
  if (mapboxInitialized) {
    console.log("Mapbox déjà initialisé, synchronisation...");
    syncMapboxPosition();
    return;
  }

  console.log("Initialisation de Mapbox 3D...");
  loader.classList.add("active");

  mapboxgl.accessToken = MAPBOX_TOKEN;

  mapboxMap = new mapboxgl.Map({
    container: "mapbox-map",
    style: MAPBOX_STYLE,
    center: leafletToMapbox(currentCenter), // Conversion [lat,lng] -> [lng,lat]
    zoom: currentZoom,
    pitch: 60,
    bearing: -17,
    antialias: true,
  });

  mapboxMap.dragRotate.enable();
  mapboxMap.touchZoomRotate.enableRotation();

  mapboxMap.addControl(new mapboxgl.NavigationControl());

  // === BARRE DE RECHERCHE GEOCODER ===
  geocoder = new MapboxGeocoder({
    accessToken: MAPBOX_TOKEN,
    mapboxgl: mapboxgl,
    marker: { color: "#FF5733" },
    placeholder: "Rechercher un lieu...",
    language: "fr",
    // countries: "fr",
    proximity: {
      longitude: currentCenter[1], // lng = index 1 de [lat, lng]
      latitude: currentCenter[0], // lat = index 0 de [lat, lng]
    },
  });

  mapboxMap.addControl(geocoder);

  setTimeout(() => {
    const geocoderElement = document.querySelector(".mapboxgl-ctrl-geocoder");
    if (geocoderElement) {
      geocoderElement.classList.add("active");
      console.log("Barre de recherche ajoutée");
    }
  }, 500);

  geocoder.on("result", (e) => {
    console.log("Lieu trouvé:", e.result);
    const [lng, lat] = e.result.center; // Mapbox renvoie [lng, lat]
    currentCenter = [lat, lng]; // On stocke en format Leaflet [lat, lng]

    new mapboxgl.Marker({ color: "#FF5733" })
      .setLngLat([lng, lat]) // Mapbox attend [lng, lat]
      .setPopup(
        new mapboxgl.Popup().setHTML(`<strong>${e.result.place_name}</strong>`),
      )
      .addTo(mapboxMap);
  });

  // Marqueur exemple
  const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(
    "<strong>Vue 3D activée!</strong><br>Utilisez la souris pour explorer.",
  );

  new mapboxgl.Marker({ color: "#FF5733" })
    .setLngLat(leafletToMapbox(currentCenter)) // Conversion pour Mapbox
    .setPopup(popup)
    .addTo(mapboxMap);

  // Chargement du style
  mapboxMap.on("style.load", () => {
    console.log("Style Mapbox chargé");

    try {
      mapboxMap.addSource("mapbox-dem", {
        type: "raster-dem",
        url: "mapbox://mapbox.mapbox-terrain-dem-v1",
        tileSize: 512,
        maxzoom: 14,
      });

      mapboxMap.setTerrain({ source: "mapbox-dem", exaggeration: 0.6 });
      console.log("Terrain 3D ajouté");
    } catch (error) {
      console.warn("Impossible d'ajouter le terrain:", error);
    }

    const layers = mapboxMap.getStyle().layers;
    const labelLayerId = layers.find(
      (layer) => layer.type === "symbol" && layer.layout["text-field"],
    )?.id;

    if (labelLayerId && !mapboxMap.getLayer("3d-buildings")) {
      mapboxMap.addLayer(
        {
          id: "3d-buildings",
          source: "composite",
          "source-layer": "building",
          filter: ["==", "extrude", "true"],
          type: "fill-extrusion",
          minzoom: 15,
          paint: {
            "fill-extrusion-color": "#aaa",
            "fill-extrusion-height": [
              "interpolate",
              ["linear"],
              ["zoom"],
              15,
              0,
              15.05,
              ["get", "height"],
            ],
            "fill-extrusion-base": [
              "interpolate",
              ["linear"],
              ["zoom"],
              15,
              0,
              15.05,
              ["get", "min_height"],
            ],
            "fill-extrusion-opacity": 0.6,
          },
        },
        labelLayerId,
      );
      console.log("Bâtiments 3D ajoutés");
    }

    loader.classList.remove("active");
    mapboxInitialized = true;
  });

  mapboxMap.on("moveend", () => {
    const center = mapboxMap.getCenter(); // Retourne {lng, lat}
    currentCenter = [center.lat, center.lng]; // Stocker en format Leaflet [lat, lng]
    currentZoom = mapboxMap.getZoom();
    console.log(
      "Position Mapbox mise à jour:",
      currentCenter,
      "Zoom:",
      currentZoom,
    );
  });

  mapboxMap.on("error", (e) => {
    console.error("Erreur Mapbox:", e);
    loader.classList.remove("active");
  });
}

// ========================================
// SYNCHRONISATION
// ========================================
function syncMapboxPosition() {
  if (mapboxMap) {
    mapboxMap.setCenter(leafletToMapbox(currentCenter)); // Conversion pour Mapbox
    mapboxMap.setZoom(currentZoom);
    console.log(
      "Position Mapbox synchronisée:",
      currentCenter,
      "Zoom:",
      currentZoom,
    );
  }
}

function toggleGeocoder(show) {
  const geocoderElement = document.querySelector(".mapboxgl-ctrl-geocoder");
  if (geocoderElement) {
    if (show) {
      geocoderElement.classList.add("active");
    } else {
      geocoderElement.classList.remove("active");
    }
  }
}

// ========================================
// BASCULE 2D / 3D
// ========================================
function toggle3DView() {
  is3DActive = toggleCheckbox.checked;

  if (is3DActive) {
    console.log("Activation de la vue 3D...");

    if (!mapboxInitialized) {
      initMapboxMap();
    } else {
      syncMapboxPosition();
      toggleGeocoder(true);
    }

    mapDiv.classList.add("hidden");
    mapboxMapDiv.classList.add("active");

    setTimeout(() => {
      if (mapboxMap) {
        mapboxMap.resize();
      }
    }, 100);
  } else {
    console.log("Retour à la vue 2D...");

    toggleGeocoder(false);
    mapDiv.classList.remove("hidden");
    mapboxMapDiv.classList.remove("active");

    map.setView(currentCenter, currentZoom);

    setTimeout(() => {
      map.invalidateSize();
    }, 100);
  }
}

toggleCheckbox.addEventListener("change", toggle3DView);

// const geojsonUrl =
//   "http://localhost:8080/geoserver/MATES/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=MATES%3Acommunes_arc&outputFormat=application/json";

// ========================================
// FLÈCHE NORD & ÉCHELLE
// ========================================
const north = L.control({ position: "topright" });
north.onAdd = function () {
  const div = L.DomUtil.create("div", "info nort");
  div.innerHTML =
    '<img src="https://cdn.pixabay.com/photo/2013/07/12/13/43/arrow-147174_1280.png" style="width:50px;">';
  return div;
};
north.addTo(map);

// L.control
//   .scale({ metric: true, imperial: false, position: "bottomleft" })
//   .addTo(map);

// ========================================
// MODALE "À PROPOS"
// ========================================
const aboutBtn = document.getElementById("about-btn");
const modal = document.getElementById("aboutModal");
const closeBtn = document.getElementById("closeModal");
const closeLink = document.getElementById("close-link");

aboutBtn.onclick = () => {
  modal.classList.add("show");
  setTimeout(() => {
    modal.style.display = "block";
  }, 10);
};

closeBtn.onclick = () => {
  modal.classList.remove("show");
  setTimeout(() => {
    modal.style.display = "none";
  }, 300);
};

closeLink.onclick = (e) => {
  e.preventDefault();
  modal.classList.remove("show");
  setTimeout(() => {
    modal.style.display = "none";
  }, 300);
};

window.onclick = (event) => {
  if (event.target === modal) {
    modal.classList.remove("show");
    setTimeout(() => {
      modal.style.display = "none";
    }, 300);
  }
};

const structure = {
  ECONOMIE: {
    Pauvreté: "Pauvreté_score",
    Emploi: "Emploi_score",
    "Établissements et Entreprises": "Établissements et Entreprises_score",
    "Emp. Catégorie SP": "Emp. Catégorie SP_score",
    "Commerces et Services": "Commerces et Services_score",
  },
  ENVIRONNEMENT: {
    Eau: "Eau_score",
    Énergie: "Énergie_score",
    Agriculture: "Agriculture_score",
    Déchets: "Déchets_score",
    "Espace vert": "Espace vert_score",
  },
  SOCIAL: {
    Santé: "Santé_score",
    Éducation: "Éducation_score",
    Égalité: "Égalité_score",
    "Protection Sociale": "Protection Sociale_score",
    "Implication citoyenne": "Implication citoyenne_score",
  },
  "CADRE DE VIE": {
    Habitat: "Habitat_score",
  },
  "MOBILITE ET DEPLACEMENT": {
    "Transports collectifs": "Transports collectifs_score",
    "Accès à la mobilité": "Accès à la mobilité_score",
  },
};

const indicateursParSousThematique = {
  Pauvreté: {
    "Revenu disponible": "Rd",
    "Taux de Pauvreté ": "Tp",
    "Taux de privation matérielle et sociale": "Tpms",
    "Médiane du niveau de vie": "Mnv",
    "Part des pensions, retraites et rentes dans le rev. disp": "Pp3rd",
    "Part des indemnités de chômage dans le rev. disp": "Picrd",
    "Part des impôts dans le rev. disp": "Pirv",
  },
  Emploi: {
    "Nb d'emplois au lieu de travail (LT)": "NbeLT",
    "Part des emplois sal. dans le nb d’emplois au LT": "PesNbLT",
    "Part des emplois non sal. dans le nb d’emplois au LT": "PensNbeLT",
    "Salaire net EQTP mensuel moyen": "SnEQTP2m",
    "Salaire net EQTP mensuel moyen  cadres sup": "SnEQTP2mCS",
    "Part des effectifs admin. pub., enseign., santé et act. soc": "PeAdmin",
    "Part des effectifs de l'industrie": "PeIndis",
    "Concentration d'emploi": "CE",
    "Effectifs salariés": "ES",
  },
  "Emp. Catégorie SP": {
    "Part des cadres et prof. intellectuelles sup. dans le nb d’emplois au LT":
      "PcpisNbLT",
    "Part des employés dans le nb d’emplois au LT": "PeNbeLT",
    "Part des ouvriers dans le nb d’emplois au LT ": "PoNbeLT",
  },
  "Commerces et Services": {
    "Banque, caisse d'épargne": "BCE",
    "Supérette - Épicerie": "SE",
    "Boulangerie-pâtisserie": "BP",
    "Unités légales dans commerce de gros & détail, transports, hébergemnt & restauration":
      "Ulctrh",
    "Part des effectifs des commerces, transports, services divers": "PEC",
  },
  "Établissements et Entreprises": {
    "Nombre d'établissements": "NbEtab",
    "Part activités immobilières dans les créations d'ent": "PAICE",
  },
  Agriculture: {
    "Part des effectifs de l'agriculture, sylviculture et pêche ": "PeASP",
  },
  Déchets: {
    "Quantité de déchets produit par habitant ": "QDPH",
    "Taux de recyclage des déchets municipaux": "TRDM",
  },
  Eau: {
    "Taux de rendement des réseaux d'eau potable": "T2rEP",
  },
  Énergie: {
    "Proportion de la population en incapacité de maintenir une température adéquate dans le logement":
      "Ppit",
    "Part des énergies renouvelables dans la consommation finale brute d’énergie":
      "Perc_score",
  },
  "Espace vert": {
    "Part de la population à moins de cinq minutes de marche d’un espace vert":
      "Pp5minEV",
    "Part de la superficie couverte par un espace vert": "PSCEV",
  },
  "Implication citoyenne": {
    "Taux de participation électorale": "TPE",
    "Électeurs inscrits sur liste principale 2024": "EILP",
  },
  Education: {
    "Nb de pers. non scolarisées de 15 ans ou +": "NbPNS15+",
    "Part des non ou peu diplômés dans la pop. non scolarisée de 15 ans ou +":
      "PnpDPNs",
    "École maternelle, primaire, élémentaire": "NbEcol",
    "Collège (en nombre)": "NbC",
    "Lycée (en nombre)": "NbL",
    "Part des non diplômés chez les 20-24 ans sortis des études": "PNDse",
  },
  "Protection Sociale": {
    "Part des personnes de 75 ans ou plus bénéficiant de l'Aide Personnalisée d'Autonomie":
      "PpBAPA_score",
    "Établissement d’accueil du jeune enfant (EAJE) (en nombre)": "EAJE",
  },
  Santé: {
    "Salles multisports (gymnases)": "SM",
    "Médecin généraliste": "MG",
    "Chirurgien dentiste": "CD",
    "Masseur kinésithérapeute": "MKine",
    "Infirmier (en nombre)": "Inf",
    "Pharmacie (en nombre)": "Pha",
    "Espérance de vie des hommes à la naissance": "EspVHn",
    "Espérance de vie des femmes à la naissance ": "EspVFn",
  },
  Egalité: {
    "Taux d'emploi des femmes de 25-54 ans": "TeF",
    "Taux d'emploi des hommes de 25-54 ans ": "TeH",
    "Part de la population éloignée des équipements de proximité": "PpeEp",
  },
  Habitat: {
    "Part des appartements dans le total des logements": "PATotL",
    "Part des résidences principales en suroccupation": "PRppS",
    "Part des rés. principales construites avant 1946": "PRppC1946",
    "Part des rés. secondaires (y compris les logements occasionnels) dans le total des logements ":
      "PRS",
  },
  "Transports collectifs": {
    "Part des actifs occupés de 15 ans ou plus  les transports en commun":
      "PAocTC",
  },
  "Accès à la mobilité": {
    "Part des actifs occ 15 ans ou plus vélo pour travailler": "PAocVT",
    "Part des actifs occ 15 ans ou plus voiture pour travailler": "PAocVeT",
    "Part des ménages ayant au moins 1 voiture": "PMayV",
  },
};

// Nouvelle structure où chaque sous-thématique référence les bons champs "_score"
const structureScore = {};

for (const thematique in structure) {
  structureScore[thematique] = {};

  for (const sousThematique in structure[thematique]) {
    const indicateurs = indicateursParSousThematique[sousThematique];
    if (!indicateurs) continue;

    const champsScore = Object.values(indicateurs).map((nom) => `${nom}_score`);
    structureScore[thematique][sousThematique] = champsScore;
  }
}

const indicateursScoreParSousThematique = {};

for (const sousThematique in indicateursParSousThematique) {
  indicateursScoreParSousThematique[sousThematique] = {};
  const indicateurs = indicateursParSousThematique[sousThematique];
  for (const label in indicateurs) {
    const cleBrute = indicateurs[label]; // ex: "Teh"
    const cleScore = cleBrute + "_score"; // ex: "Teh_score"
    indicateursScoreParSousThematique[sousThematique][label] = cleScore;
  }
}

const indicateurToStructure = {};

for (const thematique in structure) {
  for (const sousThematique in structure[thematique]) {
    const indicateurs = indicateursParSousThematique[sousThematique];
    for (const label in indicateurs) {
      const key = indicateurs[label];
      indicateurToStructure[key] = {
        thematique,
        sousThematique,
      };
    }
  }
}

const bornesIndicateurs = {
  Tp: { min: 0, max: 100 },
  Rd: { min: 0, max: 35000 },
  Tpms: { min: 0, max: 100 },
  PRppS: { min: 0, max: 100 },
  PRppC1946: { min: 0, max: 100 },
  PRS: { min: 0, max: 100 },
  Mnv: { min: 0, max: 35000 },
  TPE: { min: 0, max: 100 },
  Pp3rd: { min: 0, max: 100 },
  Picrd: { min: 0, max: 100 },
  Pirv: { min: 0, max: 100 },
  EILP: { min: 0, max: 25000 },
  "NbPNS15+": { min: 0, max: 100 },
  PnpDPNs: { min: 0, max: 100 },
  NbeLT: { min: 0, max: 27000 },
  PesNbLT: { min: 0, max: 100 },
  PensNbeLT: { min: 0, max: 100 },
  PcpisNbLT: { min: 0, max: 100 },
  PeNbeLT: { min: 0, max: 100 },
  PoNbeLT: { min: 0, max: 100 },
  SnEQTP2m: { min: 0, max: 2600 },
  SnEQTP2mCS: { min: 0, max: 4500 },
  Ulctrh: { min: 0, max: 1000 },
  NbEtab: { min: 0, max: 1700 },
  PeASP: { min: 0, max: 100 },
  PeIndis: { min: 0, max: 100 },
  PEC: { min: 0, max: 100 },
  PeAdmin: { min: 0, max: 100 },
  BCE: { min: 0, max: 30 },
  SE: { min: 0, max: 30 },
  BP: { min: 0, max: 30 },
  NbEcol: { min: 0, max: 40 },
  NbC: { min: 0, max: 10 },
  NbL: { min: 0, max: 10 },
  SM: { min: 0, max: 10 },
  MG: { min: 0, max: 100 },
  CD: { min: 0, max: 40 },
  MKine: { min: 0, max: 40 },
  Inf: { min: 0, max: 50 },
  Pha: { min: 0, max: 20 },
  EAJE: { min: 0, max: 10 },
  PAocTC: { min: 0, max: 100 },
  PAocVT: { min: 0, max: 100 },
  PAocVeT: { min: 0, max: 100 },
  PMayV: { min: 0, max: 100 },
  EspVHn: { min: 0, max: 100 },
  EspVFn: { min: 0, max: 100 },
  PpBAPA: { min: 0, max: 100 },
  TeF: { min: 0, max: 100 },
  TeH: { min: 0, max: 100 },
  PpeEp: { min: 0, max: 100 },
  PATotL: { min: 0, max: 100 },
  CE: { min: 0, max: 300 },
  PAICE: { min: 0, max: 100 },
  ES: { min: 0, max: 30000 },
  QDPH: { min: 0, max: 600 },
  TRDM: { min: 0, max: 100 },
  T2rEP: { min: 0, max: 100 },
  Perc: { min: 0, max: 100 },
  Ppit: { min: 0, max: 100 },
  PNDse: { min: 0, max: 100 },
  Pp5minEV: { min: 0, max: 100 },
  PSCEV: { min: 0, max: 100 },
};

// Générer tous les indicateurs et leurs clés (étiquette + champ)
const getAllIndicators = () => {
  const result = [];
  for (const [sousThematique, indicateurs] of Object.entries(
    indicateursParSousThematique,
  )) {
    for (const [label, key] of Object.entries(indicateurs)) {
      result.push({ label, key, sousThematique });
    }
  }
  return result;
};

// 📦 Variables globales pour les graphiques et sélection
let radarChartMain;
let radarChartSub;
let valeursInitiales = {};
let geojson;
let propsGlobaux = {}; // Valeurs initiales vides ou importées d'une commune
let selectedLayers = []; // Liste des communes sélectionnées (max 6)
let radarChart;
const COLORS = [
  "rgba(54, 162, 235, 1)", // Bleu
  "rgba(255, 99, 132, 1)", // Rouge
  "rgba(75, 192, 192, 1)", // Vert turquoise
  "rgba(255, 206, 86, 1)", // Jaune
  "rgba(153, 102, 255, 1)", // Violet
  "rgba(255, 159, 64, 1)", // Orange
];

// 🎯 Créer le radar principal (scores thématiques)
function createRadarChart(props) {
  const labels = [
    "ECONOMIE",
    "ENVIRONNEMENT",
    "SOCIAL",
    "CADRE DE VIE",
    "MOBILITE ET DEPLACEMENT",
  ];
  const data = labels.map((t) => props[`${t}_score`] || 0);

  const ctx = document.getElementById("radarChart").getContext("2d");

  if (radarChartMain) radarChartMain.destroy();

  radarChartMain = new Chart(ctx, {
    type: "radar",
    data: {
      labels: labels,
      datasets: [
        {
          label: props.NOM || "Commune",
          data: data,
          backgroundColor: "rgba(54, 162, 235, 0.2)",
          borderColor: "rgba(54, 162, 235, 1)",
          pointBackgroundColor: "rgba(54, 162, 235, 1)",
        },
      ],
    },
    options: {
      scales: {
        r: {
          beginAtZero: true,
          max: 100,
          ticks: { display: false },
          pointLabels: {
            font: {
              size: 8, // 🔠 Taille de la police
              family: "Cambria", // 🆎 Police personnalisée
              weight: "bold", // (optionnel) épaisseur
            },
            color: "#333", // 🎨 Couleur du texte
          },
        },
      },
      plugins: {
        legend: {
          display: true,
          labels: {
            font: {
              size: 14, // 🔠 Taille de la police
              family: "Cambria", // 🆎 Police de ton choix
              weight: "bold", // optionnel
            },
            color: "#333", // 🎨 Couleur de texte
          },
        },
        title: {
          display: true,
          text: "Scores par thématique",
          font: {
            size: 16,
            family: "Cambria",
            weight: "bold",
          },
          color: "#111",
        },
      },

      onClick: (evt, elements) => {
        if (elements.length > 0) {
          const idx = elements[0].index;
          const thematique = labels[idx];
          showSubRadar(thematique, props);
        }
      },
    },
  });
}

// 🆕 Afficher le radar des sous-thématiques
function showSubRadar(thematique, props) {
  const sousThemes = structure[thematique];
  if (!sousThemes) return;

  const labels = Object.keys(sousThemes);
  const data = labels.map((label) => props[sousThemes[label]] || 0);

  const container = document.getElementById("subRadarContainer");
  container.classList.add("visible");
  container.style.opacity = 1;

  // Attendre un petit moment que le DOM affiche le canvas (très rapide)
  setTimeout(() => {
    const ctxSub = document.getElementById("radarSubChart").getContext("2d");

    if (radarChartSub) radarChartSub.destroy();

    radarChartSub = new Chart(ctxSub, {
      type: "radar",
      data: {
        labels: labels,
        datasets: [
          {
            label: `Sous-thématiques de ${thematique}`,
            data: data,
            backgroundColor: "rgba(255, 99, 132, 0.2)",
            borderColor: "rgba(255, 99, 132, 1)",
            pointBackgroundColor: "rgba(255, 99, 132, 1)",
          },
        ],
      },
      options: {
        scales: {
          r: {
            beginAtZero: true,
            max: 100,
            ticks: { display: false },
            pointLabels: {
              font: {
                size: 11, // 🔠 Taille de la police
                family: "Cambria", // 🆎 Police personnalisée
                weight: "bold", // (optionnel) épaisseur
              },
              color: "#333", // 🎨 Couleur du texte
            },
          },
        },
        plugins: {
          legend: {
            display: true,
            labels: {
              font: {
                size: 12, // 🔠 Taille de police visible
                family: "Rockwell", // 🆎 Police personnalisée
                weight: "bold", // (optionnel)
              },
              color: "#333", // 🎨 Couleur du texte
            },
          },
          title: {
            display: true,
            font: {
              size: 11, // 🔠 Taille de la police
              family: "Cambria", // 🆎 Police personnalisée
              weight: "bold", // (optionnel) épaisseur
            },
          },
        },
        onClick: (evt, elements) => {
          if (elements.length > 0) {
            const idx = elements[0].index;
            const sousThematique = labels[idx];
            showIndicatorsList(sousThematique, props);
          }
        },
      },
    });
  }, 50); // Attente de 50ms pour que le canvas soit prêt

  document.getElementById("subRadarContainer").style.display = "block";
}

function showIndicatorsList(sousThematique, props) {
  const indicateurs = indicateursParSousThematique[sousThematique];
  const container = document.getElementById("indicatorList");
  const block = document.getElementById("indicatorListContainer");

  container.innerHTML = ""; // Réinitialise la liste

  if (!indicateurs) {
    block.style.display = "none";
    return;
  }

  for (const [label, key] of Object.entries(indicateurs)) {
    const value = props[key];
    const li = document.createElement("li");
    li.textContent = `${label} : ${value !== undefined ? value : "Non disponible"}`;
    container.appendChild(li);
  }

  block.style.display = "block";
}

// ============================================================
// 1. FONCTIONS ET ÉCOUTEURS GLOBAUX (Définis une seule fois)
// ============================================================

function showInfoSidebar(properties) {
  const sidebar = document.getElementById("infoSidebar");
  const content = document.getElementById("infoCommuneContent");
  const title = document.getElementById("infoCommuneNom");

  if (title) title.innerText = properties.NOM || "Détails";
  if (!content) return;

  content.innerHTML = "";

  // 1. Définition de la structure des thématiques et leurs sous-thématiques
  const structure = {
    ECONOMIE: [
      "Pauvreté",
      "Emploi",
      "Emp. Catégorie SP",
      "Commerce et services",
      "Établissements et Entreprises",
    ], // Ajoutez vos noms exacts du GeoJSON
    ENVIRONNEMENT: [
      "Agriculture",
      "Déchet",
      "Eau",
      "Énergie",
      "Énergie",
      "Espace vert",
    ],
    SOCIAL: [
      "Santé",
      "Education",
      "Protection Sociale",
      "Implication citoyenne",
      "Egalité",
    ],
    "CADRE DE VIE": ["Habitat"],
    "MOBILITE ET DEPLACEMENT": ["Transports collectifs", "Accès à la mobilité"],
  };

  // 2. Création des sections thématiques
  Object.entries(structure).forEach(([thematique, sousThemes]) => {
    const themeSection = document.createElement("div");
    themeSection.style.marginBottom = "20px";

    // Titre de la thématique avec le score global de la thématique
    const themeScore = properties[`${thematique}_score`]?.toFixed(1) || "N/A";
    themeSection.innerHTML = `
            <div style="background: #f0f4f8; padding: 10px; border-radius: 5px; display: flex; justify-content: space-between; align-items: center; border-left: 5px solid #007bff;">
                <span style="font-weight: bold; color: #333;">${thematique}</span>
                <span style="background: #007bff; color: white; padding: 2px 8px; border-radius: 10px; font-size: 11px;">${themeScore}</span>
            </div>
            <div class="sub-theme-container" style="padding-left: 10px; margin-top: 5px;"></div>
        `;

    const subContainer = themeSection.querySelector(".sub-theme-container");

    // Ajout des sous-thématiques appartenant à ce groupe
    sousThemes.forEach((st) => {
      const scoreVal = properties[`${st}_score`]; // On cherche la propriété Score associée
      if (scoreVal !== undefined) {
        const row = document.createElement("div");
        row.className = "property-row";
        row.style.padding = "5px 0";
        row.innerHTML = `
                    <span class="property-key" style="font-size: 11px; color: #666;">${st.replace(/_/g, " ")}</span>
                    <span class="property-value" style="font-size: 11px;">${scoreVal.toFixed(1)}</span>
                `;
        subContainer.appendChild(row);
      }
    });

    content.appendChild(themeSection);
  });

  // 3. Section "Informations Générales" (pour NOM, CODE_INSEE, etc.)
  const generalSection = document.createElement("div");
  generalSection.innerHTML = `<h4 style="border-bottom: 1px solid #ccc; margin-top: 20px;">Informations Générales</h4>`;

  const generalFields = ["NOM", "CODE_INSEE", "Indicateur_Composite_score"];
  generalFields.forEach((field) => {
    if (properties[field]) {
      const row = document.createElement("div");
      row.className = "property-row";
      row.innerHTML = `
                <span class="property-key">${field}</span>
                <span class="property-value">${properties[field]}</span>
            `;
      generalSection.appendChild(row);
    }
  });
  content.appendChild(generalSection);

  sidebar.style.display = "block";
}

// Écouteur global : détecte l'ouverture de n'importe quel popup
map.on("popupopen", function (e) {
  // Récupère les propriétés de la source (la couche GeoJSON cliquée)
  const props = e.popup._source.feature.properties;

  // Attache l'événement au bouton "Toutes les propriétés" présent dans le popup
  const btn = document.querySelector(".view-details-btn");
  if (btn) {
    btn.onclick = function () {
      showInfoSidebar(props);
    };
  }
});

// Gestion du bouton de fermeture de la sidebar d'infos
const closeInfoBtn = document.getElementById("closeInfoSidebar");
if (closeInfoBtn) {
  closeInfoBtn.onclick = () => {
    document.getElementById("infoSidebar").style.display = "none";
  };
}

// ============================================================
// 2. CHARGEMENT DU GEOJSON ET INTERACTIONS
// ============================================================

fetch("./ScoreGlobale_indic.geojson")
  .then((res) => res.json())
  .then((data) => {
    geojson = L.geoJSON(data, {
      style: function (feature) {
        const score = feature.properties.Indicateur_Composite_score || 0;
        function getColor(score) {
          return score > 50
            ? "#1a9850"
            : score > 40
              ? "#66bd63"
              : score > 35
                ? "#fee08b"
                : score > 30
                  ? "#f46d43"
                  : "#d73027";
        }
        return {
          fillColor: getColor(score),
          color: "#333",
          weight: 1,
          fillOpacity: 0.7,
        };
      },
      onEachFeature: function (feature, layer) {
        const props = feature.properties;

        // Normalisation CODE_INSEE
        if (props.CODE_INSEE) {
          props.CODE_INSEE = String(props.CODE_INSEE);
        }

        // Étiquette (Label)
        if (props.NOM) {
          layer.bindTooltip(props.NOM, {
            permanent: true,
            direction: "center",
            className: "commune-label",
          });
        }

        // --- POPUP AVEC VOTRE STYLE ORIGINAL ET BARRE DE PROGRESSION ---
        const popupContent = `
                    <div style="font-family: system-ui, -apple-system, sans-serif;">
                        <h4 style="margin: 0 0 10px 0;">${props.NOM || "Commune"}</h4>
                        
                        <button class="view-details-btn" 
                                style="width: 100%; margin-bottom: 15px; padding: 10px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
                            <i class="fa-solid fa-circle-info"></i> Toutes les propriétés
                        </button>

                        ${[
                          "ECONOMIE",
                          "ENVIRONNEMENT",
                          "SOCIAL",
                          "CADRE DE VIE",
                          "MOBILITE ET DEPLACEMENT",
                        ]
                          .map(
                            (key) => `
                                <div style="display: flex; justify-content: space-between; margin: 4px 0;">
                                    <span>${key.replace("_score", "")} :</span>
                                    <strong>${props[`${key}_score`]?.toFixed(1)}</strong>
                                </div>
                            `,
                          )
                          .join("")}
                        
                        <div style="margin-top: 15px; padding-top: 15px; border-top: 2px solid #f0f0f0;">
                            <div style="display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 8px;">
                                <span>Score global</span>
                                <span>${props.Indicateur_Composite_score?.toFixed(1)}/100</span>
                            </div>
                            
                            <div style="background: linear-gradient(90deg, #ef4444 0%, #f46d43 25%, #fee08b 50%, #66bd63 75%, #1a9850 100%); 
                                        height: 8px; border-radius: 4px; margin: 10px 0; position: relative;">
                                <div style="position: absolute; left: ${props.Indicateur_Composite_score || 0}%; 
                                            top: -4px; width: 16px; height: 16px; background: white; 
                                            border: 3px solid #1f2937; border-radius: 50%; 
                                            transform: translateX(-50%);"></div>
                            </div>
                        </div>
                    </div>
                `;

        layer.bindPopup(popupContent);

        // --- GESTION DU CLIC (COMPARISON SIDEBAR DROITE) ---
        layer.on("click", () => {
          communeSelectionnee = feature;
          const index = selectedLayers.findIndex(
            (entry) => entry.layer === layer,
          );

          if (index !== -1) {
            geojson.resetStyle(layer);
            selectedLayers.splice(index, 1);
          } else {
            if (selectedLayers.length >= 6) {
              alert("Maximum 6 communes sélectionnées.");
              return;
            }
            layer.setStyle({
              weight: 4,
              color: COLORS[selectedLayers.length % COLORS.length],
              fillOpacity: 0.7,
            });
            selectedLayers.push({ layer, props: props });
          }

          const sidebar = document.getElementById("sidebar");
          if (selectedLayers.length > 0) {
            sidebar.style.display = "block";
            setTimeout(() => {
              updateRadarComparisonChart();
            }, 50);
          } else {
            sidebar.style.display = "none";
          }
        });
      },
    }).addTo(map);
  })
  .catch((err) => console.error("Erreur chargement GeoJSON :", err));
// Force Leaflet à recalculer la taille du div #map
map.invalidateSize();

// Centrage avec un délai pour laisser le temps au navigateur
setTimeout(() => {
  map.fitBounds(geojson.getBounds(), {
    padding: [50, 50],
    animate: false,
  });
}, 200);

// ========================================
// TÉLÉCHARGEMENT DES DONNÉES
// ========================================

// 📥 Variable globale pour stocker la commune sélectionnée
let communeSelectionnee = null;

// 📥 Fonction pour télécharger en CSV
function downloadCSV() {
  if (!communeSelectionnee) {
    alert("Aucune commune sélectionnée");
    return;
  }

  const props = communeSelectionnee.properties;

  // Créer l'en-tête CSV
  const headers = Object.keys(props).join(";");

  // Créer la ligne de données
  const values = Object.values(props)
    .map((val) => {
      // Gérer les valeurs avec des virgules ou des guillemets
      if (typeof val === "string" && (val.includes(";") || val.includes('"'))) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      // Remplacer les points par des virgules pour les nombres (format français)
      if (typeof val === "number") {
        return String(val).replace(".", ",");
      }
      return val !== null && val !== undefined ? val : "";
    })
    .join(";");

  // Construire le CSV avec BOM UTF-8 pour Excel
  const csv = headers + "\n" + values;

  // Créer le blob et télécharger
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  const nomCommune = props.NOM || "commune";
  const nomFichier = nomCommune.replace(/[^a-z0-9]/gi, "_").toLowerCase();

  link.setAttribute("href", url);
  link.setAttribute("download", `${nomFichier}_donnees.csv`);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Nettoyer l'URL
  setTimeout(() => URL.revokeObjectURL(url), 100);

  console.log(`✅ CSV téléchargé pour ${nomCommune}`);
}

// 📥 Fonction pour télécharger en GeoJSON
function downloadGeoJSON() {
  if (!communeSelectionnee) {
    alert("Aucune commune sélectionnée");
    return;
  }

  // Créer un GeoJSON avec uniquement la commune sélectionnée
  const geoJsonCommune = {
    type: "FeatureCollection",
    features: [communeSelectionnee],
  };

  // Convertir en JSON string avec indentation lisible
  const json = JSON.stringify(geoJsonCommune, null, 2);

  // Créer le blob et télécharger
  const blob = new Blob([json], {
    type: "application/geo+json;charset=utf-8;",
  });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  const nomCommune = communeSelectionnee.properties.NOM || "commune";
  const nomFichier = nomCommune.replace(/[^a-z0-9]/gi, "_").toLowerCase();

  link.setAttribute("href", url);
  link.setAttribute("download", `${nomFichier}_donnees.geojson`);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Nettoyer l'URL
  setTimeout(() => URL.revokeObjectURL(url), 100);

  console.log(`✅ GeoJSON téléchargé pour ${nomCommune}`);
}

// 🔗 Event listeners pour les boutons
document.getElementById("downloadCSV").addEventListener("click", downloadCSV);
document
  .getElementById("downloadGeoJSON")
  .addEventListener("click", downloadGeoJSON);

// ========================================
// RECHERCHE DE COMMUNES (ADAPTÉ)
// ========================================
const searchInput = document.getElementById("search-input");
const searchButton = document.getElementById("search-button");
const searchResults = document.getElementById("search-results");

function searchCommunes(query) {
  // ✅ Utiliser 'geojson' au lieu de 'geojsonData'
  if (!geojson || !query.trim()) {
    searchResults.innerHTML = "";
    searchResults.classList.remove("show");
    return;
  }

  const normalizedQuery = query.toLowerCase();
  const results = [];

  // ✅ Parcourir les couches Leaflet au lieu de geojsonData.features
  geojson.eachLayer((layer) => {
    const nom = (layer.feature.properties.NOM || "").toLowerCase();
    if (nom.includes(normalizedQuery)) {
      results.push(layer);
    }
  });

  displaySearchResults(results);
}

function displaySearchResults(results) {
  searchResults.innerHTML = "";

  if (results.length === 0) {
    searchResults.innerHTML =
      '<div class="no-results">Aucune commune trouvée</div>';
    searchResults.classList.add("show");
    return;
  }

  results.forEach((layer) => {
    const nom = layer.feature.properties.NOM || "Sans nom";
    const item = document.createElement("div");
    item.className = "search-result-item";
    item.textContent = nom;

    item.addEventListener("click", () => {
      zoomToFeature(layer);
      searchResults.classList.remove("show");
      searchInput.value = nom;
    });

    searchResults.appendChild(item);
  });

  searchResults.classList.add("show");
}

function zoomToFeature(layer) {
  // ✅ Utiliser directement le layer passé en paramètre
  if (!layer || !layer.getBounds) {
    console.error("❌ Layer invalide");
    return;
  }

  // Zoom sur la commune
  map.fitBounds(layer.getBounds(), {
    padding: [100, 100],
    maxZoom: 13,
  });

  // Ouvrir le popup
  layer.openPopup();

  // Highlight temporaire
  layer.setStyle({
    weight: 5,
    color: "#ff0000",
    fillColor: "#ff6600",
    fillOpacity: 0.8,
  });

  // // Remettre le style d'origine après 2 secondes
  // setTimeout(() => {
  //   geojson.resetStyle(layer);
  // }, 2000);
}

// Event listeners
searchInput.addEventListener("input", (e) => searchCommunes(e.target.value));
searchButton.addEventListener("click", () => searchCommunes(searchInput.value));
searchInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    searchCommunes(searchInput.value);
  }
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".search-container")) {
    searchResults.classList.remove("show");
  }
});

// 🧩 Mise à jour avec le type LINE et Scale Option Configuration
function updateRadarComparisonChart() {
  const canvas = document.getElementById("radarChart");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const labels = [
    "ECONOMIE",
    "ENVIRONNEMENT",
    "SOCIAL",
    "CADRE DE VIE",
    "MOBILITE ET DEPLACEMENT",
  ];

  const datasets = selectedLayers.map((entry, i) => {
    const data = labels.map(
      (thematique) => entry.props[`${thematique}_score`] || 0,
    );

    // --- AJOUT DU SCORE GLOBAL DANS LE LABEL ---
    const nomCommune =
      entry.props.NOM || entry.props.NOM_COM || `Commune ${i + 1}`;
    const scoreGlobal = entry.props.Indicateur_Composite_score
      ? entry.props.Indicateur_Composite_score.toFixed(1)
      : "0.0";

    return {
      label: `${nomCommune} (Score global: ${scoreGlobal})`, // Affichage combiné
      data: data,
      borderColor: COLORS[i % COLORS.length],
      backgroundColor: COLORS[i % COLORS.length].replace("1)", "0.1)"),
      borderWidth: 3,
      tension: 0.3,
      pointRadius: 5,
      pointHoverRadius: 8,
      fill: true,
    };
  });

  if (radarChart) {
    radarChart.destroy();
  }

  radarChart = new Chart(ctx, {
    type: "bar", // Ou "line" selon votre préférence précédente
    data: {
      labels: labels,
      datasets: datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          ticks: {
            stepSize: 20,
            font: { size: 10 },
          },
          title: {
            display: true,
            text: "Scores du bien-être",
            font: { family: "Cambria", size: 12, weight: "bold" },
          },
        },
        x: {
          ticks: {
            font: { family: "Cambria", size: 9 },
          },
        },
      },
      plugins: {
        legend: {
          position: "top",
          labels: {
            font: { family: "Rockwell", size: 11 },
            boxWidth: 12, // Réduit un peu la taille des carrés de couleur pour laisser de la place au texte
          },
        },
        title: {
          display: true,
          text: "Profil comparatif des communes sélectionnées",
          font: { size: 15, family: "Cambria", weight: "bold" },
        },
        tooltip: {
          mode: "index",
          intersect: false,
        },
      },
    },
  });
}

//       // ✅ Affichage des sous-thématiques au clic sur une thématique
//       onClick: (evt, elements, chart) => {
//         const points = chart.getElementsAtEventForMode(
//           evt,
//           "nearest",
//           { intersect: false },
//           true,
//         );
//         if (points.length > 0 && selectedLayers.length > 0) {
//           const idx = points[0].index;
//           const thematique = labels[idx];
//           const firstCommune = selectedLayers[0].props;
//           showSubRadar(thematique, firstCommune);
//         }
//       },
//     },
//   });

//   // 🔄 Cacher le radar 2 si rien n’est sélectionné
//   if (selectedLayers.length === 0) {
//     document.getElementById("subRadarContainer").classList.remove("visible");
//   }
// }

// 🔄 Fonction de réinitialisation des sélections
function resetSelection() {
  // Réinitialiser le style des couches sélectionnées
  selectedLayers.forEach((entry) => {
    geojson.resetStyle(entry.layer);
  });

  // Vider la sélection
  selectedLayers = [];

  // Détruire le radar de comparaison (radar 1)
  if (radarChart) {
    radarChart.destroy();
    radarChart = null;
  }

  // Détruire le radar des sous-thématiques (radar 2)
  if (radarChartSub) {
    radarChartSub.destroy();
    radarChartSub = null;
  }

  // Cacher la sidebar
  document.getElementById("sidebar").style.display = "none";

  // Cacher le conteneur du radar 2
  document.getElementById("subRadarContainer").classList.remove("visible");
}

document.getElementById("resetButton").onclick = resetSelection;

// 🔐 Fermer la sidebar
document.getElementById("closeSidebar").onclick = function () {
  document.getElementById("sidebar").style.display = "none";
};

function showAllIndicatorEditor(props) {
  currentProps = props;
  propsGlobaux = { ...props };
  valeursInitiales = {};
  for (const key in bornesIndicateurs) {
    if (props.hasOwnProperty(key)) {
      valeursInitiales[key] = props[key]; // Stocke la valeur initiale
    }
  }

  const container = document.getElementById("indicatorEditorContent");
  container.innerHTML = ""; // Reset

  // Parcours de la structure thématique
  for (const thematique in structure) {
    // Créer un titre pour la thématique
    const thematiqueTitle = document.createElement("h3");
    thematiqueTitle.textContent = thematique;
    thematiqueTitle.style.marginTop = "20px";
    container.appendChild(thematiqueTitle);

    const sousThematiqueObj = structure[thematique];

    // Parcours des sous-thématiques de la thématique
    for (const sousThematique in sousThematiqueObj) {
      // Créer un sous-titre pour la sous-thématique
      const sousThematiqueTitle = document.createElement("h4");
      sousThematiqueTitle.textContent = sousThematique;
      sousThematiqueTitle.style.marginLeft = "10px";
      sousThematiqueTitle.style.marginTop = "10px";
      sousThematiqueTitle.style.color = "#444";
      container.appendChild(sousThematiqueTitle);

      // Récupérer les indicateurs correspondants à la sous-thématique
      const indicateurs = indicateursParSousThematique[sousThematique];

      if (!indicateurs) continue; // pas d'indicateurs pour cette sous-thématique

      // Parcourir chaque indicateur
      for (const label in indicateurs) {
        const key = indicateurs[label];
        const scoreKey = key + "_score";
        const scoreKeyLower = key.toLowerCase() + "_score";
        const value =
          props[scoreKey] ?? props[scoreKeyLower] ?? props[key] ?? 0;

        const borne = bornesIndicateurs[key] ?? { min: 0, max: 100 };
        const minVal = borne.min;
        const maxVal = borne.max;

        // Wrapper du contrôle
        const wrapper = document.createElement("div");
        wrapper.style.marginLeft = "20px";
        wrapper.style.marginBottom = "8px";

        // Label de l'indicateur
        const lbl = document.createElement("label");
        lbl.textContent = label;
        lbl.style.fontSize = "13px";
        lbl.style.fontFamily = "Cambria, Rockwell";
        lbl.style.display = "block";
        lbl.style.marginBottom = "3px";

        // Container avec labels min/max
        const rangeContainer = document.createElement("div");
        rangeContainer.style.display = "flex";
        rangeContainer.style.alignItems = "center";
        rangeContainer.style.gap = "10px";

        // Label "Min" avec valeur réelle
        const minLabel = document.createElement("span");
        minLabel.textContent = Math.round(minVal);
        minLabel.style.fontSize = "12px";
        minLabel.style.width = "40px";
        minLabel.style.textAlign = "right";
        minLabel.style.color = "#666";

        // Label "Max" avec valeur réelle
        const maxLabel = document.createElement("span");
        maxLabel.textContent = Math.round(maxVal);
        maxLabel.style.fontSize = "12px";
        maxLabel.style.width = "40px";
        maxLabel.style.textAlign = "left";
        maxLabel.style.color = "#666";

        // Jauge
        const input = document.createElement("input");
        input.type = "range";
        input.min = minVal;
        input.max = maxVal;
        input.step = 0.1;
        input.value = value;
        input.dataset.key = key;
        input.style.flexGrow = "1";

        rangeContainer.appendChild(minLabel);
        rangeContainer.appendChild(input);
        rangeContainer.appendChild(maxLabel);

        // Événement
        input.oninput = function () {
          const entry = selectedLayers.find((e) => e.props.nom === props.nom);
          if (entry) {
            entry.props[key] = parseFloat(this.value);
            updateScores(entry.props);
          } else {
            console.warn("❌ Commune non trouvée pour", props.nom);
          }
        };

        wrapper.appendChild(lbl);
        wrapper.appendChild(rangeContainer);
        container.appendChild(wrapper);
      }
    }
  }

  // Afficher la sidebar et masquer le bouton
  document.getElementById("indicatorEditorSidebar").style.display = "block";
  document.getElementById("openSimulationBtn").style.display = "none";
  document.getElementById("mainLegend").style.display = "none";
  document.getElementById("simulationLegend").style.display = "block";
}

document.getElementById("resetSimulation").addEventListener("click", () => {
  const entry = selectedLayers.find(
    (e) => e.props.CODE_INSEE === currentProps.CODE_INSEE,
  );
  if (!entry) return;

  for (const key in valeursInitiales) {
    const val = valeursInitiales[key];
    entry.props[key] = val;

    // Mets à jour l'input correspondant si présent
    const input = document.querySelector(`input[data-key="${key}"]`);
    if (input) {
      input.value = val;
    }
  }

  updateScores(entry.props);
});

// 👉 Sens des indicateurs (positif ou négatif)
const sensIndicateurs = {
  MKine: "positif",
  CD: "positif",
  MG: "positif",
  Rd: "positif",
  SM: "positif",
  EAJE: "positif",
  PpBAPA: "positif",
  NbL: "positif",
  NbC: "positif",
  NbEcol: "positif",
  EILP: "positif",
  TPE: "positif",
  Perc: "positif",
  T2rEP: "positif",
  TRDM: "positif",
  PeASP: "positif",
  PAICE: "positif",
  PEC: "positif",
  NbEtab: "positif",
  Ulctrh: "positif",
  BP: "positif",
  SE: "positif",
  BCE: "positif",
  PoNbeLT: "positif",
  PeNbeLT: "positif",
  PcpisNbLT: "positif",
  ES: "positif",
  CE: "positif",
  PeIndis: "positif",
  PeAdmin: "positif",
  SnEQTP2mCS: "positif",
  SnEQTP2m: "positif",
  PesNbLT: "positif",
  NbeLT: "positif",
  Picrd: "positif",
  Pp3rd: "positif",
  Mnv: "positif",
  Inf: "positif",
  Pha: "positif",
  EspVHn: "positif",
  EspVFn: "positif",
  TeF: "positif",
  TeH: "positif",
  PATotL: "positif",
  PRS: "positif",
  PAocTC: "positif",
  PAocVT: "positif",
  PAocVeT: "positif",
  PMayV: "positif",
  Pp5minEV: "positif",
  PSCEV: "positif",

  Tp: "negatif",
  Tpms: "negatif",
  Pirv: "negatif",
  PensNbeLT: "negatif",
  QDPH: "negatif",
  Ppit: "negatif",
  "NbPNS15+": "negatif",
  PnpDPNs: "negatif",
  PNDse: "negatif",
  PpeEp: "negatif",
  PRppS: "negatif",
  PRppC1946: "negatif",
};

function normaliser(valeur, min, max, sens) {
  if (min === max) return 50;
  if (valeur == null || isNaN(valeur)) return 0;

  let score;

  if (sens === "positif") {
    score = ((valeur - min) / (max - min)) * 100;
  } else {
    score = ((max - valeur) / (max - min)) * 100;
  }

  // Clamp entre 0 et 100
  return Math.max(0, Math.min(score, 100));
}

function updateLayerStyle(layer, props) {
  console.log(
    "updateLayerStyle called with score:",
    props.Indicateur_Composite_score,
  );
  const score = props.Indicateur_Composite_score || 0;

  // Fonction pour choisir la couleur selon le score
  function getColor(score) {
    return score > 50
      ? "#344E41"
      : score > 40
        ? "#3A5A40"
        : score > 35
          ? "#588157"
          : score > 30
            ? "#A3B18A"
            : "#DAD7CD";
  }

  layer.setStyle({
    fillColor: getColor(score),
    color: layer.options.color || "#333", // garde la bordure existante
    weight: 4, // mettre en évidence la sélection
    fillOpacity: 0.7,
  });

  layer.bringToFront(); // optionnel, pour que la sélection soit bien visible
}

// 👉 Fonction de mise à jour des scores
function updateScores(props) {
  console.log("props reçu dans updateScores:", props);
  console.log("🚨 props reçu dans updateScores:", props);
  console.log("📌 props.CODE_INSEE =", props.CODE_INSEE);
  for (const key in props) {
    if (!(key in bornesIndicateurs)) continue;
    const sens = sensIndicateurs[key] || "positif";
    const { min, max } = bornesIndicateurs[key];
    const val = props[key];
    props[`${key}_score`] = normaliser(val, min, max, sens);
  }

  // Étape 2 – Regroupement par structure
  for (const thematique in structureScore) {
    let sousScores = [];

    for (const sousThematique in structureScore[thematique]) {
      const scoreFields = structureScore[thematique][sousThematique];

      const values = (Array.isArray(scoreFields) ? scoreFields : [scoreFields])
        .map((key) => props[key])
        .filter((val) => val != null && !isNaN(val));

      const moyenneSous = values.length
        ? values.reduce((a, b) => a + b, 0) / values.length
        : 0;

      props[`${sousThematique}_score`] = moyenneSous;
      sousScores.push(moyenneSous);
    }

    const moyenneThema = sousScores.length
      ? sousScores.reduce((a, b) => a + b, 0) / sousScores.length
      : 0;
    props[`${thematique}_score`] = moyenneThema;
  }

  // AVANT la simulation, sauvegarde le score original
  if (!props.hasOwnProperty("Indicateur_Composite_score_original")) {
    props["Indicateur_Composite_score_original"] =
      props["Indicateur_Composite_score"];
  }

  // Étape 3 – Score global
  const thematiques = Object.keys(structureScore);
  const scoresThema = thematiques
    .map((t) => props[`${t}_score`])
    .filter((val) => val != null && !isNaN(val));

  const global = scoresThema.length
    ? scoresThema.reduce((a, b) => a + b, 0) / scoresThema.length
    : 0;
  props["Indicateur_Composite_score"] = global;

  // Étape 4 – Mise à jour visuelle de la carte
  const selected = selectedLayers.find(
    (entry) => entry.props.CODE_INSEE === String(props.CODE_INSEE),
  );

  if (selected) {
    updateLayerStyle(selected.layer, props);

    // 🎯 Affiche scores dans une bulle
    const latlng = selected.layer.getBounds().getCenter();
    const point = map.latLngToContainerPoint(latlng);

    const bubble = document.getElementById("simulatedScoreBubble");

    const scoreNormal = props["Indicateur_Composite_score_original"];
    const scoreSimule = global;

    bubble.innerHTML = `
    <div style="background: white; padding: 10px; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">
      <div style="display: flex; align-items: center; gap: 15px;">
        <div style="text-align: center;">
          <div style="font-size: 10px; color: #666;">Score initial</div>
          <div style="font-size: 18px; font-weight: bold; color: #4f46e5;">${scoreNormal?.toFixed(1)}</div>
        </div>
        
        <div style="font-size: 20px; color: #94a3b8;">→</div>
        
        <div style="text-align: center;">
          <div style="font-size: 10px; color: #666;">score simulé</div>
          <div style="font-size: 18px; font-weight: bold; color: #10b981">
            ${scoreSimule.toFixed(1)}
          </div>
        </div>
      </div>
    </div>
  `;

    bubble.style.left = `${point.x + 5}px`;
    bubble.style.top = `${point.y - 5}px`;
    bubble.style.display = "block";
  }

  // Mise à jour du radar principal
  updateRadarComparisonChart();
}
document
  .getElementById("closeIndicatorEditorSidebar")
  .addEventListener("click", () => {
    document.getElementById("indicatorEditorSidebar").style.display = "none";
    document.getElementById("openSimulationBtn").style.display = "block";

    // ✅ Réafficher la légende principale
    document.getElementById("simulationLegend").style.display = "none";
    document.getElementById("mainLegend").style.display = "block";

    // ✅ Réinitialiser les couleurs des communes sélectionnées
    selectedLayers.forEach((entry) => {
      geojson.resetStyle(entry.layer);
    });

    // ✅ Cacher la bulle du score simulé
    document.getElementById("simulatedScoreBubble").style.display = "none";
  });

document.getElementById("openSimulationBtn").addEventListener("click", () => {
  if (selectedLayers.length > 0) {
    showAllIndicatorEditor(selectedLayers[0].props); // ✅ on passe l'objet original
  } else {
    alert("Veuillez sélectionner une commune sur la carte.");
  }
});

// ========================================
// GESTION DU PANNEAU INDICATEURS
// ========================================

let indicateursData = null;

// Charger le fichier JSON des indicateurs
fetch("indicateursJSON.json") // ← Remplacez par le nom de votre fichier JSON
  .then((res) => res.json())
  .then((data) => {
    indicateursData = data;
    populateIndicatorDropdown(data);
    console.log("✅ Indicateurs chargés :", data.length);
  })
  .catch((err) => {
    console.error("❌ Erreur chargement indicateurs.json :", err);
    document.getElementById("indicator-info").innerHTML = `
      <p style="color: #ef4444; text-align: center; padding: 20px;">
        Erreur de chargement des indicateurs
      </p>
    `;
  });

// Remplir le dropdown avec les indicateurs
function populateIndicatorDropdown(data) {
  const dropdown = document.getElementById("indicator-dropdown");

  // Grouper par thématique pour un meilleur affichage
  const groupedByTheme = {};

  data.forEach((item, index) => {
    const theme = item["Thématique"] || "Autre";
    if (!groupedByTheme[theme]) {
      groupedByTheme[theme] = [];
    }
    groupedByTheme[theme].push({ ...item, index });
  });

  // Créer des optgroups par thématique
  Object.keys(groupedByTheme)
    .sort()
    .forEach((theme) => {
      const optgroup = document.createElement("optgroup");
      optgroup.label = theme;

      groupedByTheme[theme].forEach((item) => {
        const option = document.createElement("option");
        option.value = item.index;

        // Format: "Sigle - Indicateur (Sous-thématique)"
        const sousTheme = item["Sous-thématique"]
          ? ` (${item["Sous-thématique"]})`
          : "";
        const sigle = item["Sigles"] ? `${item["Sigles"]} - ` : "";
        option.textContent = `${sigle}${item["Indicateur"]}${sousTheme}`;

        optgroup.appendChild(option);
      });

      dropdown.appendChild(optgroup);
    });
}

// Afficher les détails d'un indicateur
function showIndicatorDetails(indicatorIndex) {
  const infoDiv = document.getElementById("indicator-info");

  if (!indicateursData || !indicateursData[indicatorIndex]) {
    infoDiv.innerHTML =
      '<p class="placeholder-text">Indicateur introuvable</p>';
    return;
  }

  const indicator = indicateursData[indicatorIndex];

  // Déterminer la couleur selon le sens de variation
  const sensColor =
    indicator["Sens de variation"] === "Positif"
      ? "#10b981" // Vert
      : "#ef4444"; // Rouge

  const sensIcon = indicator["Sens de variation"] === "Positif" ? "" : "";

  // Construire le HTML des détails
  let detailsHTML = `
    <div class="indicator-detail-card">
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 20px;">
        <div>
          <h4 style="margin: 0 0 5px 0; font-size: 18px;">${indicator["Indicateur"]}</h4>
          ${indicator["Sigles"] ? `<p style="margin: 0; color: #6b7280; font-size: 13px;">Code: <strong>${indicator["Sigles"]}</strong></p>` : ""}
        </div>
        <span style="background: ${sensColor}; color: white; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; white-space: nowrap;">
          ${sensIcon} ${indicator["Sens de variation"] || "N/A"}
        </span>
      </div>
      
      <div class="indicator-detail-row">
        <span class="indicator-detail-label"> Thématique</span>
        <span class="indicator-detail-value" style="color: #667eea; font-weight: 700;">
          ${indicator["Thématique"] || "N/A"}
        </span>
      </div>
      
      <div class="indicator-detail-row">
        <span class="indicator-detail-label"> Sous-thématique</span>
        <span class="indicator-detail-value">
          ${indicator["Sous-thématique"] || "N/A"}
        </span>
      </div>
      
      ${
        indicator["Formule"]
          ? `
        <div style="margin-top: 20px; padding: 15px; background: #fff; border-radius: 8px; border: 2px dashed #e5e7eb;">
          <div style="color: #6b7280; font-size: 12px; font-weight: 600; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
             Formule 
          </div>
          <div style="font-family: 'Courier New', monospace; font-size: 13px; color: #1f2937; line-height: 1.6; word-break: break-word;">
            ${indicator["Formule"]}
          </div>
        </div>
      `
          : ""
      }
      
      ${
        indicator["Description"]
          ? `
        <div style="margin-top: 15px; padding: 15px; background: #f0f9ff; border-left: 3px solid #3b82f6; border-radius: 4px;">
          <div style="color: #1e40af; font-size: 12px; font-weight: 600; margin-bottom: 5px;">
            ℹ️ Description
          </div>
          <div style="color: #1f2937; font-size: 13px; line-height: 1.5;">
            ${indicator["Description"]}
          </div>
        </div>
      `
          : ""
      }
    </div>
  `;

  infoDiv.innerHTML = detailsHTML;
}

// ========================================
// EVENT LISTENERS
// ========================================

// Ouvrir/Fermer le panneau
document.getElementById("indicator-btn-nav").addEventListener("click", (e) => {
  e.stopPropagation();
  const panel = document.getElementById("indicator-details-panel");
  const isVisible = panel.style.display === "block";
  panel.style.display = isVisible ? "none" : "block";
});

// Bouton de fermeture
document
  .getElementById("close-indicator-panel")
  .addEventListener("click", () => {
    document.getElementById("indicator-details-panel").style.display = "none";
  });

// Changement de sélection dans le dropdown
document
  .getElementById("indicator-dropdown")
  .addEventListener("change", (e) => {
    const selectedValue = e.target.value;
    if (selectedValue !== "") {
      showIndicatorDetails(parseInt(selectedValue));
    } else {
      document.getElementById("indicator-info").innerHTML =
        '<p class="placeholder-text">Choisissez un indicateur pour voir les détails.</p>';
    }
  });

// Fermer le panneau en cliquant à l'extérieur
document.addEventListener("click", (e) => {
  const panel = document.getElementById("indicator-details-panel");
  const button = document.getElementById("indicator-btn-nav");

  if (
    panel.style.display === "block" &&
    !panel.contains(e.target) &&
    !button.contains(e.target)
  ) {
    panel.style.display = "none";
  }
});

// Empêcher la fermeture quand on clique dans le panneau
document
  .getElementById("indicator-details-panel")
  .addEventListener("click", (e) => {
    e.stopPropagation();
  });

// Ouvrir/Fermer le panneau des enquêtes
document.getElementById("survey-btn-nav").addEventListener("click", (e) => {
  e.stopPropagation();
  const panel = document.getElementById("survey-panel");
  const isVisible = panel.style.display === "block";
  panel.style.display = isVisible ? "none" : "block";
});

// Bouton de fermeture du panneau des enquêtes
document.getElementById("close-survey-panel").addEventListener("click", () => {
  document.getElementById("survey-panel").style.display = "none";
});

// Fermer le panneau des enquêtes en cliquant à l'extérieur
document.addEventListener("click", (e) => {
  const panel = document.getElementById("survey-panel");
  const button = document.getElementById("survey-btn-nav");

  if (
    panel.style.display === "block" &&
    !panel.contains(e.target) &&
    !button.contains(e.target)
  ) {
    panel.style.display = "none";
  }
});

// Empêcher la fermeture quand on clique dans le panneau des enquêtes
document.getElementById("survey-panel").addEventListener("click", (e) => {
  e.stopPropagation();
});

// 1. Dictionnaire des descriptions (à adapter selon vos graphiques)
const surveyData = {
  "agePersonn.png": {
    description:
      "Un grande majorité de moins de 25 ans mais une parité respectée entre les sexes.",
  },
  "AncHabTerr.png": {
    description:
      "La catégorie “entre 1 et 5 ans” est largement dominante, qui correspond aux étudiants. Cela suggère une dynamique récente d’installation sur le territoire.",
  },
  "CatSocProf.png": {
    description:
      "Un grande majorité d’étudiants, ce qui explique l’ancienneté sur le territoire plutôt faible des personnes interrogées.",
  },
  "critImportant.png": {
    description:
      "Les critères les plus importants sur le territoire sont la qualité de l'habitat, accès aux soins et les espaces verts.",
  },
  "descriptionVille.png": {
    description:
      "La ville est décrite comme aggéable par la plupart des personnes interrogées, même si une part non négligeable la trouve aussi calme.",
  },
  "genrePersonn.png": {
    description: "Il y a une quasi-parité entre hommes et femmes",
  },
  "genrePersonn.png": {
    description: "Il y a une quasi-parité entre hommes et femmes",
  },
  "percepBienEtre.png": {
    description:
      "Le bien-être est donc principalement perçu comme un état intérieur, une sensation personnelle de confort et d’apaisement..",
  },
  "perceptionQuartier.png": {
    description:
      "La perception du quartier est globalement positive, avec une forte proportion de personnes qui le jugent agréable.",
  },
  "possQuitVille.png": {
    description:
      "En cause: souhaite plus de nature (montagne notamment), souhaite une plus grande ville, souhaite être plus dans le sud de la France.",
  },
  "ReparQuitVille.png": {
    description:
      "La répartition des personnes souhaitant quitter la ville est très inégale, avec une forte proportion de personnes souhaitant quitter la ville notamment les étudiants.",
  },
  "ReparQuitVille.png": {
    description:
      "La répartition des personnes souhaitant quitter la ville est très inégale, avec une forte proportion de personnes souhaitant quitter la ville notamment les étudiants.",
  },
  "repartImportCatAge.png": {
    description:
      "Les < 25 ans (Orange) : Ils semblent accorder une importance capitale à l'aspect pratique et au cadre de vie immédiat (Transports, Culture, Bars/Restaurants, et Études supérieures), Les 25-45 ans (Jaune) : Leur présence est constante mais plus marquée sur des sujets comme le Coût de la vie, la Qualité de l'air et Accès à l'éducation (crèches, écoles), ce qui correspond souvent à l'étape de construction familiale, Les 45-65 ans (Vert) : On observe un intérêt soutenu pour la Qualité de l'air, la Qualité de l'eau et la Sécurité, Les + 65 ans (Marron) : Bien que moins nombreux dans l'échantillon, ils ressortent proportionnellement sur des sujets comme Événements locaux (marchés...), Accessibilité PMR et Sentiment de sécurité",
  },
  "repartImportCatGenre.png": {
    description:
      "Contrairement au graphique par âge, la répartition est ici proche du 50/50 pour une grande majorité de critères. Cela suggère que le genre est un facteur moins différenciant que l'âge pour juger de l'attractivité d'un territoire",
  },
  "repartImportCatGenre.png": {
    description:
      "Contrairement au graphique par âge, la répartition est ici proche du 50/50 pour une grande majorité de critères. Cela suggère que le genre est un facteur moins différenciant que l'âge pour juger de l'attractivité d'un territoire",
  },
  "ressentiTerr.png": {
    description:
      "La grande majorité des répondants se sentent soit Plutôt bien (56) soit Bien (49), Une marge d'amélioration : Seule une minorité se sent Plutôt mal (15) ou Mal (1).",
  },
};

// 2. Gestion de l'affichage
const surveySelect = document.getElementById("survey-dropdown");
const surveyImg = document.getElementById("survey-img");
const surveyTextContainer = document.getElementById("survey-text-container");
const surveyTitle = document.getElementById("survey-title");
const surveyDescription = document.getElementById("survey-description");
const surveyPlaceholder = document.querySelector(
  "#survey-display .placeholder-text",
);

surveySelect.onchange = function () {
  const imageName = this.value;
  const data = surveyData[imageName];

  if (imageName && data) {
    // Affichage Image
    surveyImg.src = "./graphEnq/" + imageName;
    surveyImg.style.display = "block";

    // Affichage Texte
    // surveyTitle.innerText = data.title;
    surveyDescription.innerText = data.description;
    surveyTextContainer.style.display = "block";

    surveyPlaceholder.style.display = "none";
  } else {
    surveyImg.style.display = "none";
    surveyTextContainer.style.display = "none";
    surveyPlaceholder.style.display = "block";
  }
};

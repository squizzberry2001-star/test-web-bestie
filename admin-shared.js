(function () {
  const RB_ADMIN_STORAGE_KEY = 'rbvr-admin-config-v1';
  const RB_ADMIN_SESSION_KEY = 'rbvr-admin-session-code';
  const FALLBACK_ADMIN_CODE = String((window.RB_CONFIG && (window.RB_CONFIG.ADMIN_PANEL_CODE || window.RB_CONFIG.USAGE_DASHBOARD_CODE)) || '607090').trim();

  const DEFAULT_ADMIN_CONFIG = Object.freeze({
    version: 1,
    features: {
      qscResult: true,
      opiTable: true,
      qscTable: true,
      findingEvidence: true,
      correctiveAction: true,
      assignmentSection: true,
      progressDock: true
    },
    links: {
      opiReport: 'https://tinyurl.com/opi-report',
      assignment: 'https://tinyurl.com/store-caassignment'
    },
    masters: {
      auditors: [
      "Aan Bagus Permana",
      "Anggi Novita",
      "Aulia Fauziah",
      "Aulia Puspita Dewi",
      "Bagus Pradika",
      "Cindy Silvia Sahyu",
      "Didin Sarudin",
      "Edi Sukarno",
      "Fadliani Rizky Fidiaz",
      "Fajar Saputra",
      "Fendi Setiawan",
      "Fiqri Amatul Firdaus",
      "Karlina Endah Puji Astuti",
      "Malik Ibrahim",
      "Muhammad Fikri",
      "Novilya Dwi Rahman",
      "Rani Ismawati",
      "Rido Yuhanda",
      "Riki Prasetyawan",
      "Rully Alfandi",
      "Seftiana Putri Rahmawati",
      "Tia Fitri",
      "Yuyun Yuliyanti",
      "Andika Ryan Achmada",
      "Dhea Almahdiansyah",
      "Ilyas Fajar Arisena",
      "Nia Tri Rahayu"
    ],
      stores: [
      "CIBUBUR",
      "BULUNGAN",
      "PEJATEN",
      "KELAPA GADING BOULEVARD",
      "THAMRIN",
      "TANJUNG DUREN",
      "CIPETE",
      "PTC",
      "WOLTER MONGINSIDI",
      "KEMANG",
      "MANGGA BESAR",
      "PURI TELUK JAMBE 1 KARAWANG",
      "TOYOTA PLANT 3 KARAWANG",
      "ATI KARAWANG",
      "TOYOTA PLANT 1 SUNTER",
      "TOYOTA PLANT 1 KARAWANG",
      "BIDAKARA 1 (GATOT SUBROTO)",
      "SUMMITMAS 2 (SUDIRMAN)",
      "18TH RESIDENCE (KUNINGAN)",
      "WISMA KEIAI (SUDIRMAN)",
      "SUDIRMAN PARK 1",
      "ASTON RASUNA (KUNINGAN)",
      "GADING NIAS 1 (KELAPA GADING)",
      "TAMAN RASUNA (KUNINGAN)",
      "CBD PLUIT APARTEMEN",
      "MENARA PRIMA (MEGA KUNINGAN)",
      "SEASON CITY APARTEMEN (LATUMEN",
      "PONDOK INDAH GOLF APARTEMEN",
      "TOYOTA HO SUNTER",
      "BEJ TOWER (SUDIRMAN)",
      "THE CAPITAL RESIDENCE (SCBD)",
      "TOYOTA PLANT 2 SUNTER",
      "GRAHA NIAGA (SUDIRMAN)",
      "WTC 2 (SUDIRMAN)",
      "TEMPO SCAN TOWER (KUNINGAN)",
      "PATRA JASA (GATOT SUBROTO)",
      "THE SUMMIT (KELAPA GADING)",
      "MENARA KARYA (KUNINGAN)",
      "MENTENG SQUARE APARTEMEN (SENE",
      "MENARA BATAVIA (MAS MANSYUR)",
      "AYANA MIDPLAZA (SUDIRMAN)",
      "GRIYA NIAGA (BINTARO)",
      "KIAT EKA SARI SERANG",
      "ATRIA (SUDIRMAN)",
      "BIDAKARA 2 (GATOT SUBROTO)",
      "OASIS MITRA APARTEMEN",
      "THE EAST (MEGA KUNINGAN)",
      "MARGONDA 2 (DEPOK)",
      "PURI BINTARO",
      "SEMANGGI APARTEMEN",
      "MENARA KEBUN JERUK APARTEMEN",
      "TALAVERA OFFICE PARK (SIMATUPA",
      "WISMA MULIA (GATOT SUBROTO)",
      "HOTEL FORMULE 1 CIKINI",
      "WISMA BNI 46 (SUDIRMAN)",
      "INDONESIA CHEMICON JABABEKA",
      "FMD T3 DOM DEPATURE",
      "PAKUBUWONO VIEW APARTEMEN",
      "TELKOM LANDMARK (GATOT SUBROTO",
      "CHANDRA ASRI CILEGON",
      "ADM HO SUNTER",
      "ADM CASTING PLANT 3 KARAWANG",
      "ADM STAMPING PLANT 1 SUNTER",
      "ADM ENGINE PLANT 2 KARAWANG",
      "ADM ASSEMBLY PLANT 4 SUNTER",
      "ADM ASSEMBLY PLANT 5 KARAWANG",
      "STANDARD CHARTERED (SATRIO)",
      "LTC GLODOK",
      "BAYWALK (PLUIT)",
      "MALL SEASON CITY",
      "GAHARU KALIBATA CITY APARTEMEN",
      "MANGGA DUA SQUARE",
      "CILANDAK KKO",
      "GADING NIAS 2 (KELAPA GADING)",
      "MEDITERANIA PALACE (KEMAYORAN)",
      "MELAWAI",
      "BELLAGIO (MEGA KUNINGAN)",
      "LAPANGAN ROOS",
      "JASA MARGA CAWANG",
      "SOPO DEL TOWER (MEGA KUNINGAN)",
      "CETENNIAL TOWER (SUDIRMAN)",
      "ALAMANDA TOWER (TB SIMATUPANG)",
      "ADM PART CENTER CIBITUNG",
      "MSIG TOWER (SUDIRMAN)",
      "IFC 2 (SUDIRMAN)",
      "GRAND RUBINA (KUNINGAN)",
      "18 OFFICE PARK (TB SIMATUPANG)",
      "CIPUTRA PURI TRISULA (PURI IND",
      "RDTX TOWER (KUNINGAN)",
      "T2D BANDARA SOEKARNO HATTA",
      "AKR TOWER (KEBON JERUK)",
      "MENARA IMPERIUM (KUNINGAN)",
      "WISMA GKBI (SUDIRMAN)",
      "WISMA MULIA 2 (GATOT SUBROTO)",
      "CAPITAL PLACE (GATOT SUBROTO)",
      "MENARA GLOBAL (GATOT SUBROTO)",
      "SMESCO (GATOT SUBROTO)",
      "SIGNATURE PARK (MT HARYONO)",
      "HAYAM WURUK 108",
      "SEQUIS TOWER (SCBD)",
      "MENARA SENTRAYA (BLOK M)",
      "PURI MANSION (PURI INDAH)",
      "GADING RIVER VIEW (KELAPA GADI",
      "ERAJAYA (BANDENGAN)",
      "MENARA BNI (PEJOMPONGAN)",
      "MULTIVISION TOWER (KUNINGAN)",
      "KUBIKAHOMY (BSD)",
      "POIN SQUARE",
      "PURI MATARI 2 (SETIA BUDI)",
      "ASTRA INTERNATIONAL (SUNTER)",
      "MANGKULUHUR CITY (GATOT SUBROT",
      "HK TOWER (MT HARYONO)",
      "BRANZ (BSD)",
      "MRT BENDUNGAN HILIR",
      "MRT LEBAK BULUS",
      "HAMPTONS PARK (CILANDAK)",
      "GADING ICON (PULO GADUNG)",
      "MAPLE PARK (SUNTER)",
      "JUANDA",
      "KOTA AYODHYA (TANGERANG)",
      "PURI ORCHARD (PURI INDAH)",
      "THE TOWER (GATOT SUBROTO)",
      "GROGOL",
      "FRASER PLACE (SETIABUDI)",
      "ENERGY BUILDING (SUDIRMAN)",
      "THE MANHATTAN (TB SIMATUPANG)",
      "MALL LOTTE SHOPPING AVENUE",
      "FMI SUDIRMAN 7.8",
      "THE KENSINGTON ROYAL (KELAPA G",
      "BINTARO PARK VIEW (BINTARO)",
      "RS CAROLUS SALEMBA",
      "SLIPI APARTEMEN",
      "TULIP KALIBATA CITY APARTEMEN",
      "GREEN PARK OFFICE (BSD)",
      "AHMAD DAHLAN",
      "BASSURA CITY (JATINEGARA)",
      "VETERAN",
      "ASG TOWER (PIK)",
      "GOLD COAST (PIK)",
      "SAHID SUDIRMAN APARTEMEN",
      "COHIVE (MEGA KUNINGAN)",
      "PURI TELUK JAMBE 2 KARAWANG",
      "MENARA JAMSOSTEK (GATOT SUBROT",
      "AHM PLANT 5 CIKARANG",
      "CITRA LIVING APARTEMEN (KALIDE",
      "WEST VISTA (KOSAMBI)",
      "CIPUTRA WORLD 2 (SATRIO)",
      "AHM PLANT 3 CIBITUNG",
      "RNI WASKITA (MT HARYONO)",
      "PLAZA OLEOS (TB SIMATUPANG)",
      "PURI INDAH FINANCIAL TOWER",
      "BROOKLYN (ALAM SUTRA)",
      "MARRAKASH SQUARE PONDOK UNGU",
      "ICON BSD",
      "GRAHA MR 21 (MENTENG)",
      "MALL GRAND INDONESIA",
      "CIPINANG INDAH RAYA",
      "PERMATA HIJAU SUITES APARTEMEN",
      "SYNERGY BUILDING (ALAM SUTERA)",
      "THE CITY TOWER (THAMRIN)",
      "MENARA FIF (TB SIMATUPANG)",
      "BLORA",
      "HOTEL CITRADREAM BINTARO",
      "FOODTRUCK 1",
      "BIAK",
      "NERINE GREEN PRAMUKA (CEMPAKA",
      "JATIWARINGIN",
      "SUDIRMAN TOWER CONDOMINIUM",
      "HARAPAN INDAH",
      "BALAP SEPEDA",
      "SUNTER RAYA",
      "AHM PLANT 2 SUNTER",
      "AHM PLANT 3A CIBITUNG",
      "AHM PLANT 4 CIKARANG",
      "REVENUE TOWER (SCBD)",
      "SCIENTIA RESIDENCE",
      "SAYAP MAS UTAMA",
      "INTILAND TOWER (SUDIRMAN)",
      "AHM PART CENTER CIKARANG",
      "MENARA PALMA (KUNINGAN )",
      "PELINDO TOWER (TJ PRIOK)",
      "GRAND GALAXY",
      "RAWA BELONG",
      "BOTANICA (PONDOK INDAH)",
      "RDTX PLACE (SATRIO)",
      "KARAWACI",
      "CEMPAKA PUTIH TENGAH",
      "GEDUNG JAYA (THAMRIN)",
      "MALL BASSURA CITY",
      "POM BENSIN CIRENDEU",
      "PACIFIC CENTURY PLACE (SUDIRMA",
      "TAMAN PURING",
      "GREEN LAKE",
      "STASIUN MANGGARAI",
      "CHUBB SQUARE (THAMRIN)",
      "SETIABUDI",
      "PAMULANG",
      "SUDIRMAN BOGOR",
      "SINARMAS PLAZA (THAMRIN)",
      "HOTEL EMPORIUM PECENONGAN",
      "SEMERU BOGOR",
      "PAKUBUWONO SPRING APARTEMEN",
      "STASIUN BOGOR",
      "STASIUN GONDANGDIA",
      "RAJAWALI PLACE (KUNINGAN)",
      "CHANDRA ASRI 2 CILEGON",
      "STASIUN KOTA",
      "PADJAJARAN BOGOR",
      "TANGCITY (TANGERANG)",
      "TRINITY (KUNINGAN)",
      "POM BENSIN MARGONDA RAYA",
      "GREEN VILLE",
      "MORI TOWER (SUDIRMAN)",
      "CITRA 6",
      "BALAI PUSTAKA (PULOGADUNG)",
      "PROMINENCE TOWER (ALAM SUTRA)",
      "WISMA NUGRA SANTANA",
      "MENARA DANAREKSA (GAMBIR)",
      "PONDOK GEDE",
      "GEDUNG HIJAU (P.PINANG)",
      "PLAZA PONDOK INDAH",
      "BRI II (SUDIRMAN)",
      "GARUDA HO (TANGERANG)",
      "CYBER 2 (KUNINGAN)",
      "BENDUNGAN HILIR",
      "KEMANG PRATAMA BEKASI",
      "ELECTRONIC CITY CINERE",
      "KARET PEDURENAN",
      "MENARA KADIN (SETIABUDI)",
      "SATRIO TOWER (KUNINGAN)",
      "CONDET",
      "PLAZA SENTRAL (SETIABUDI)",
      "JATI ASIH",
      "PGC CILILITAN",
      "LIPPO MALL PURI",
      "PALMERAH",
      "MERIAL TOWER RS PELNI",
      "ARTHA GRAHA (SUDIRMAN)",
      "STASIUN PONDOK RANJI",
      "MARGONDA RESIDENCE 3 APARTEMEN",
      "MENARA BRILIAN (GATOT SUBROTO)",
      "KOMANDO RAYA - MCC",
      "THE MANSION KEMAYORAN",
      "SEDAYU CITY",
      "PANTAI INDAH KAPUK",
      "MAYAPADA 1",
      "CEMPAKA PUTIH RAYA",
      "MAGGIORE SQUARE",
      "SALEMBA TENGAH",
      "BINTARO SEKTOR 7",
      "KOMPAS (PALMERAH SELATAN)",
      "TOYOTA PLANT 2 KARAWANG",
      "BENTON JUNCTION",
      "ELECTRONIC CITY TEBET",
      "BUDI RAYA KEMANGGISAN",
      "TOMANG RAYA",
      "TEBET BARAT",
      "RS UNIVERSITAS INDONESIA",
      "FATMAWATI RAYA",
      "PAHLAWAN REVOLUSI",
      "RADIO DALAM",
      "TAMAN SURYA",
      "WIKA TOWER II",
      "PERCETAKAN NEGARA",
      "ADM SUNTER VLC",
      "CIRENDEU RAYA",
      "CINERE 8",
      "KOTA WISATA",
      "BOJONGSARI DEPOK",
      "RADIN INTEN",
      "TUGU TANI",
      "CHANDRA ASRI PP",
      "MUARA KARANG",
      "GADING MEDITERANIA",
      "ANIVA GADING SERPONG",
      "PESANGGRAHAN",
      "SPBU BP MARGONDA",
      "BANGKA RAYA",
      "TELUK GONG",
      "KAYU JATI",
      "CEGER RAYA",
      "SUMMARECON BEKASI",
      "T3 WEST LOBBY BANDARA SOETTA",
      "KEMENTERIAN PARIWISATA",
      "UIN CIPUTAT",
      "PINANG RANTI",
      "CILEDUG RAYA",
      "ARJUNA UTARA",
      "TAMAN PERMATA BUANA",
      "TAMAN SEMANAN",
      "MENARA BCA",
      "TELAGA BESTARI",
      "PANJANG ARTERI",
      "CITRA RAYA CIKUPA",
      "PONDOK KOPI",
      "SETIA BUDI RAYA",
      "BINTARA RAYA BEKASI",
      "DAAN MOGOT TGR",
      "BOULEVARD KELAPA GADING 2",
      "AGORA THAMRIN NINE",
      "SABANG KEBON SIRIH",
      "METLAND PURI CIPONDOH",
      "SENTRAL SENAYAN 3",
      "BENDUNGAN WALAHAR",
      "BASUKI RAHMAT",
      "MERUYUNG DEPOK",
      "MUCHTAR RAYA",
      "T2F BANDARA SOEKARNO HATTA",
      "MERUYA ILLIR",
      "TAMAN KOTA",
      "AHMAD YANI BYPASS",
      "DUREN TIGA RAYA",
      "CENTRAL PARK APARTEMEN",
      "PAHLAWAN REMPOA",
      "RA KARTINI BEKASI",
      "METLAND TRANSYOGI CILEUNGSI",
      "MAMPANG",
      "JOGLO RAYA",
      "KANTIN GRAND INDONESIA WEST MALL",
      "GRAHA HANURATA (KEBON SIRIH)",
      "PAHLAWAN REVOLUSI 2",
      "METLAND UJUNG MENTENG",
      "TCC BATAVIA",
      "MERCU BUANA",
      "OTISTA RAYA",
      "RAGUNAN RAYA",
      "TAMAN GALAXY",
      "JATIMULYA",
      "GRAND WISATA",
      "SPBU PERTAMINA BASUKI RACHMAT",
      "RADEN SALEH RAYA",
      "MATRAMAN RAYA",
      "PLAZA FESTIVAL",
      "HOS COKROAMINOTO",
      "KESEHATAN RAYA",
      "PONDOK KELAPA RAYA",
      "KALIMALANG RAYA",
      "PARKIR BANDARA HALIM",
      "SAWANGAN RAYA",
      "MOI KELAPA GADING 2",
      "KRAMAT JAYA RAYA",
      "DANAU AGUNG 2",
      "AHM PLANT 6 DELTAMAS",
      "JAKSA KEBON SIRIH",
      "CITY RESORT BOULEVARD",
      "LENTENG AGUNG RAYA",
      "PAKANSARI CIBINONG",
      "RSUD CENGKARENG",
      "CIBINONG",
      "PORIS PARADISE",
      "KRANGGAN RAYA",
      "KEPU SELATAN",
      "CIKINI RAYA",
      "CINANGKA PAMULANG",
      "PEKAYON RAYA",
      "PALMERAH BARAT",
      "MANGUNJAYA TAMBUN",
      "SPBU BP MINANGKABAU",
      "CUT MUTIA BEKASI",
      "CIPINANG JAYA RAYA",
      "PAS",
      "DR RATNA BEKASI",
      "KEMAKMURAN RAYA",
      "SUMUR BATU RAYA",
      "AKSES UI KELAPA DUA",
      "PUSPITEK RAYA",
      "SULTAN ISKANDAR MUDA",
      "CIATER RAYA",
      "KYAI MAJA",
      "PERMATA BUANA 2",
      "TAMAN MAKAM PAHLAWAN TARUNA",
      "CITRA GARDEN 2",
      "MOI KELAPA GADING",
      "NUSANTARA RAYA PERUMNAS",
      "KARTINI DEPOK",
      "HANKAM RAYA",
      "PULO GEBANG RAYA",
      "DAIKIN INDUSTRIES INDONESIA",
      "GADOG CIAWI RAYA",
      "REST AREA KM 43 A",
      "KARANG TENGAH",
      "CIOMAS",
      "DUTA HARAPAN",
      "CITRA GARDEN 8",
      "FATMAWATI RAYA 2",
      "PONDOK UNGU CANDRABAGA",
      "VILLA MELATI MAS RAYA",
      "PENGGILINGAN RAYA",
      "BUARAN RAYA",
      "BERINGIN RAYA",
      "SATU MARET",
      "ADM KAP 2 KARAWANG",
      "BOULEVARD GRAHA RAYA",
      "PRABU KIAN SANTANG PERIUK TGR",
      "TEBET TIMUR DALAM RAYA",
      "PROKLAMASI RAYA",
      "TANJUNG DUREN 2",
      "KENCANA LOKA",
      "PERJUANGAN KB. JERUK",
      "LAKSAMANA MALAHAYATI",
      "KELAPA GADING BOULEVARD TIMUR",
      "SEMANGKA KOJA",
      "PANDU RAYA",
      "GRAND DEPOK CITY 1",
      "KEBON KACANG",
      "CIPAYUNG RAYA",
      "NUSANTARA RAYA DEPOK",
      "CIBUNGBULANG RAYA",
      "ELANG LAUT PIK",
      "UTAN KAYU RAYA",
      "CAMAN RAYA",
      "CILEDUG RAYA 2",
      "BUGIS RAYA",
      "RADEN SALEH RAYA TGR",
      "DEWI SARTIKA",
      "JAGAKARSA RAYA",
      "KOTA WISATA 2",
      "KARANG SATRIA",
      "HANKAM RAYA 2",
      "ARJUNA SELATAN",
      "GOLDEN CITY",
      "SUNGAI LANDAK CILINCING",
      "CONDET 2",
      "RAYA TENGAH",
      "MOH KAHFI 1",
      "MTHUB TEBET",
      "TEROGONG RAYA",
      "CITAYAM CENTER",
      "DANAU INDAH RAYA",
      "VILLA REGENCY II",
      "JUANDA BEKASI",
      "BOULEVARD LA",
      "TANAH TINGGI TIMUR",
      "AMPERA RAYA",
      "REST AREA KM 39 A",
      "REST AREA KM 19 B",
      "HYBRIDA KELAPA GADING",
      "TAJUR RAYA",
      "KEMANG 2",
      "PENJERNIHAN 1",
      "MANDIRI DIGITAL TOWER",
      "INPRES RAYA",
      "DRAMAGA",
      "SURYA KENCANA PAMULANG",
      "BENDUNGAN HILIR 2",
      "KRESEK RAYA",
      "KEDOYA PESING",
      "RE MARTADINATA",
      "BOSIH RAYA",
      "MARGONDA RAYA",
      "CIDENG BARAT",
      "KOMODOR HALIM",
      "KAPUK RAYA",
      "JATIKRAMAT RAYA",
      "KARANG SATRIA 2",
      "KESEHATAN (TIMUR)",
      "KEMAYORAN GEMPOL",
      "WISMA BHAKTI MULYA",
      "REST AREA KM 6 B",
      "HASYIM ASHARI CIPOND",
      "PONDOK KOPI 2",
      "H. NAWI RAYA",
      "CIPUTAT RAYA",
      "SATRIO",
      "AMPERA PADEMANGAN BARAT",
      "RADEN SALEH DEPOK",
      "CILEDUG RAYA 3",
      "SPBU BP ANTASARI",
      "CHRYSANT GREEN PRAMUKA",
      "RADEN FATAH",
      "JAGAKARSA RAYA 2",
      "SRENGSENG RAYA",
      "ARUMAYA FINANCIAL CENTER",
      "KUTA SQUARE BALI",
      "FMI RENON AVENUE",
      "TUNJUNGAN SURABAYA",
      "PETRA SURABAYA",
      "T1 BANDARA JUANDA SURABAYA",
      "EMBONG SURABAYA",
      "MULYOSARI RAYA",
      "TENGGILIS MEJOYO",
      "DHARMAHUSADA SURABAYA",
      "MANYAR SURABAYA",
      "JEMURSARI RAYA",
      "GRAHA PENA SURABAYA",
      "NGAGEL JAYA",
      "UNAIR SURABAYA",
      "DARMO PERMAI",
      "RUNGKUT MADYA",
      "PAKUWON CITY",
      "BKR PELAJAR",
      "WIYUNG SURABAYA",
      "SAWOJAJAR",
      "SOEKARNO HATTA",
      "KAWI MALANG",
      "GATE5 BANDARA JUANDA",
      "KAYU TANGAN",
      "GALUNGGUNG MALANG",
      "TLOGOMAS RAYA",
      "IJEN",
      "SIGURA-GURA",
      "PANGLIMA SUDIRMAN BATU",
      "GAJAH MADA RAYA",
      "LARANGAN RAYA",
      "PAGERWOJO",
      "GRESIK MANYAR",
      "BEBEKAN RAYA",
      "PANGLIMA SUDIRMAN GRESIK",
      "INDRAGIRI DARMO",
      "GKB GRESIK",
      "SUPRIYADI MALANG",
      "KEMANTREN RAYA SIDOARJO",
      "CITRALAND DRIVE THRU",
      "UNAIR KAMPUS C",
      "MANUKAN TAMA",
      "SULFAT RAYA",
      "BARATA JAYA",
      "PONDOK JATI",
      "TERUSAN DIENG",
      "SIDOSERMO WONOCOLO",
      "SOEKARNO HATTA 2",
      "EDUCITY APARTEMEN",
      "SEDATI GEDE",
      "REST AREA KM 754 A",
      "UNESA KETINTANG",
      "BDG SUKAJADI",
      "BDG SURYA SUMANTRI",
      "BDG CIHAMPELAS",
      "BDG BRAGA",
      "BDG 23 PASKAL",
      "BDG R.E MARTADINATA",
      "BDG GATSU",
      "BDG DAGO",
      "BDG MEKARWANGI",
      "BDG PASKAL"
    ],
      levels: [
      "1A",
      "NS3",
      "NS1",
      "MG3",
      "MG1"
    ]
    },
    meta: {
      updatedAt: '',
      updatedBy: '',
      source: 'default'
    }
  });

  function normalizeText(value) {
    return String(value == null ? '' : value)
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function uniqueSorted(list) {
    const seen = new Map();
    (Array.isArray(list) ? list : []).forEach(item => {
      const raw = String(item == null ? '' : item).replace(/\s+/g, ' ').trim();
      const key = normalizeText(raw);
      if (!raw || seen.has(key)) return;
      seen.set(key, raw);
    });
    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b, 'id', { sensitivity: 'base' }));
  }

  function coerceFeatures(raw, fallback) {
    const target = { ...fallback };
    Object.keys(fallback || {}).forEach(key => {
      if (raw && Object.prototype.hasOwnProperty.call(raw, key)) {
        target[key] = Boolean(raw[key]);
      }
    });
    return target;
  }

  function buildDefaultConfig() {
    return clone(DEFAULT_ADMIN_CONFIG);
  }

  function mergeConfig(rawConfig = {}, source = 'default') {
    const defaults = buildDefaultConfig();
    const raw = rawConfig && typeof rawConfig === 'object' ? rawConfig : {};
    defaults.features = coerceFeatures(raw.features, defaults.features);

    if (raw.links && typeof raw.links === 'object') {
      defaults.links.opiReport = String(raw.links.opiReport || defaults.links.opiReport).trim() || defaults.links.opiReport;
      defaults.links.assignment = String(raw.links.assignment || defaults.links.assignment).trim() || defaults.links.assignment;
    }

    if (raw.masters && typeof raw.masters === 'object') {
      if (Array.isArray(raw.masters.auditors) && raw.masters.auditors.length) {
        defaults.masters.auditors = uniqueSorted(raw.masters.auditors);
      }
      if (Array.isArray(raw.masters.stores) && raw.masters.stores.length) {
        defaults.masters.stores = uniqueSorted(raw.masters.stores);
      }
      if (Array.isArray(raw.masters.levels) && raw.masters.levels.length) {
        defaults.masters.levels = uniqueSorted(raw.masters.levels);
      }
    }

    defaults.meta = {
      updatedAt: raw.meta && raw.meta.updatedAt ? String(raw.meta.updatedAt) : '',
      updatedBy: raw.meta && raw.meta.updatedBy ? String(raw.meta.updatedBy) : '',
      source: source || (raw.meta && raw.meta.source) || 'default'
    };
    return defaults;
  }

  function readLocalConfig() {
    try {
      const raw = localStorage.getItem(RB_ADMIN_STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (error) {
      console.error('Gagal membaca admin config lokal', error);
      return null;
    }
  }

  function saveLocalConfig(config) {
    const merged = mergeConfig(config, 'local');
    merged.meta.updatedAt = new Date().toISOString();
    try {
      localStorage.setItem(RB_ADMIN_STORAGE_KEY, JSON.stringify(merged));
      return merged;
    } catch (error) {
      console.error('Gagal menyimpan admin config lokal', error);
      return merged;
    }
  }

  async function parseJsonSafe(response) {
    const raw = await response.text();
    try {
      return raw ? JSON.parse(raw) : {};
    } catch (error) {
      return { status: 'error', message: raw || 'Response bukan JSON valid.' };
    }
  }

  async function fetchRemoteConfig() {
    if (!window.RB_CONFIG || !window.RB_CONFIG.API_URL) return null;
    const url = new URL(window.RB_CONFIG.API_URL, window.location.href);
    url.searchParams.set('action', 'admin_config');
    url.searchParams.set('ts', String(Date.now()));
    const response = await fetch(url.toString(), { method: 'GET', cache: 'no-store' });
    const payload = await parseJsonSafe(response);
    const status = String(payload.status || '').toLowerCase();
    if (!response.ok || !['success', 'ok'].includes(status)) {
      throw new Error(payload.message || 'Gagal memuat admin config dari server.');
    }
    return payload;
  }

  async function loadAdminConfig() {
    const local = readLocalConfig();
    try {
      const remotePayload = await fetchRemoteConfig();
      const merged = mergeConfig(remotePayload.config || {}, 'server');
      if (remotePayload.config && remotePayload.config.meta && remotePayload.config.meta.updatedAt) {
        merged.meta.updatedAt = String(remotePayload.config.meta.updatedAt);
      }
      if (remotePayload.config && remotePayload.config.meta && remotePayload.config.meta.updatedBy) {
        merged.meta.updatedBy = String(remotePayload.config.meta.updatedBy);
      }
      saveLocalConfig(merged);
      return {
        config: merged,
        source: 'server',
        remoteAvailable: true,
        message: 'Admin config dibaca dari server.'
      };
    } catch (error) {
      const merged = mergeConfig(local || {}, local ? 'local' : 'default');
      return {
        config: merged,
        source: local ? 'local' : 'default',
        remoteAvailable: false,
        message: local ? 'Memakai admin config lokal browser.' : 'Memakai admin config default.'
      };
    }
  }

  function getSessionCode() {
    return String(sessionStorage.getItem(RB_ADMIN_SESSION_KEY) || '').trim();
  }

  function setSessionCode(code) {
    sessionStorage.setItem(RB_ADMIN_SESSION_KEY, String(code || '').trim());
  }

  function clearSessionCode() {
    sessionStorage.removeItem(RB_ADMIN_SESSION_KEY);
  }

  async function verifyAdminCode(code) {
    const candidate = String(code || '').trim();
    if (!candidate) {
      return { ok: false, source: 'client', message: 'Kode admin wajib diisi.' };
    }

    if (window.RB_CONFIG && window.RB_CONFIG.API_URL) {
      try {
        const url = new URL(window.RB_CONFIG.API_URL, window.location.href);
        url.searchParams.set('action', 'verify_admin');
        url.searchParams.set('code', candidate);
        url.searchParams.set('ts', String(Date.now()));
        const response = await fetch(url.toString(), { method: 'GET', cache: 'no-store' });
        const payload = await parseJsonSafe(response);
        const status = String(payload.status || '').toLowerCase();
        if (response.ok && ['success', 'ok'].includes(status)) {
          return { ok: true, source: 'server', message: payload.message || 'Kode admin valid.' };
        }
      } catch (error) {
        // fallback client side below
      }
    }

    if (candidate === FALLBACK_ADMIN_CODE) {
      return { ok: true, source: 'client', message: 'Kode admin valid (fallback browser).' };
    }

    return { ok: false, source: 'client', message: 'Kode admin tidak valid.' };
  }

  async function saveAdminConfig(config, code, updatedBy = 'Admin Console') {
    const merged = mergeConfig(config, 'local');
    merged.meta.updatedAt = new Date().toISOString();
    merged.meta.updatedBy = String(updatedBy || 'Admin Console');
    const localSaved = saveLocalConfig(merged);

    if (!window.RB_CONFIG || !window.RB_CONFIG.API_URL) {
      return {
        ok: true,
        localSaved: true,
        remoteSaved: false,
        config: localSaved,
        message: 'Tersimpan di browser lokal. API belum tersedia untuk publish global.'
      };
    }

    try {
      const response = await fetch(window.RB_CONFIG.API_URL, {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_admin_config',
          code: String(code || '').trim(),
          updatedBy: merged.meta.updatedBy,
          config: merged
        })
      });
      const payload = await parseJsonSafe(response);
      const status = String(payload.status || '').toLowerCase();
      if (!response.ok || !['success', 'ok'].includes(status)) {
        throw new Error(payload.message || 'Publish config gagal.');
      }
      const resolved = mergeConfig(payload.config || merged, 'server');
      resolved.meta.updatedAt = payload.updatedAt || resolved.meta.updatedAt || new Date().toISOString();
      resolved.meta.updatedBy = payload.updatedBy || resolved.meta.updatedBy || merged.meta.updatedBy;
      saveLocalConfig(resolved);
      return {
        ok: true,
        localSaved: true,
        remoteSaved: true,
        config: resolved,
        message: payload.message || 'Admin config berhasil dipublish ke server.'
      };
    } catch (error) {
      return {
        ok: true,
        localSaved: true,
        remoteSaved: false,
        config: localSaved,
        message: error.message || 'Publish global gagal. Config tetap aman di browser lokal.'
      };
    }
  }

  window.RBAdminShared = {
    STORAGE_KEY: RB_ADMIN_STORAGE_KEY,
    SESSION_KEY: RB_ADMIN_SESSION_KEY,
    FALLBACK_ADMIN_CODE,
    DEFAULT_ADMIN_CONFIG,
    normalizeText,
    uniqueSorted,
    buildDefaultConfig,
    mergeConfig,
    readLocalConfig,
    saveLocalConfig,
    loadAdminConfig,
    verifyAdminCode,
    saveAdminConfig,
    getSessionCode,
    setSessionCode,
    clearSessionCode
  };
})();

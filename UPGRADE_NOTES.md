# Upgrade Notes

Perubahan utama pada versi ini:

1. **Frontend**
   - Script report dan analytics dipisah ke file eksternal: `report-app.js` dan `analytics-app.js`.
   - Konfigurasi frontend dipusatkan di `app-config.js`.
   - Tombol **Download PPT** sekarang menghasilkan file `.pptx` langsung di browser.
   - Ditambahkan progress tracker per section, pencarian cepat auditor, dan fokus keyboard untuk upload box.
   - Autosave dipisah antara data inti form dan data media supaya lebih ringan saat banyak foto.

2. **Backend Apps Script**
   - Request upload sekarang mendukung JSON dan form-encoded.
   - Health check mengembalikan status konfigurasi backend.
   - Upload report dicek berdasarkan `report_id` sebelum update row sehingga duplikasi file lebih terkendali.
   - Panel activity sekarang divalidasi lewat `USAGE_DASHBOARD_CODE` di Script Properties, bukan kode hardcoded di frontend.

3. **Analytics**
   - Ditambahkan export CSV.
   - Ditambahkan filter summary supaya user cepat melihat coverage hasil filter yang aktif.

## Cara pakai singkat
- Update endpoint di `app-config.js` bila Apps Script Web App berubah.
- Isi Script Properties di Apps Script:
  - `ROOT_FOLDER_ID`
  - `SPREADSHEET_ID`
  - `SHEET_NAME` (opsional)
  - `TIMEZONE` (opsional)
  - `USAGE_DASHBOARD_CODE` (opsional, untuk dashboard activity)

## Catatan
File lama `index.html.js` dan `analytics.html.js` sengaja dihapus dari versi ini agar tidak ada source of truth ganda.

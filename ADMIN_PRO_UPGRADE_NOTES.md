# Admin Pro Upgrade Notes

Upgrade utama yang sudah ditambahkan:

1. **Admin Console baru** (`admin.html`)
   - Kelola toggle fitur report.
   - Tambah / hapus store, auditor, dan job level.
   - Ubah link OPI dan link assignment.
   - Snapshot activity usage bila backend Apps Script sudah aktif.

2. **Dropdown interaktif pada form report**
   - Auditor memakai searchable dropdown.
   - Store memakai searchable dropdown berbasis list store yang Anda berikan.

3. **Status bar dan progress dock lebih ringkas**
   - Top status lebih compact.
   - Bottom progress dock dibuat jauh lebih minimal terutama di mobile.

4. **Backend Apps Script ditambah endpoint admin**
   - `?action=admin_config`
   - `?action=verify_admin&code=...`
   - `POST action=save_admin_config`

5. **Navigasi baru**
   - Link `ADMIN CONSOLE` ditambahkan di report dan analytics.

## File baru
- `admin.html`
- `admin-app.js`
- `admin-shared.js`
- `admin-upgrade.css`

## Catatan deploy
- Agar perubahan admin berlaku ke semua device, update dan deploy ulang file `apps_script_check.js` di Google Apps Script.
- Pastikan Script Properties berikut tersedia bila ingin sinkron global penuh:
  - `SPREADSHEET_ID`
  - `USAGE_DASHBOARD_CODE` atau `ADMIN_PANEL_CODE`
  - `ADMIN_CONFIG_SHEET_NAME` (opsional, default `AdminConfig`)

## Master store
Store dropdown sudah diprefill dari file list store yang diberikan user saat task ini dibuat.

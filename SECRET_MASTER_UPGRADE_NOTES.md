# Secret Admin + Master Excel + Strict Dropdown Upgrade

Versi ini menambahkan:

- Dropdown auditor dan store wajib pilih dari list, tanpa input manual.
- Search input tetap tersedia untuk auditor dan store.
- Store dropdown menampilkan format `KODE - NAMA STORE`.
- Hasil PDF/PPT cover/title kini menampilkan Kode Toko dan NIK Auditor.
- Sheet hasil upload kini menyimpan kolom baru: `auditor_nik`, `store_code`, dan `store_label`.
- Admin Console disembunyikan dari navigasi biasa dan dibuka lewat tombol rahasia + kode admin.
- Admin Console mendukung import master via Excel untuk:
  - Store master (format `Site` + `SiteDescr`, opsional `Type`, `City`, `Province`)
  - Auditor master (minimal `NIK` + `Nama Auditor`/`AuditorName`/`Name`)
  - Level master
- Default store master dibangkitkan dari file `4. List PIC April 2026.xlsx`.

File utama Apps Script yang perlu dicopy ke Google Apps Script tetap:
- `apps_script_check.js`

File frontend tempat URL `/exec` Apps Script harus ditempel:
- `app-config.js` pada properti `API_URL`

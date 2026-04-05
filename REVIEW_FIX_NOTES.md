# Review Fix Notes

Perbaikan berdasarkan review terbaru:

1. **Progress bar dibuat actual**
   - Progress sekarang dihitung dari item form yang benar-benar aktif dan terisi, bukan sekadar jumlah section.
   - Status menampilkan `x/y item terisi`, persentase, dan hint item yang masih kurang.

2. **Progress bar dipindah ke bawah halaman**
   - Dibuat sebagai **bottom sticky progress dock** agar user tidak perlu scroll balik ke atas.

3. **Delete photo tersedia**
   - Foto QSC/Famitrack dan semua foto pada grid evidence sekarang punya tombol `×` untuk hapus upload yang salah.

4. **Layout HP dirapikan**
   - Bottom dock dibuat responsif.
   - Input auditor disederhanakan.
   - Padding bawah ditambah agar tombol bawah tidak ketutup dock.

5. **Download PDF backend sync diperbaiki**
   - Upload ke Google Apps Script dikembalikan ke **form-urlencoded POST** untuk menghindari masalah preflight/CORS saat frontend Vercel memanggil Apps Script lintas-domain.

6. **Sandi panel aktivitas diubah jadi `607090`**
   - Backend sample sekarang default ke `607090` bila `USAGE_DASHBOARD_CODE` belum diset di Script Properties.

7. **Panel aktivitas dibuat lebih rahasia**
   - Tombol bulat floating disembunyikan.
   - Akses dibuka lewat **5x tap** pada status integrasi / header.

8. **Export CSV dipindah ke tombol rahasia**
   - Tombol export CSV di analytics toolbar disembunyikan.
   - Export CSV sekarang ada di **panel admin rahasia** pada halaman analytics.
   - Cara buka: **5x tap** area status sinkronisasi atau judul analytics, lalu masukkan kode `607090`.

9. **Rekomendasi nama auditor saat mengetik**
   - Kolom auditor sekarang memakai input autocomplete + datalist suggestion.

## Deep check / anomaly yang juga dibenahi

- Upload PDF ke Apps Script rawan gagal jika pakai JSON POST custom header lintas-domain.
- Panel aktivitas sebelumnya berpotensi gagal karena verifikasi dashboard memakai alur request yang tidak selaras.
- Progress lama tidak merefleksikan item aktif yang benar-benar terisi.
- UX photo upload sebelumnya tidak punya recovery jika user salah pilih file.
- Jalur admin dibuat lebih tersembunyi agar toolbar utama tetap bersih.

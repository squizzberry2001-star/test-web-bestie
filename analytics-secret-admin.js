(function () {
  const shared = window.RBAdminShared;
  if (!shared) return;

  function injectStyles() {
    if (document.getElementById('analyticsSecretAdminStyles')) return;
    const style = document.createElement('style');
    style.id = 'analyticsSecretAdminStyles';
    style.textContent = `
      .analytics-secret-admin-btn {
        position: fixed;
        left: max(14px, env(safe-area-inset-left));
        bottom: max(14px, env(safe-area-inset-bottom));
        width: 42px;
        height: 42px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,.45);
        background: linear-gradient(135deg, rgba(30,58,95,.86), rgba(15,118,110,.82));
        color: #fff;
        box-shadow: 0 14px 28px rgba(15,23,42,.22);
        opacity: .28;
        z-index: 70;
        cursor: pointer;
      }
      .analytics-secret-admin-btn:hover,
      .analytics-secret-admin-btn:focus-visible { opacity: .92; outline: none; }
      .analytics-secret-admin-modal {
        position: fixed;
        inset: 0;
        background: rgba(15,23,42,.56);
        display: none;
        align-items: center;
        justify-content: center;
        padding: 18px;
        z-index: 80;
      }
      .analytics-secret-admin-modal.active { display: flex; }
      .analytics-secret-admin-card {
        width: min(420px, 100%);
        background: #fff;
        border-radius: 18px;
        padding: 22px;
        box-shadow: 0 20px 44px rgba(15,23,42,.24);
      }
      .analytics-secret-admin-card h3 { margin: 0 0 8px; color: #18324b; }
      .analytics-secret-admin-card p { margin: 0 0 14px; color: #64748b; line-height: 1.5; }
      .analytics-secret-admin-card input {
        width: 100%;
        border: 1px solid #d7e2ec;
        border-radius: 12px;
        padding: 12px 14px;
        font: inherit;
        margin-bottom: 10px;
      }
      .analytics-secret-admin-error { min-height: 20px; color: #dc2626; font-size: 13px; margin-bottom: 12px; }
      .analytics-secret-admin-actions { display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap; }
    `;
    document.head.appendChild(style);
  }

  function createModal() {
    if (document.getElementById('analyticsSecretAdminBtn')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'analyticsSecretAdminBtn';
    button.className = 'analytics-secret-admin-btn';
    button.setAttribute('aria-label', 'Buka admin console tersembunyi');
    button.textContent = '✦';
    document.body.appendChild(button);

    const modal = document.createElement('div');
    modal.id = 'analyticsSecretAdminModal';
    modal.className = 'analytics-secret-admin-modal';
    modal.innerHTML = `
      <div class="analytics-secret-admin-card" role="dialog" aria-modal="true" aria-labelledby="analyticsSecretAdminTitle">
        <h3 id="analyticsSecretAdminTitle">Admin Console</h3>
        <p>Masukkan kode admin untuk membuka halaman admin tersembunyi.</p>
        <input type="password" id="analyticsSecretAdminInput" inputmode="numeric" autocomplete="off" placeholder="Masukkan kode admin">
        <div class="analytics-secret-admin-error" id="analyticsSecretAdminError"></div>
        <div class="analytics-secret-admin-actions">
          <button type="button" class="btn btn-ghost" id="analyticsSecretAdminCancel">Batal</button>
          <button type="button" class="btn btn-primary" id="analyticsSecretAdminSubmit">Buka Admin</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    function openModal() {
      modal.classList.add('active');
      document.getElementById('analyticsSecretAdminInput').value = shared.getSessionCode() || '';
      document.getElementById('analyticsSecretAdminError').textContent = '';
      setTimeout(() => document.getElementById('analyticsSecretAdminInput').focus(), 20);
    }
    function closeModal() {
      modal.classList.remove('active');
    }
    async function submit() {
      const code = String(document.getElementById('analyticsSecretAdminInput').value || '').trim();
      const error = document.getElementById('analyticsSecretAdminError');
      error.textContent = 'Memverifikasi akses admin...';
      const verify = await shared.verifyAdminCode(code);
      if (!verify.ok) {
        error.textContent = verify.message || 'Kode admin tidak valid.';
        return;
      }
      shared.setSessionCode(code);
      window.location.href = 'admin.html#console';
    }

    button.addEventListener('click', openModal);
    document.getElementById('analyticsSecretAdminCancel').addEventListener('click', closeModal);
    document.getElementById('analyticsSecretAdminSubmit').addEventListener('click', submit);
    document.getElementById('analyticsSecretAdminInput').addEventListener('keydown', event => {
      if (event.key === 'Enter') submit();
      if (event.key === 'Escape') closeModal();
    });
    modal.addEventListener('click', event => {
      if (event.target === modal) closeModal();
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    injectStyles();
    createModal();
  });
})();

// MobileForce — Popup JS

document.addEventListener('DOMContentLoaded', async () => {
  const toggle = document.getElementById('master-toggle');
  const toggleCard = document.getElementById('toggle-card');
  const toggleLabel = document.getElementById('toggle-label');
  const toggleSubtext = document.getElementById('toggle-subtext');
  const statusDot = document.getElementById('status-dot');
  const deviceSection = document.getElementById('device-section');
  const detailsSection = document.getElementById('details-section');
  const infoBanner = document.getElementById('info-banner');
  const deviceBtns = document.querySelectorAll('.device-btn');
  const spoofChecks = document.querySelectorAll('.spoof-check');

  // Help Modal Elements
  const helpBtn = document.getElementById('help-btn');
  const helpModal = document.getElementById('help-modal');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalDoneBtn = document.getElementById('modal-done-btn');

  // Load state
  const { enabled = false, device = 'galaxy_s25' } = await chrome.storage.local.get(['enabled', 'device']);
  toggle.checked = enabled;
  updateUI(enabled, device);

  // Toggle handler
  toggle.addEventListener('change', async () => {
    await chrome.storage.local.set({ enabled: toggle.checked });
    const { device: d = 'galaxy_s25' } = await chrome.storage.local.get('device');
    updateUI(toggle.checked, d);
  });

  // Device selection handler
  deviceBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const selectedDevice = btn.dataset.device;
      await chrome.storage.local.set({ device: selectedDevice });
      deviceBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });

  // Modal open/close handlers
  function openHelpModal() {
    helpModal.classList.add('visible');
  }

  function closeHelpModal() {
    helpModal.classList.remove('visible');
  }

  if (helpBtn) helpBtn.addEventListener('click', openHelpModal);
  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeHelpModal);
  if (modalDoneBtn) modalDoneBtn.addEventListener('click', closeHelpModal);

  // Close modal when clicking outside modal-content
  if (helpModal) {
    helpModal.addEventListener('click', (e) => {
      if (e.target === helpModal) {
        closeHelpModal();
      }
    });
  }

  // Keyboard Esc key to close modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && helpModal.classList.contains('visible')) {
      closeHelpModal();
    }
  });

  function updateUI(isEnabled, selectedDevice) {
    toggleCard.classList.toggle('active', isEnabled);
    toggleLabel.textContent = isEnabled ? 'Active' : 'Disabled';
    toggleSubtext.textContent = isEnabled ? 'Bypass protection active' : 'Protection inactive';
    statusDot.classList.toggle('active', isEnabled);
    
    deviceSection.classList.toggle('disabled', !isEnabled);
    detailsSection.classList.toggle('disabled', !isEnabled);
    infoBanner.classList.toggle('visible', isEnabled);
    
    deviceBtns.forEach(btn => btn.classList.toggle('selected', btn.dataset.device === selectedDevice));
    spoofChecks.forEach(check => check.classList.toggle('active', isEnabled));
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    const e = changes.enabled ? changes.enabled.newValue : toggle.checked;
    const d = changes.device ? changes.device.newValue : document.querySelector('.device-btn.selected')?.dataset.device || 'galaxy_s25';
    toggle.checked = e;
    updateUI(e, d);
  });
});

// ==========================================================================
// PWA & MOBILE APP MODULE - HRM TRUNG HẢI
// Handles: Service Worker, Install Prompt, iOS Guide, Mobile Drawer & Bottom Nav
// ==========================================================================

const appPWA = {
  deferredPrompt: null,
  isIOS: false,
  isStandalone: false,

  init() {
    this.detectEnvironment();
    this.registerServiceWorker();
    this.setupInstallPrompt();
    this.setupMobileDrawer();
    this.setupBottomNavigation();
  },

  detectEnvironment() {
    // Check if running as standalone PWA
    this.isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                        window.navigator.standalone === true;

    // Detect iOS devices
    const userAgent = window.navigator.userAgent.toLowerCase();
    this.isIOS = /iphone|ipad|ipod/.test(userAgent) && !window.MSStream;

    if (this.isStandalone) {
      document.documentElement.classList.add('is-pwa-standalone');
      console.log('[PWA] Running in standalone mode');
    }
  },

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then((registration) => {
            console.log('[PWA] Service Worker registered successfully:', registration.scope);

            // Listen for service worker updates
            registration.addEventListener('updatefound', () => {
              const newWorker = registration.installing;
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    console.log('[PWA] Có phiên bản mới. Ứng dụng đã sẵn sàng cập nhật!');
                  }
                });
              }
            });
          })
          .catch((error) => {
            console.warn('[PWA] Service Worker registration failed:', error);
          });
      });
    }
  },

  setupInstallPrompt() {
    const banner = document.getElementById('pwa-install-banner');
    const installBtn = document.getElementById('btn-pwa-install');
    const closeBtn = document.getElementById('btn-pwa-close');
    const sidebarInstallBtn = document.getElementById('nav-item-install-pwa');

    // If already installed in standalone mode, do not show prompts
    if (this.isStandalone) {
      if (banner) banner.style.display = 'none';
      if (sidebarInstallBtn) sidebarInstallBtn.style.display = 'none';
      return;
    }

    // Check if dismissed recently (within 5 days)
    const dismissedAt = localStorage.getItem('pwa_banner_dismissed_at');
    const isDismissed = dismissedAt && (Date.now() - parseInt(dismissedAt, 10)) < 5 * 24 * 60 * 60 * 1000;

    // Handle Android / Chromium browsers `beforeinstallprompt`
    window.addEventListener('beforeinstallprompt', (e) => {
      // Prevent browser's default mini-infobar
      e.preventDefault();
      this.deferredPrompt = e;

      if (sidebarInstallBtn) {
        sidebarInstallBtn.style.display = 'flex';
      }

      if (banner && !isDismissed) {
        setTimeout(() => {
          banner.style.display = 'flex';
        }, 1500);
      }
    });

    // Handle iOS Safari devices
    if (this.isIOS && !this.isStandalone) {
      if (sidebarInstallBtn) {
        sidebarInstallBtn.style.display = 'flex';
      }
      if (banner && !isDismissed) {
        setTimeout(() => {
          banner.style.display = 'flex';
        }, 2000);
      }
    }

    // Install button click
    const handleInstallClick = async () => {
      if (this.isIOS) {
        this.openIosModal();
        return;
      }

      if (this.deferredPrompt) {
        this.deferredPrompt.prompt();
        const { outcome } = await this.deferredPrompt.userChoice;
        console.log('[PWA] User response to install prompt:', outcome);
        if (outcome === 'accepted') {
          if (banner) banner.style.display = 'none';
          if (sidebarInstallBtn) sidebarInstallBtn.style.display = 'none';
        }
        this.deferredPrompt = null;
      } else {
        // Fallback for browsers that don't emit prompt or desktop
        this.openIosModal();
      }
    };

    if (installBtn) {
      installBtn.addEventListener('click', handleInstallClick);
    }
    if (sidebarInstallBtn) {
      sidebarInstallBtn.addEventListener('click', handleInstallClick);
    }

    if (closeBtn && banner) {
      closeBtn.addEventListener('click', () => {
        banner.style.display = 'none';
        localStorage.setItem('pwa_banner_dismissed_at', Date.now().toString());
      });
    }

    // App installed event
    window.addEventListener('appinstalled', () => {
      console.log('[PWA] Ứng dụng TRUNG HẢI HRM đã được cài đặt thành công!');
      if (banner) banner.style.display = 'none';
      if (sidebarInstallBtn) sidebarInstallBtn.style.display = 'none';
      this.deferredPrompt = null;
      if (window.utils && window.utils.showToast) {
        window.utils.showToast('Đã cài đặt TRUNG HẢI HRM thành công!', 'success');
      }
    });
  },

  openIosModal() {
    const modal = document.getElementById('modal-pwa-ios-instructions');
    if (modal) {
      modal.classList.add('active');
    }
  },

  closeIosModal() {
    const modal = document.getElementById('modal-pwa-ios-instructions');
    if (modal) {
      modal.classList.remove('active');
    }
  },

  setupMobileDrawer() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    const toggleBtn = document.getElementById('sidebar-toggle-btn');
    const closeBtn = document.getElementById('btn-close-sidebar-mobile');
    const moreBtn = document.getElementById('btn-mobile-more');

    const openDrawer = () => {
      if (sidebar) {
        sidebar.classList.remove('collapsed');
        sidebar.classList.add('mobile-open');
      }
      if (backdrop) backdrop.classList.add('active');
      document.body.style.overflow = 'hidden';
    };

    const closeDrawer = () => {
      if (sidebar) sidebar.classList.remove('mobile-open');
      if (backdrop) backdrop.classList.remove('active');
      document.body.style.overflow = '';
    };

    if (toggleBtn) {
      toggleBtn.addEventListener('click', (e) => {
        // If mobile screen (<= 768px), open drawer instead of desktop collapsing
        if (window.innerWidth <= 768) {
          e.stopPropagation();
          if (sidebar && sidebar.classList.contains('mobile-open')) {
            closeDrawer();
          } else {
            openDrawer();
          }
        }
      });
    }

    if (moreBtn) {
      moreBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openDrawer();
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', closeDrawer);
    }

    if (backdrop) {
      backdrop.addEventListener('click', closeDrawer);
    }

    // Auto close drawer when user clicks any navigation item
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    navItems.forEach((item) => {
      item.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
          closeDrawer();
        }
      });
    });
  },

  setupBottomNavigation() {
    const bottomNav = document.getElementById('mobile-bottom-nav');
    if (!bottomNav) return;

    const bottomButtons = bottomNav.querySelectorAll('.bottom-nav-btn[data-view]');

    bottomButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const viewId = btn.getAttribute('data-view');
        if (!viewId) return;

        // Trigger corresponding sidebar item click
        const sidebarNav = document.querySelector(`.sidebar-nav .nav-item[data-view="${viewId}"]`);
        if (sidebarNav) {
          sidebarNav.click();
        }

        // Update active class on bottom nav
        this.syncActiveBottomNav(viewId);
      });
    });

    // Also observe sidebar navigation changes to update bottom nav
    const sidebarNavItems = document.querySelectorAll('.sidebar-nav .nav-item[data-view]');
    sidebarNavItems.forEach((nav) => {
      nav.addEventListener('click', () => {
        const viewId = nav.getAttribute('data-view');
        this.syncActiveBottomNav(viewId);
      });
    });
  },

  syncActiveBottomNav(viewId) {
    const bottomNav = document.getElementById('mobile-bottom-nav');
    if (!bottomNav) return;

    const bottomButtons = bottomNav.querySelectorAll('.bottom-nav-btn');
    bottomButtons.forEach((b) => b.classList.remove('active'));

    const activeBtn = bottomNav.querySelector(`.bottom-nav-btn[data-view="${viewId}"]`);
    if (activeBtn) {
      activeBtn.classList.add('active');
    }
  }
};

// Global helper for modal
window.closePwaIosModal = () => {
  appPWA.closeIosModal();
};

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => appPWA.init());
} else {
  appPWA.init();
}

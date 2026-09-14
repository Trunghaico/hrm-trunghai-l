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

  swRegistration: null,
  isRefreshing: false,

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      // Auto reload when controller changes to new service worker
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!this.isRefreshing) {
          this.isRefreshing = true;
          console.log('[PWA] Service Worker controller changed. Reloading page...');
          window.location.reload();
        }
      });

      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then((registration) => {
            console.log('[PWA] Service Worker registered successfully:', registration.scope);
            this.swRegistration = registration;

            // Trigger immediate check for update
            registration.update().catch(() => {});

            // Auto-check for updates every 10 minutes
            setInterval(() => {
              registration.update().catch(() => {});
            }, 10 * 60 * 1000);

            // Listen for service worker updates
            registration.addEventListener('updatefound', () => {
              const newWorker = registration.installing;
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    console.log('[PWA] Có phiên bản mới. Hiển thị thông báo cập nhật!');
                    this.showUpdateBanner();
                  }
                });
              }
            });
          })
          .catch((error) => {
            console.warn('[PWA] Service Worker registration failed:', error);
          });
      });

      // When mobile app comes to foreground, check for SW updates and reload fresh data
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          if (this.swRegistration) {
            this.swRegistration.update().catch(() => {});
          }
          this.syncAllCloudData(false).catch(() => {});
        }
      });

      window.addEventListener('focus', () => {
        if (this.swRegistration) {
          this.swRegistration.update().catch(() => {});
        }
        this.syncAllCloudData(false).catch(() => {});
      });
    }
  },

  showUpdateBanner() {
    let banner = document.getElementById('pwa-update-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'pwa-update-banner';
      banner.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; z-index: 999999; background: #1E40AF; color: #FFFFFF; padding: 10px 16px; font-size: 13px; font-weight: 600; text-align: center; box-shadow: 0 4px 16px rgba(0,0,0,0.2); display: flex; align-items: center; justify-content: center; gap: 12px;';
      banner.innerHTML = `
        <span><i class="fa-solid fa-wand-magic-sparkles"></i> Ứng dụng đã có bản cập nhật mới nhất!</span>
        <button onclick="appPWA.forceRefresh()" style="background: #FFFFFF; color: #1E40AF; border: none; padding: 5px 14px; border-radius: 6px; font-weight: 700; font-size: 12px; cursor: pointer;">Cập nhật ngay</button>
        <button onclick="this.parentElement.remove()" style="background: transparent; color: #FFFFFF; border: none; font-size: 18px; cursor: pointer; padding: 0 4px;">&times;</button>
      `;
      document.body.appendChild(banner);
    } else {
      banner.style.display = 'flex';
    }
  },

  async syncAllCloudData(showFeedback = true) {
    if (showFeedback && window.utils && window.utils.showToast) {
      window.utils.showToast('Đang đồng bộ dữ liệu với máy chủ Cloud...', 'info');
    }
    try {
      if (this.swRegistration) {
        this.swRegistration.update().catch(() => {});
      }
      // Re-initialize appData with cache-busting
      if (window.appData && typeof appData.init === 'function') {
        await appData.init();
      }
      // Re-initialize appAttendance if on attendance view or loaded
      if (window.appAttendance && typeof appAttendance.init === 'function') {
        await appAttendance.init();
      }

      // Explicitly pull devices from Cloud API
      try {
        const devRes = await fetch('/api/attendance/devices?t=' + Date.now()).catch(() => null);
        if (devRes && devRes.ok) {
          const devData = await devRes.json();
          if (devData && Array.isArray(devData.devices) && devData.devices.length > 0) {
            if (window.appData) {
              appData.attendanceDevices = devData.devices;
              if (appData.tables) appData.tables['20_Attendance_Devices'] = devData.devices;
            }
            if (window.appAttendance) {
              appAttendance.devices = devData.devices;
              if (typeof appAttendance.renderDevices === 'function') {
                appAttendance.renderDevices();
              }
            }
            try { localStorage.setItem('hrm_attendance_devices', JSON.stringify(devData.devices)); } catch(e){}
          }
        }
      } catch (e) {}

      // Re-render current active view
      if (window.app && typeof app.renderCurrentView === 'function') {
        app.renderCurrentView();
      }
      // Update sidebar badge counts
      if (window.app && typeof app.updateSidebarCounts === 'function') {
        app.updateSidebarCounts();
      }
      if (showFeedback && window.utils && window.utils.showToast) {
        window.utils.showToast('Đã đồng bộ dữ liệu mới nhất từ Cloud thành công!', 'success');
      }
    } catch (e) {
      console.warn('Lỗi đồng bộ dữ liệu:', e);
      if (showFeedback && window.utils && window.utils.showToast) {
        window.utils.showToast('Không thể kết nối máy chủ Cloud, đang dùng dữ liệu offline.', 'warning');
      }
    }
  },

  async forceRefresh() {
    if (window.utils && window.utils.showToast) {
      window.utils.showToast('Đang xóa bộ nhớ đệm và tải lại bản mới nhất...', 'info');
    }
    try {
      // Clear CacheStorage
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
      // Unregister Service Worker
      if (this.swRegistration) {
        await this.swRegistration.unregister().catch(() => {});
      } else if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }
      // Reload page cleanly without cache
      window.location.reload(true);
    } catch (e) {
      window.location.reload(true);
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
        // Tắt tất cả các modal, tab popups trước khi mở menu drawer
        if (typeof window.closeAllModalsAndOverlays === 'function') {
          window.closeAllModalsAndOverlays();
        } else if (window.app && typeof app.closeAllModalsAndOverlays === 'function') {
          app.closeAllModalsAndOverlays();
        } else {
          document.querySelectorAll('.modal-backdrop.active').forEach(m => m.classList.remove('active'));
        }
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

    // ----------------------------------------------------------------------
    // Khóa cử chỉ kéo ngang: Chỉ cho phép vuốt chạy lên xuống, cấm kéo qua lại
    // ----------------------------------------------------------------------
    if (sidebar) {
      let touchStartX = 0;
      let touchStartY = 0;

      sidebar.addEventListener('touchstart', (e) => {
        if (e.touches && e.touches.length > 0) {
          touchStartX = e.touches[0].clientX;
          touchStartY = e.touches[0].clientY;
        }
      }, { passive: true });

      sidebar.addEventListener('touchmove', (e) => {
        if (!e.touches || e.touches.length === 0) return;
        const currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;
        const deltaX = Math.abs(currentX - touchStartX);
        const deltaY = Math.abs(currentY - touchStartY);

        // Nếu ngón tay di chuyển lệch sang hai bên (kéo qua lại), chặn ngay để giữ menu cố định
        // Chiều dọc (chạy lên xuống) vẫn cuộn tự nhiên 100% mượt mà
        if (deltaX > deltaY && deltaX > 6) {
          if (e.cancelable) {
            e.preventDefault();
          }
        }
      }, { passive: false });

      // Khóa scrollLeft luôn bằng 0 ở cả sidebar và sidebar-nav
      sidebar.addEventListener('scroll', () => {
        if (sidebar.scrollLeft !== 0) sidebar.scrollLeft = 0;
      }, { passive: true });

      const sidebarNav = sidebar.querySelector('.sidebar-nav');
      if (sidebarNav) {
        sidebarNav.addEventListener('scroll', () => {
          if (sidebarNav.scrollLeft !== 0) sidebarNav.scrollLeft = 0;
        }, { passive: true });
      }
    }

    // Chặn cuộn nền khi chạm vào backdrop
    if (backdrop) {
      backdrop.addEventListener('touchmove', (e) => {
        if (e.cancelable) e.preventDefault();
      }, { passive: false });
    }
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

        // Tự động tắt tất cả các modal, tab popup cũ khi bấm qua menu khác ở dưới
        if (typeof window.closeAllModalsAndOverlays === 'function') {
          window.closeAllModalsAndOverlays();
        } else if (window.app && typeof app.closeAllModalsAndOverlays === 'function') {
          app.closeAllModalsAndOverlays();
        } else {
          document.querySelectorAll('.modal-backdrop.active').forEach(m => m.classList.remove('active'));
          document.body.style.overflow = '';
        }

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

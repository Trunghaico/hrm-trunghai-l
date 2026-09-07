// ==========================================================================
// COMPANY BRANDING MODULE (THƯƠNG HIỆU DOANH NGHIỆP - MẶC ĐỊNH ASSETS/LOGO.PNG)
// ==========================================================================

const appCompany = {
  initialized: false,
  currentCompany: {
    brand_name: "TRUNG HẢI",
    full_name: "CÔNG TY CỔ PHẦN ĐẦU TƯ VÀ XÂY DỰNG TRUNG HẢI",
    subtitle: "HRM ENTERPRISE",
    logo_url: "assets/logo.png",
    tax_code: "0101234567",
    phone: "024.1234.5678",
    email: "contact@trunghaico.vn",
    address: "Tòa nhà Trung Hải, Hà Nội",
    website: "https://trunghaico.vn"
  },

  async init() {
    if (!this.initialized) {
      this.initialized = true;
    }
    this.applyBranding(this.currentCompany);
  },

  applyBranding(company) {
    const brandName = company?.brand_name || 'TRUNG HẢI';
    const fullName = company?.full_name || 'CÔNG TY CỔ PHẦN ĐẦU TƯ VÀ XÂY DỰNG TRUNG HẢI';
    const subtitle = company?.subtitle || 'HRM ENTERPRISE';
    const logoUrl = 'assets/logo.png';

    // 1. Sidebar Brand Logo & Text
    document.querySelectorAll('.brand-logo-img').forEach(img => {
      img.src = logoUrl;
    });
    document.querySelectorAll('.brand-title').forEach(el => {
      el.textContent = brandName;
    });
    document.querySelectorAll('.brand-subtitle').forEach(el => {
      el.textContent = subtitle;
    });

    // 2. Login Screen Brand Logo & Text
    const loginLogo = document.querySelector('.login-logo');
    if (loginLogo) loginLogo.src = logoUrl;

    const loginSubtitle = document.querySelector('.login-subtitle');
    if (loginSubtitle) loginSubtitle.textContent = fullName;

    // 3. Document Title
    document.title = `HRM ENTERPRISE - ${brandName}`;
  },

  // Safe stubs in case external callers reference modal methods
  openModal() {},
  closeModal() {},
  resetDefaultLogo() {}
};

window.appCompany = appCompany;

/* ===== PORTFOLIO SCRIPT — Souvik Pachal ===== */

const API_URL = 'http://localhost:3000/api/contact';

/* ===== ENHANCED PARTICLES ===== */
(function initParticles() {
  const canvas = document.getElementById('particles-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, particles = [], shootingStars = [];

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const COLORS = ['rgba(0,212,255,', 'rgba(59,130,246,', 'rgba(14,165,233,', 'rgba(103,232,249,'];

  function Particle() {
    this.reset();
  }
  Particle.prototype.reset = function() {
    this.x = Math.random() * W;
    this.y = Math.random() * H;
    this.vx = (Math.random() - 0.5) * 0.6;
    this.vy = (Math.random() - 0.5) * 0.6;
    this.r = Math.random() * 1.8 + 0.4;
    this.alpha = Math.random() * 0.6 + 0.15;
    this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
    this.twinkle = Math.random() * Math.PI * 2;
    this.twinkleSpeed = 0.02 + Math.random() * 0.03;
  };
  Particle.prototype.update = function() {
    this.x += this.vx;
    this.y += this.vy;
    this.twinkle += this.twinkleSpeed;
    if (this.x < 0 || this.x > W) this.vx *= -1;
    if (this.y < 0 || this.y > H) this.vy *= -1;
  };

  function ShootingStar() { this.reset(); }
  ShootingStar.prototype.reset = function() {
    this.x = Math.random() * W * 0.7;
    this.y = Math.random() * H * 0.4;
    this.len = 80 + Math.random() * 120;
    this.speed = 6 + Math.random() * 8;
    this.alpha = 0;
    this.active = false;
    this.timer = Math.random() * 300;
  };
  ShootingStar.prototype.update = function() {
    if (this.timer > 0) { this.timer--; return; }
    if (!this.active) { this.active = true; this.alpha = 1; }
    this.x += this.speed;
    this.y += this.speed * 0.5;
    this.alpha -= 0.018;
    if (this.alpha <= 0) this.reset();
  };

  for (let i = 0; i < 100; i++) particles.push(new Particle());
  for (let i = 0; i < 3; i++) shootingStars.push(new ShootingStar());

  function drawConnections() {
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 100) {
          ctx.beginPath();
          ctx.strokeStyle = `rgba(0,212,255,${0.12 * (1 - dist / 100)})`;
          ctx.lineWidth = 0.5;
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }
  }

  function animate() {
    ctx.clearRect(0, 0, W, H);

    // Draw shooting stars
    shootingStars.forEach(s => {
      s.update();
      if (s.active && s.alpha > 0) {
        const grad = ctx.createLinearGradient(s.x, s.y, s.x - s.len, s.y - s.len * 0.5);
        grad.addColorStop(0, `rgba(255,255,255,${s.alpha})`);
        grad.addColorStop(1, 'rgba(0,212,255,0)');
        ctx.beginPath();
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5;
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - s.len, s.y - s.len * 0.5);
        ctx.stroke();
      }
    });

    // Draw connections
    drawConnections();

    // Draw particles
    particles.forEach(p => {
      p.update();
      const twinkleAlpha = p.alpha * (0.7 + 0.3 * Math.sin(p.twinkle));
      // Glow
      const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3);
      grd.addColorStop(0, `${p.color}${twinkleAlpha})`);
      grd.addColorStop(1, `${p.color}0)`);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();
      // Core dot
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `${p.color}${twinkleAlpha})`;
      ctx.fill();
    });

    requestAnimationFrame(animate);
  }
  animate();
})();

/* ===== TYPEWRITER ===== */
function nextRole(roles, index) {
  return roles[(index + 1) % roles.length];
}

(function initTypewriter() {
  const el = document.getElementById('typewriter-role');
  if (!el) return;
  const roles = ['Data Science Student', 'Java Developer', 'ML Enthusiast', 'Problem Solver'];
  let roleIndex = 0;
  let charIndex = 0;
  let deleting = false;

  function type() {
    const current = roles[roleIndex];
    if (deleting) {
      el.textContent = current.substring(0, charIndex--);
      if (charIndex < 0) {
        deleting = false;
        roleIndex = (roleIndex + 1) % roles.length;
        setTimeout(type, 400);
        return;
      }
      setTimeout(type, 60);
    } else {
      el.textContent = current.substring(0, charIndex++);
      if (charIndex > current.length) {
        deleting = true;
        setTimeout(type, 1800);
        return;
      }
      setTimeout(type, 100);
    }
  }
  type();
})();

/* ===== NAVBAR ===== */
(function initNavbar() {
  const navbar = document.getElementById('navbar');
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('nav-links');
  const links = document.querySelectorAll('.nav-link');

  // Scroll: add .scrolled class
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 50);
    updateActiveLink();
    toggleBackToTop();
  });

  // Hamburger toggle
  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('open');
    navLinks.classList.toggle('open');
  });

  // Close menu on link click
  links.forEach(link => {
    link.addEventListener('click', () => {
      hamburger.classList.remove('open');
      navLinks.classList.remove('open');
    });
  });

  // Active link on scroll
  function updateActiveLink() {
    const sections = document.querySelectorAll('section[id]');
    let current = '';
    sections.forEach(sec => {
      if (window.scrollY >= sec.offsetTop - 120) current = sec.id;
    });
    links.forEach(link => {
      link.classList.toggle('active', link.getAttribute('href') === '#' + current);
    });
  }
})();

/* ===== BACK TO TOP ===== */
function toggleBackToTop() {
  const btn = document.getElementById('back-to-top');
  if (btn) btn.style.opacity = window.scrollY > 400 ? '1' : '0';
}

/* ===== SCROLL REVEAL ===== */
(function initReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
})();

/* ===== SMOOTH SCROLL ===== */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

/* ===== TOAST ===== */
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  setTimeout(() => { toast.className = 'toast'; }, 4000);
}

/* ===== FORM VALIDATION ===== */
function validateForm(name, email, message) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!name || !name.trim()) return false;
  if (!email || !email.trim() || !emailRegex.test(email.trim())) return false;
  if (!message || !message.trim()) return false;
  return true;
}

/* ===== CONTACT FORM SUBMISSION ===== */
(function initContactForm() {
  const form = document.getElementById('contact-form');
  if (!form) return;

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    const nameEl = document.getElementById('name');
    const emailEl = document.getElementById('email');
    const messageEl = document.getElementById('message');
    const submitBtn = document.getElementById('submit-btn');
    const btnText = document.getElementById('btn-text');
    const btnLoading = document.getElementById('btn-loading');

    // Clear previous errors
    ['name', 'email', 'message'].forEach(id => {
      document.getElementById(id).classList.remove('error');
      document.getElementById(id + '-error').textContent = '';
    });

    const name = nameEl.value;
    const email = emailEl.value;
    const message = messageEl.value;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    let valid = true;
    if (!name.trim()) {
      nameEl.classList.add('error');
      document.getElementById('name-error').textContent = 'Name is required.';
      valid = false;
    }
    if (!email.trim() || !emailRegex.test(email.trim())) {
      emailEl.classList.add('error');
      document.getElementById('email-error').textContent = 'Valid email is required.';
      valid = false;
    }
    if (!message.trim()) {
      messageEl.classList.add('error');
      document.getElementById('message-error').textContent = 'Message is required.';
      valid = false;
    }
    if (!valid) return;

    // Disable button, show loading
    submitBtn.disabled = true;
    btnText.style.display = 'none';
    btnLoading.style.display = 'inline-flex';

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), message: message.trim() })
      });
      const data = await res.json();
      if (data.success) {
        showToast('✅ Message sent! I\'ll get back to you soon.', 'success');
        form.reset();
      } else {
        showToast('❌ ' + (data.error || 'Something went wrong. Please try again.'), 'error');
      }
    } catch {
      showToast('❌ Could not reach server. Please try again later.', 'error');
    } finally {
      submitBtn.disabled = false;
      btnText.style.display = 'inline-flex';
      btnLoading.style.display = 'none';
    }
  });
})();

if (typeof module !== 'undefined') {
  module.exports = { validateForm, nextRole };
}

/* ===== RESUME PERMISSION MODAL ===== */
(function initResumeModal() {
  const modal = document.getElementById('resume-modal');
  const openBtn = document.getElementById('cv-download-btn');
  const closeBtn = document.getElementById('modal-close');
  const form = document.getElementById('resume-request-form');
  if (!modal || !openBtn) return;

  openBtn.addEventListener('click', (e) => {
    e.preventDefault();
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  });

  function closeModal() {
    modal.style.display = 'none';
    document.body.style.overflow = '';
    if (form) form.reset();
    ['req-name', 'req-email', 'req-reason'].forEach(id => {
      const el = document.getElementById(id + '-error');
      if (el) el.textContent = '';
    });
  }

  closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nameEl = document.getElementById('req-name');
    const emailEl = document.getElementById('req-email');
    const reasonEl = document.getElementById('req-reason');
    const submitBtn = document.getElementById('req-submit-btn');
    const btnText = document.getElementById('req-btn-text');
    const btnLoading = document.getElementById('req-btn-loading');

    // Clear errors
    ['req-name', 'req-email', 'req-reason'].forEach(id => {
      document.getElementById(id + '-error').textContent = '';
      document.getElementById(id).classList.remove('error');
    });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    let valid = true;
    if (!nameEl.value.trim()) {
      nameEl.classList.add('error');
      document.getElementById('req-name-error').textContent = 'Name is required.';
      valid = false;
    }
    if (!emailEl.value.trim() || !emailRegex.test(emailEl.value.trim())) {
      emailEl.classList.add('error');
      document.getElementById('req-email-error').textContent = 'Valid email is required.';
      valid = false;
    }
    if (!reasonEl.value.trim()) {
      reasonEl.classList.add('error');
      document.getElementById('req-reason-error').textContent = 'Please provide a reason.';
      valid = false;
    }
    if (!valid) return;

    submitBtn.disabled = true;
    btnText.style.display = 'none';
    btnLoading.style.display = 'inline-flex';

    try {
      const res = await fetch(API_URL.replace('/api/contact', '/api/resume-request'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nameEl.value.trim(),
          email: emailEl.value.trim(),
          reason: reasonEl.value.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        closeModal();
        showToast('✅ Request sent! Souvik will review and email you the resume.', 'success');
      } else {
        showToast('❌ ' + (data.error || 'Something went wrong.'), 'error');
      }
    } catch {
      showToast('❌ Could not reach server. Please try again later.', 'error');
    } finally {
      submitBtn.disabled = false;
      btnText.style.display = 'inline-flex';
      btnLoading.style.display = 'none';
    }
  });
})();

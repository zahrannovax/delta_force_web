/* ============================================================
   DELTA FORCE CHEAT SITE — MAIN JAVASCRIPT
   Lenis smooth scroll, tilt cards, marquee, scroll reveal,
   sticky navbar, mobile menu
   ============================================================ */

'use strict';

/* ── 1. LENIS SMOOTH SCROLLING ──────────────────────────────── */
function initLenis() {
  if (typeof Lenis === 'undefined') return;

  const lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    direction: 'vertical',
    gestureDirection: 'vertical',
    smooth: true,
    mouseMultiplier: 1,
    smoothTouch: false,
    touchMultiplier: 2,
    infinite: false,
  });

  function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
  }
  requestAnimationFrame(raf);

  // Anchor link smooth scroll
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (e) => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        e.preventDefault();
        lenis.scrollTo(target, { offset: -80, duration: 1.4 });
      }
    });
  });
}

/* ── 2. STICKY NAVBAR SCROLL STATE ─────────────────────────── */
function initNavbar() {
  const navbar = document.querySelector('.navbar');
  if (!navbar) return;

  const onScroll = () => {
    if (window.scrollY > 40) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Highlight active link based on current page
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.navbar-links a').forEach((link) => {
    const linkPath = link.getAttribute('href').split('/').pop();
    if (linkPath === currentPath || (currentPath === '' && linkPath === 'index.html')) {
      link.classList.add('active');
    }
  });
}

/* ── 3. MOBILE HAMBURGER MENU ───────────────────────────────── */
function initMobileMenu() {
  const hamburger = document.querySelector('.hamburger');
  const mobileNav = document.querySelector('.mobile-nav');
  if (!hamburger || !mobileNav) return;

  hamburger.addEventListener('click', () => {
    const isOpen = hamburger.classList.toggle('open');
    mobileNav.classList.toggle('open', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });

  // Close on link click
  mobileNav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      hamburger.classList.remove('open');
      mobileNav.classList.remove('open');
      document.body.style.overflow = '';
    });
  });

  // Close on outside tap
  mobileNav.addEventListener('click', (e) => {
    if (e.target === mobileNav) {
      hamburger.classList.remove('open');
      mobileNav.classList.remove('open');
      document.body.style.overflow = '';
    }
  });
}

/* ── 4. 3D TILT CARD EFFECT ─────────────────────────────────── */
function initTiltCards() {
  const cards = document.querySelectorAll('.tilt-card');
  if (!cards.length) return;

  const MAX_TILT = 12;
  const PERSPECTIVE = 800;

  cards.forEach((card) => {
    const glow = card.querySelector('.tilt-card-glow');

    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const cx = rect.width / 2;
      const cy = rect.height / 2;

      const rotateX = ((y - cy) / cy) * -MAX_TILT;
      const rotateY = ((x - cx) / cx) * MAX_TILT;

      card.style.transform = `perspective(${PERSPECTIVE}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(8px)`;
      card.style.transition = 'transform 0.1s ease, border-color 0.35s ease, box-shadow 0.35s ease';

      if (glow) {
        glow.style.left = `${x}px`;
        glow.style.top = `${y}px`;
      }
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) translateZ(0)';
      card.style.transition = 'transform 0.55s ease, border-color 0.35s ease, box-shadow 0.35s ease';
    });
  });
}

/* ── 5. SCROLL REVEAL ANIMATION ─────────────────────────────── */
function initScrollReveal() {
  const elements = document.querySelectorAll('.reveal');
  if (!elements.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );

  elements.forEach((el) => observer.observe(el));
}

/* ── 6. MARQUEE DUPLICATE FOR SEAMLESS LOOP ─────────────────── */
function initMarquee() {
  const marquee = document.querySelector('.reviews-marquee');
  if (!marquee) return;

  // Clone all children for seamless looping
  const children = Array.from(marquee.children);
  children.forEach((child) => {
    const clone = child.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    marquee.appendChild(clone);
  });
}

/* ── 7. FAQ SMOOTH EXPAND ───────────────────────────────────── */
function initFAQ() {
  const faqItems = document.querySelectorAll('.faq-item');
  if (!faqItems.length) return;

  // Only one open at a time
  faqItems.forEach((item) => {
    item.addEventListener('toggle', () => {
      if (item.open) {
        faqItems.forEach((other) => {
          if (other !== item && other.open) {
            other.open = false;
          }
        });
      }
    });
  });
}

/* ── 8. KINETIC VIDEO PLAYER ──────────────────────────────────── */
function initVideo() {
  const player   = document.getElementById('kinetic-player');
  if (!player) return;

  const video    = document.getElementById('gameplay-video');
  const overlay  = document.getElementById('kinetic-overlay');
  const playBtn  = document.getElementById('kbtn-play');
  const playSvg  = document.getElementById('ksvg-play');
  const pauseSvg = document.getElementById('ksvg-pause');
  const progress = document.getElementById('k-progress-input');
  const progFill = document.getElementById('k-progress-fill');
  const timeEl   = document.getElementById('k-time');
  const muteBtn  = document.getElementById('kbtn-mute');
  const muteSvg  = document.getElementById('ksvg-mute');
  const unmuteSvg= document.getElementById('ksvg-unmute');
  const fsBtn    = document.getElementById('kbtn-fs');

  if (!video) return;

  // Start muted so browser allows initial programmatic play if needed, though user click acts as interaction
  video.muted  = true;
  video.volume = 1;
  let lastVolBeforeMute = 1;

  function fmtTime(s) {
    if (isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = String(Math.floor(s % 60)).padStart(2, '0');
    return `${m}:${sec}`;
  }

  function syncPlayPause() {
    const paused = video.paused;
    playSvg.classList.toggle('k-hidden', !paused);
    pauseSvg.classList.toggle('k-hidden', paused);
    player.classList.toggle('k-playing', !paused);
    player.classList.toggle('k-paused', paused);
    if (playBtn) playBtn.setAttribute('aria-label', paused ? 'Play' : 'Pause');
  }

  function syncVolume() {
    const muted = video.muted || video.volume === 0;
    muteSvg.classList.toggle('k-hidden', !muted);
    unmuteSvg.classList.toggle('k-hidden', muted);
    muteBtn.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
  }

  function syncProgress() {
    if (!video.duration) return;
    const pct = (video.currentTime / video.duration) * 100;
    if (progFill) progFill.style.width = `${pct}%`;
    if (progress) progress.value = pct;
    if (timeEl)   timeEl.textContent = `${fmtTime(video.currentTime)} / ${fmtTime(video.duration)}`;
  }

  function togglePlay() {
    if (video.paused) {
      // First click unmutes and plays
      video.muted = false;
      syncVolume();
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }

  // Click overlay to play
  if (overlay) {
    overlay.addEventListener('click', togglePlay);
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePlay(); }
    });
  }

  // Click video to toggle
  video.addEventListener('click', togglePlay);
  if (playBtn) playBtn.addEventListener('click', (e) => { e.stopPropagation(); togglePlay(); });

  // Event Listeners for UI Sync
  video.addEventListener('play', () => {
    overlay && overlay.classList.add('k-hidden');
    syncPlayPause();
  });
  video.addEventListener('pause', syncPlayPause);
  video.addEventListener('ended', () => {
    overlay && overlay.classList.remove('k-hidden');
    syncPlayPause();
  });
  video.addEventListener('timeupdate', syncProgress);
  video.addEventListener('loadedmetadata', syncProgress);

  // Scrubber control
  if (progress) {
    progress.addEventListener('input', () => {
      if (!video.duration) return;
      video.currentTime = (progress.value / 100) * video.duration;
      syncProgress();
    });
  }

  // Mute toggle
  if (muteBtn) {
    muteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (video.muted || video.volume === 0) {
        video.muted = false;
        video.volume = lastVolBeforeMute || 1;
      } else {
        lastVolBeforeMute = video.volume;
        video.muted = true;
      }
      syncVolume();
    });
  }

  // Fullscreen
  if (fsBtn) {
    fsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!document.fullscreenElement) {
        player.requestFullscreen?.() || player.webkitRequestFullscreen?.();
      } else {
        document.exitFullscreen?.() || document.webkitExitFullscreen?.();
      }
    });
  }

  // Init UI
  syncPlayPause();
  syncVolume();
}

/* ── 9. STAGGERED CARD REVEAL ───────────────────────────────── */
function initStaggeredReveal() {
  document.querySelectorAll('.grid-2, .grid-3, .grid-4, .pricing-showcase-grid').forEach((grid) => {
    const children = Array.from(grid.children);
    children.forEach((child, i) => {
      child.style.transitionDelay = `${i * 0.08}s`;
      child.classList.add('reveal');
    });
  });

  // Also reveal section headings
  document.querySelectorAll('.section-heading').forEach((el) => {
    el.classList.add('reveal');
  });

  // Howto steps
  document.querySelectorAll('.howto-step').forEach((el, i) => {
    el.style.transitionDelay = `${i * 0.12}s`;
    el.classList.add('reveal');
  });

  // Support CTA
  const cta = document.querySelector('.support-cta-inner');
  if (cta) cta.classList.add('reveal');

  // Preview cards
  document.querySelectorAll('.preview-card').forEach((el, i) => {
    el.style.transitionDelay = `${i * 0.1}s`;
    el.classList.add('reveal');
  });
}

/* ── 10. COPY BUTTON FOR SYSTEM REQUIREMENTS ────────────────── */
function initCopyButtons() {
  document.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const text = btn.getAttribute('data-copy');
      navigator.clipboard?.writeText(text).then(() => {
        const original = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = original; }, 1800);
      });
    });
  });
}

/* ── INIT ALL ────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initLenis();
  initNavbar();
  initMobileMenu();
  initStaggeredReveal();
  initScrollReveal();
  initTiltCards();
  initMarquee();
  initFAQ();
  initVideo();
  initCopyButtons();
});

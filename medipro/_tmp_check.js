
    (function () {
      var CONSENT_KEY = 'medipro_cookie_consent_v1';
      var ANALYTICS_ID = 'UA-34193032-1';
      var GTM_ID = 'GTM-K234TJ6';
      var analyticsLoaded = false;
      var recaptchaLoaded = false;
      var mapLoaded = false;
      var currentConsent = null;

      function loadAnalytics() {
        if (analyticsLoaded) {
          return;
        }

        window.dataLayer = window.dataLayer || [];
        window.gtag = window.gtag || function () { dataLayer.push(arguments); };

        var gtagScript = document.createElement('script');
        gtagScript.async = true;
        gtagScript.src = 'https://www.googletagmanager.com/gtag/js?id=' + ANALYTICS_ID;
        document.head.appendChild(gtagScript);

        window.gtag('js', new Date());
        window.gtag('config', ANALYTICS_ID);

        var gtmScript = document.createElement('script');
        gtmScript.async = true;
        gtmScript.src = 'https://www.googletagmanager.com/gtm.js?id=' + GTM_ID;
        document.head.appendChild(gtmScript);

        analyticsLoaded = true;
      }

      function loadMapEmbed() {
        if (mapLoaded) {
          return;
        }

        var mapFrame = document.getElementById('map-frame');
        if (!mapFrame) {
          return;
        }

        var src = mapFrame.getAttribute('data-map-src');
        if (!src) {
          return;
        }

        var iframe = document.createElement('iframe');
        iframe.src = src;
        iframe.width = '100%';
        iframe.height = '360';
        iframe.frameBorder = '0';
        iframe.style.border = '0';
        iframe.setAttribute('allowfullscreen', '');

        mapFrame.innerHTML = '';
        mapFrame.appendChild(iframe);
        mapLoaded = true;
      }

      function loadRecaptcha() {
        if (recaptchaLoaded) {
          return Promise.resolve(true);
        }

        return new Promise(function (resolve) {
          var script = document.createElement('script');
          script.src = 'https://www.google.com/recaptcha/api.js?render=explicit';
          script.async = true;
          script.defer = true;
          script.onload = function () {
            var slot = document.getElementById('recaptcha-slot');
            if (slot && !slot.getAttribute('data-widget-id') && typeof grecaptcha !== 'undefined') {
              var widgetId = grecaptcha.render('recaptcha-slot', {
                sitekey: '6LevlQAsAAAAADKV8YxncEuATee_4K8FvNlVa5QS'
              });
              slot.setAttribute('data-widget-id', widgetId);
            }
            recaptchaLoaded = true;
            resolve(true);
          };
          script.onerror = function () {
            resolve(false);
          };
          document.head.appendChild(script);
        });
      }

      function eraseCookie(name) {
        document.cookie = name + '=; Max-Age=-99999999; path=/';
        document.cookie = name + '=; Max-Age=-99999999; path=/; domain=' + location.hostname;
        document.cookie = name + '=; Max-Age=-99999999; path=/; domain=.' + location.hostname;
      }

      function clearAnalyticsCookies() {
        var names = ['_ga', '_gid', '_gat', '_gcl_au'];
        var all = document.cookie.split(';');

        for (var i = 0; i < names.length; i++) {
          eraseCookie(names[i]);
        }

        for (var j = 0; j < all.length; j++) {
          var rawName = all[j].split('=')[0].trim();
          if (rawName.indexOf('_ga_') === 0) {
            eraseCookie(rawName);
          }
        }

        window['ga-disable-' + ANALYTICS_ID] = true;
      }

      function applyAcceptedConsent() {
        currentConsent = 'accepted';
        window['ga-disable-' + ANALYTICS_ID] = false;
        loadAnalytics();
        loadMapEmbed();
        loadRecaptcha();
      }

      function applyRefusedConsent() {
        currentConsent = 'refused';
        clearAnalyticsCookies();
      }

      function getConsent() {
        try {
          return localStorage.getItem(CONSENT_KEY);
        } catch (e) {
          return null;
        }
      }

      function setConsent(value) {
        try {
          localStorage.setItem(CONSENT_KEY, value);
        } catch (e) {
          // no-op
        }
      }

      var cookieBanner = document.getElementById('cookie-banner');
      var settingsBtn = document.getElementById('cookie-settings-btn');
      var acceptBtn = document.getElementById('cookie-accept');
      var refuseBtn = document.getElementById('cookie-refuse');
      var mapAcceptBtn = document.getElementById('map-consent-accept');

      function showBanner() {
        cookieBanner.classList.add('show');
        settingsBtn.classList.remove('show');
      }

      function hideBanner() {
        cookieBanner.classList.remove('show');
        settingsBtn.classList.add('show');
      }

      var consent = getConsent();
      if (consent === 'accepted') {
        applyAcceptedConsent();
        hideBanner();
      } else if (consent === 'refused') {
        applyRefusedConsent();
        hideBanner();
      } else {
        showBanner();
      }

      acceptBtn.addEventListener('click', function () {
        setConsent('accepted');
        applyAcceptedConsent();
        hideBanner();
      });

      refuseBtn.addEventListener('click', function () {
        setConsent('refused');
        applyRefusedConsent();
        hideBanner();
      });

      if (mapAcceptBtn) {
        mapAcceptBtn.addEventListener('click', function () {
          setConsent('accepted');
          applyAcceptedConsent();
          hideBanner();
        });
      }

      settingsBtn.addEventListener('click', function () {
        showBanner();
      });

      function initGallery() {
        if (!window.jQuery || !jQuery.fn.nivoLightbox || window.__galleryInitialized) {
          return;
        }

        jQuery('.gallery-item a').nivoLightbox({
          effect: 'fadeScale',
          theme: 'default',
          keyboardNav: true,
          clickOverlayToClose: true,
          errorMessage: 'The requested content cannot be loaded. Please try again later.'
        });

        window.__galleryInitialized = true;
      }

      jQuery(function ($) {
        initGallery();
      });

      // ── Navbar ──────────────────────────────────────────
      var siteHeader = document.getElementById('site-header');
      var navToggle  = document.getElementById('nav-toggle');
      var navMenu    = document.getElementById('nav-menu');
      var navLinks   = navMenu ? navMenu.querySelectorAll('a.nav-link') : [];
      var navBrand   = document.querySelector('.nav-brand');
      var lastScroll = 0;
      var navTicking = false;

      function isMobileNav() {
        return window.matchMedia('(max-width: 768px)').matches;
      }

      function closeMenu() {
        if (navMenu)   navMenu.classList.remove('open');
        if (navToggle) navToggle.setAttribute('aria-expanded', 'false');
      }

      function openMenu() {
        if (!navMenu || !navToggle) {
          return;
        }
        navMenu.classList.add('open');
        navToggle.setAttribute('aria-expanded', 'true');
        if (siteHeader) {
          siteHeader.classList.remove('nav-hidden');
        }
      }

      function toggleMenu(forceOpen) {
        if (!navMenu || !navToggle) {
          return;
        }

        var open = typeof forceOpen === 'boolean'
          ? forceOpen
          : !navMenu.classList.contains('open');

        if (open) {
          openMenu();
        } else {
          closeMenu();
        }
      }

      if (navToggle && navMenu) {
        navToggle.addEventListener('click', function (e) {
          e.preventDefault();
          toggleMenu();
        });
      }

      function getHashFromHref(href) {
        if (!href) {
          return '';
        }

        var hashIndex = href.indexOf('#');
        if (hashIndex === -1) {
          return '';
        }

        return href.slice(hashIndex);
      }

      if (navMenu) {
        navMenu.addEventListener('click', function (e) {
          var el = e.target;
          while (el && el !== navMenu) {
            if (el.tagName === 'A' && el.classList.contains('nav-link')) {
              closeMenu();
              return;
            }
            el = el.parentNode;
          }
        });
      }

      if (navBrand) {
        navBrand.addEventListener('click', function () {
          closeMenu();
        });
      }

      document.addEventListener('click', function (e) {
        if (!isMobileNav() || !navMenu || !navToggle) {
          return;
        }

        if (!navMenu.classList.contains('open')) {
          return;
        }

        var clickInsideMenu = navMenu.contains(e.target);
        var clickOnToggle = navToggle.contains(e.target);
        if (!clickInsideMenu && !clickOnToggle) {
          closeMenu();
        }
      });

      window.addEventListener('resize', function () {
        if (!isMobileNav()) {
          closeMenu();
        }
      });

      function updateActiveLink() {
        var scrollY  = window.pageYOffset + 100;
        var activeId = '';
        Array.prototype.forEach.call(document.querySelectorAll('section[id]'), function (s) {
          if (scrollY >= s.offsetTop) activeId = s.id;
        });
        Array.prototype.forEach.call(navLinks, function (link) {
          var linkHash = getHashFromHref(link.getAttribute('href') || '');
          link.classList.toggle('active', linkHash === '#' + activeId);
        });
      }

      function onNavScroll() {
        if (navTicking) return;
        navTicking = true;
        requestAnimationFrame(function () {
          var scrollY  = window.pageYOffset;
          var menuOpen = navMenu && navMenu.classList.contains('open');
          if (scrollY <= 10 || menuOpen) {
            siteHeader.classList.remove('nav-hidden');
          } else if (scrollY > lastScroll + 8) {
            siteHeader.classList.add('nav-hidden');
          } else if (scrollY < lastScroll - 8) {
            siteHeader.classList.remove('nav-hidden');
          }
          lastScroll = scrollY;
          updateActiveLink();
          navTicking = false;
        });
      }

      window.addEventListener('scroll', onNavScroll, { passive: true });
      updateActiveLink();
      // ────────────────────────────────────────────────────

      window.addEventListener('load', function () {
        initGallery();
      });

      function isEmail(email) {
        var regex = /^([a-zA-Z0-9_.+-])+\@(([a-zA-Z0-9-])+\.)+([a-zA-Z0-9]{2,4})+$/;
        return regex.test(email);
      }

      jQuery('#contact-form').on('submit', function (e) {
        e.preventDefault();

        var name = jQuery.trim(jQuery('#name').val());
        var email = jQuery.trim(jQuery('#email').val());
        var subject = jQuery.trim(jQuery('#subject').val());
        var message = jQuery.trim(jQuery('#message').val());

        if (name.length === 0) {
          jQuery('#form-response').html('<div style="color:#790202;">Numele și prenumele trebuie completate.</div>');
          return;
        }

        if (!isEmail(email)) {
          jQuery('#form-response').html('<div style="color:#790202;">Adresa de email nu este corectă.</div>');
          return;
        }

        if (subject.length === 0 && message.length === 0) {
          jQuery('#form-response').html('<div style="color:#790202;">Mesajul trebuie completat.</div>');
          return;
        }

        if (message.length === 0) {
          message = subject;
          subject = 'Mesaj site';
        }

        if (subject.length === 0) {
          subject = 'Mesaj site';
        }

        var continueSubmit = function () {
          if (typeof grecaptcha !== 'undefined') {
            var responseToken = grecaptcha.getResponse();
            if (!responseToken) {
              jQuery('#form-response').html('<div style="color:#790202;">Te rugăm să completezi reCAPTCHA.</div>');
              return;
            }
          }

          jQuery('#btnContactUs').prop('disabled', true);
          jQuery('#form-response').html('');

          jQuery.post('mail1.html', {
            name: name,
            email: email,
            subject: subject,
            message: message,
            'g-recaptcha-response': typeof grecaptcha !== 'undefined' ? grecaptcha.getResponse() : ''
          }, function (response) {
            if (response && response.success) {
              jQuery('#form-response').html('<div style="color:green;">' + response.message + '</div>');
              jQuery('#contact-form')[0].reset();
              if (typeof grecaptcha !== 'undefined') {
                grecaptcha.reset();
              }
            } else {
              var msg = response && response.message ? response.message : 'A apărut o eroare la trimitere.';
              jQuery('#form-response').html('<div style="color:#790202;">' + msg + '</div>');
            }
            jQuery('#btnContactUs').prop('disabled', false);
          }, 'json').fail(function () {
            jQuery('#form-response').html('<div style="color:#790202;">Eroare server.</div>');
            jQuery('#btnContactUs').prop('disabled', false);
          });
        };

        if (currentConsent !== 'accepted') {
          jQuery('#form-response').html('<div style="color:#790202;">Pentru trimiterea formularului este necesar să accepți cookie-urile opționale (reCAPTCHA).</div>');
          showBanner();
          return;
        }

        loadRecaptcha().then(function (ok) {
          if (!ok) {
            jQuery('#form-response').html('<div style="color:#790202;">Nu am putut încărca reCAPTCHA. Încearcă din nou.</div>');
            return;
          }
          continueSubmit();
        });
      });
    })();
  

/**
 * Urban Kicks — Theme JavaScript
 * Minimal enhancements for the storefront experience.
 * Only runs on published storefronts with the Urban Kicks theme.
 */

(function () {
    'use strict';

    // ===== 1. Smooth Scroll for Anchor Links =====
    document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
        anchor.addEventListener('click', function (e) {
            var targetId = this.getAttribute('href');
            if (!targetId || targetId === '#') return;

            var target = document.querySelector(targetId);
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

    // ===== 2. Intersection Observer — Fade-In on Scroll =====
    if ('IntersectionObserver' in window) {
        var observerOptions = {
            root: null,
            rootMargin: '0px 0px -60px 0px',
            threshold: 0.1
        };

        var fadeObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('uk-visible');
                    fadeObserver.unobserve(entry.target);
                }
            });
        }, observerOptions);

        // Observe all sections
        document.querySelectorAll('section').forEach(function (section) {
            section.classList.add('uk-fade-target');
            fadeObserver.observe(section);
        });
    }

    // ===== 3. Parallax Scroll for Hero Section =====
    var heroSection = document.querySelector('section:first-of-type');
    if (heroSection) {
        var heroBg = heroSection.querySelector('.bg-cover, [style*="background-image"]');
        if (heroBg) {
            var ticking = false;
            window.addEventListener('scroll', function () {
                if (!ticking) {
                    window.requestAnimationFrame(function () {
                        var scrolled = window.pageYOffset;
                        var heroHeight = heroSection.offsetHeight;
                        if (scrolled < heroHeight) {
                            heroBg.style.transform = 'translateY(' + (scrolled * 0.3) + 'px)';
                        }
                        ticking = false;
                    });
                    ticking = true;
                }
            }, { passive: true });
        }
    }

    // ===== 4. Add CSS for fade animations =====
    var style = document.createElement('style');
    style.textContent = [
        '.uk-fade-target {',
        '    opacity: 0;',
        '    transform: translateY(20px);',
        '    transition: opacity 0.6s ease, transform 0.6s ease;',
        '}',
        '.uk-fade-target.uk-visible {',
        '    opacity: 1;',
        '    transform: translateY(0);',
        '}'
    ].join('\n');
    document.head.appendChild(style);
})();

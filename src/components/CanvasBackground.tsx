'use client';

import { useEffect, useRef } from 'react';

export default function CanvasBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let W = 0, H = 0;

    function resize() {
      W = canvas!.width = window.innerWidth;
      H = canvas!.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    const onMouse = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
    };
    const onLeave = () => {
      mouseRef.current.x = -9999;
      mouseRef.current.y = -9999;
    };
    document.addEventListener('mousemove', onMouse);
    document.addEventListener('mouseleave', onLeave);

    function hexToRgba(hex: string, a: number) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return `rgba(${r},${g},${b},${a})`;
    }

    // Layer 1: Flowing Waves
    const waves: {
      frequency: number; amplitude: number; speed: number; phase: number;
      yOffset: number; opacity: number; color1: string; color2: string;
    }[] = [];
    for (let i = 0; i < 5; i++) {
      waves.push({
        frequency: 0.0003 + Math.random() * 0.0005,
        amplitude: 20 + Math.random() * 25,
        speed: 0.0005 + Math.random() * 0.001,
        phase: Math.random() * Math.PI * 2,
        yOffset: H * 0.3 + Math.random() * H * 0.4,
        opacity: 0.05 + i * 0.025,
        color1: i < 3 ? '#0066ff' : '#38bdf8',
        color2: i < 2 ? '#38bdf8' : '#0066ff',
      });
    }

    function drawWaves(time: number) {
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      waves.forEach(wave => {
        ctx!.beginPath();
        ctx!.moveTo(0, H);
        for (let x = 0; x <= W; x += 4) {
          let y = wave.yOffset +
            Math.sin(x * wave.frequency + wave.phase + time * wave.speed) * wave.amplitude;
          y += Math.sin(x * wave.frequency * 2.3 + wave.phase * 0.7 + time * wave.speed * 1.5) *
            wave.amplitude * 0.05;
          if (mx > -999) {
            const dx = x - mx;
            const dy = y - my;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 400) {
              y += Math.sin(time * 0.005 + x * 0.003) * (1 - dist / 400) * 8;
            }
          }
          ctx!.lineTo(x, y);
        }
        ctx!.lineTo(W, H);
        ctx!.closePath();
        const grad = ctx!.createLinearGradient(0, wave.yOffset - wave.amplitude, 0, H);
        grad.addColorStop(0, hexToRgba(wave.color1, wave.opacity));
        grad.addColorStop(0.5, hexToRgba(wave.color2, wave.opacity * 0.5));
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx!.fillStyle = grad;
        ctx!.fill();
      });
    }

    // Layer 2: Floating Orbs
    const orbColors = [
      { inner: '#0066ff', outer: '#0044aa' },
      { inner: '#38bdf8', outer: '#0088cc' },
      { inner: '#ffffff', outer: '#88ccff' },
      { inner: '#0066ff', outer: '#38bdf8' },
      { inner: '#38bdf8', outer: '#0066ff' },
      { inner: '#ff6b6b', outer: '#cc4444' },
      { inner: '#ff6b6b', outer: '#ff4444' },
      { inner: '#ff6b6b', outer: '#cc3333' },
    ];
    const orbs: {
      x: number; y: number; radius: number; vx: number; vy: number;
      opacity: number; inner: string; outer: string; phase: number;
    }[] = [];
    for (let i = 0; i < 18; i++) {
      const c = orbColors[i % orbColors.length];
      orbs.push({
        x: Math.random() * W,
        y: Math.random() * H,
        radius: 30 + Math.random() * 90,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.15,
        opacity: 0.08 + Math.random() * 0.22,
        inner: c.inner,
        outer: c.outer,
        phase: Math.random() * Math.PI * 2,
      });
    }

    function drawOrbs(time: number) {
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      orbs.forEach(orb => {
        if (mx > -999) {
          const dx = mx - orb.x;
          const dy = my - orb.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 200 && dist > 1) {
            const force = (1 - dist / 200) * 0.15;
            orb.vx += (dx / dist) * force;
            orb.vy += (dy / dist) * force;
          }
        }
        orb.vx *= 0.998;
        orb.vy *= 0.998;
        orb.x += orb.vx;
        orb.y += orb.vy;
        if (orb.x < -orb.radius) orb.x = W + orb.radius;
        if (orb.x > W + orb.radius) orb.x = -orb.radius;
        if (orb.y < -orb.radius) orb.y = H + orb.radius;
        if (orb.y > H + orb.radius) orb.y = -orb.radius;

        const breathe = 1 + Math.sin(time * 0.0003 + orb.phase) * 0.06;
        const r = orb.radius * breathe;
        ctx!.save();
        ctx!.shadowBlur = r * 0.8;
        ctx!.shadowColor = hexToRgba(orb.inner, orb.opacity * 0.5);
        const grad = ctx!.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, r);
        grad.addColorStop(0, hexToRgba(orb.inner, orb.opacity));
        grad.addColorStop(0.6, hexToRgba(orb.outer, orb.opacity * 0.4));
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx!.beginPath();
        ctx!.arc(orb.x, orb.y, r, 0, Math.PI * 2);
        ctx!.fillStyle = grad;
        ctx!.fill();
        ctx!.restore();
      });
    }

    // Layer 3: Sparkle Particles
    const particles: {
      x: number; y: number; radius: number; phase: number;
      twinkleSpeed: number; color: string;
    }[] = [];
    for (let i = 0; i < 65; i++) {
      particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        radius: 1 + Math.random() * 2,
        phase: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.0005 + Math.random() * 0.001,
        color: Math.random() > 0.4 ? '#ffffff' : '#38bdf8',
      });
    }

    function drawParticles(time: number) {
      ctx!.lineWidth = 0.5;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            ctx!.strokeStyle = `rgba(56, 189, 248, ${(1 - dist / 100) * 0.15})`;
            ctx!.beginPath();
            ctx!.moveTo(particles[i].x, particles[i].y);
            ctx!.lineTo(particles[j].x, particles[j].y);
            ctx!.stroke();
          }
        }
      }
      particles.forEach(p => {
        const twinkle = (Math.sin(time * p.twinkleSpeed + p.phase) + 1) / 2;
        const alpha = twinkle * 0.9 + 0.1;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx!.fillStyle = p.color === '#ffffff'
          ? `rgba(255, 255, 255, ${alpha})`
          : `rgba(56, 189, 248, ${alpha})`;
        ctx!.fill();
        if (alpha > 0.6) {
          ctx!.beginPath();
          ctx!.arc(p.x, p.y, p.radius * 3, 0, Math.PI * 2);
          ctx!.fillStyle = p.color === '#ffffff'
            ? `rgba(255, 255, 255, ${alpha * 0.08})`
            : `rgba(56, 189, 248, ${alpha * 0.08})`;
          ctx!.fill();
        }
      });
    }

    // Cursor Glow
    function drawCursorGlow() {
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      if (mx < -999) return;
      const grad = ctx!.createRadialGradient(mx, my, 0, mx, my, 180);
      grad.addColorStop(0, 'rgba(56, 189, 248, 0.08)');
      grad.addColorStop(0.4, 'rgba(56, 189, 248, 0.03)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx!.beginPath();
      ctx!.arc(mx, my, 180, 0, Math.PI * 2);
      ctx!.fillStyle = grad;
      ctx!.fill();
    }

    const startTime = performance.now();
    function animate(timestamp: number) {
      const elapsed = timestamp - startTime;
      ctx!.clearRect(0, 0, W, H);
      ctx!.fillStyle = '#0a0e1a';
      ctx!.fillRect(0, 0, W, H);
      drawWaves(elapsed);
      drawOrbs(elapsed);
      drawParticles(elapsed);
      drawCursorGlow();
      animRef.current = requestAnimationFrame(animate);
    }
    animRef.current = requestAnimationFrame(animate);

    const onResize = () => {
      waves.forEach(w => { w.yOffset = H * 0.3 + Math.random() * H * 0.4; });
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('mousemove', onMouse);
      document.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="fixed inset-0 w-full h-full"
        style={{ zIndex: 0 }}
      />
      {/* Grain overlay */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ zIndex: 5, opacity: 0.045 }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
          <filter id="grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="4" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#grain)" />
        </svg>
      </div>
    </>
  );
}

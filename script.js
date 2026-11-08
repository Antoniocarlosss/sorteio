'use strict';
const $ = id => document.getElementById(id);
const total = 50;
const step = 360 / total;
const duration = 15;
const fmt = n => String(n).padStart(2, '0');
const mod = (n, m) => ((n % m) + m) % m;
const wheel = $('wheel');
const segments = [];
const bulbs = [];
const cells = [];
const svg = (tag, attrs, parent = wheel) => {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
  parent.append(el);
  return el;
};
wheel.innerHTML = `<defs>
  <linearGradient id="metal" x2="1" y2="1"><stop stop-color="#84541d"/><stop offset=".24" stop-color="#ffe6a3"/><stop offset=".42" stop-color="#b47a30"/><stop offset=".67" stop-color="#fff0a8"/><stop offset="1" stop-color="#86531c"/></linearGradient>
  <radialGradient id="emerald"><stop stop-color="#073626"/><stop offset=".76" stop-color="#136348"/><stop offset="1" stop-color="#218057"/></radialGradient>
  <radialGradient id="amber"><stop stop-color="#8b5726"/><stop offset=".77" stop-color="#c59142"/><stop offset="1" stop-color="#e8ba65"/></radialGradient>
  <radialGradient id="hub" cx=".38" cy=".27"><stop stop-color="#216b4e"/><stop offset=".76" stop-color="#0a3024"/><stop offset="1" stop-color="#041911"/></radialGradient>
  <filter id="bulbGlow" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="3" result="glow"/><feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>`;
const circle = (r, fill, extra = {}, parent = wheel) => svg('circle', {cx:250, cy:250, r, fill, ...extra}, parent);
const point = (r, angle) => {
  const radians = (angle - 90) * Math.PI / 180;
  return [250 + r * Math.cos(radians), 250 + r * Math.sin(radians)];
};
circle(248, 'url(#metal)', {stroke:'#4b2d12','stroke-width':2});
circle(238, '#102d22', {stroke:'#f1d189','stroke-width':1});
circle(223, '#402815', {stroke:'#d19b48','stroke-width':2});
const rotor = svg('g', {});
for (let i = 0; i < total; i++) {
  const angle = i * step;
  const [a,b] = [point(219, angle - step/2), point(219, angle + step/2)];
  const fill = i % 2 ? 'url(#amber)' : 'url(#emerald)';
  const wedge = svg('path', {d:`M250 250 L${a.join(' ')} A219 219 0 0 1 ${b.join(' ')} Z`, fill, stroke:'#e4bd72', 'stroke-width':.75}, rotor);
  const label = svg('text', {x:250, y:61, transform:`rotate(${angle} 250 250)`, fill:i % 2 ? '#231604' : '#fff7d9', 'text-anchor':'middle', 'dominant-baseline':'middle', 'font-size':17, 'font-family':'system-ui', 'font-weight':850}, rotor);
  label.textContent = fmt(i + 1);
  segments.push({wedge, label, fill, ink:label.getAttribute('fill')});
  const [cx, cy] = point(231, angle);
  bulbs.push(svg('circle', {cx, cy, r:2.7, fill:'#98713a'}));
  const cell = document.createElement('span');
  cell.className = 'cell';
  cell.textContent = fmt(i + 1);
  $('grid').append(cell);
  cells.push(cell);
}
circle(130, 'none', {stroke:'#ffdc92','stroke-width':1,opacity:.35});
circle(98, 'url(#metal)', {stroke:'#44280f','stroke-width':2});
circle(89, 'url(#hub)', {stroke:'#e4bc6d','stroke-width':1.4});
circle(78, 'none', {stroke:'#bd9859','stroke-width':.7,opacity:.6});
svg('path', {d:'M250 242c-14-11-14-22 0-34 14 12 14 23 0 34Zm-2 0c-15-1-23-11-25-21 13 0 22 8 25 21Zm4 0c15-1 23-11 25-21-13 0-22 8-25 21Z', fill:'none',stroke:'#f5d58b','stroke-width':1.8});
for (const [caption, y, size] of [['RIFA DA',265,17],['BELEZA',288,24]]) {
  svg('text',{x:250,y,fill:'#fff0bb','text-anchor':'middle','font-family':'Georgia','font-size':size,'font-weight':'bold','letter-spacing':2}).textContent=caption;
}

let rotation = 0;
let active = -1;
let running = false;
let sound = true;
let audio, master, noise;
let confettiFrame;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function update(angle, lit = true) {
  rotor.setAttribute('transform', `rotate(${mod(angle, 360)} 250 250)`);
  const next = lit ? mod(-Math.floor(angle / step + .5), total) : -1;
  if (next === active) return;
  if (active >= 0) {
    const old = segments[active];
    old.wedge.setAttribute('fill', old.fill);
    old.label.setAttribute('fill', old.ink);
    cells[active].classList.remove('active', 'win');
  }
  active = next;
  if (active >= 0) {
    segments[active].wedge.setAttribute('fill', '#ffdd83');
    segments[active].label.setAttribute('fill', '#261804');
    cells[active].classList.add('active');
  }
}

function lights(time, strength = 1) {
  const chase = Math.floor(time * 17);
  bulbs.forEach((bulb, i) => {
    const bright = strength && mod(i - chase, 10) < 4;
    bulb.setAttribute('fill', bright ? '#fff1a6' : '#9c7035');
    bulb.setAttribute('opacity', strength ? 1 : .46);
    if (bright) bulb.setAttribute('filter', 'url(#bulbGlow)');
    else bulb.removeAttribute('filter');
  });
}

function randomNumber() {
  const word = new Uint32Array(1);
  const limit = Math.floor(2 ** 32 / total) * total;
  do { crypto.getRandomValues(word); } while (word[0] >= limit);
  return word[0] % total + 1;
}

// Integrated velocity. After four seconds the speed is proportional to
// (1-u)^5 (1+5u), which joins the fast phase with zero acceleration.
const integral = 4 + 11 * 2 / 7;
function progress(seconds) {
  if (seconds <= 4) return Math.max(0, seconds) / integral;
  if (seconds >= duration) return 1;
  const left = (duration - seconds) / 11;
  return (integral - 11 * left ** 6 * (1 - 5 * left / 7)) / integral;
}
function crossingTime(fraction) {
  let lo = 0, hi = duration;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (progress(mid) < fraction) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function openAudio() {
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) return;
  if (!audio) {
    audio = new Audio();
    master = audio.createGain();
    master.gain.value = sound ? .65 : 0;
    master.connect(audio.destination);
    noise = audio.createBuffer(1, Math.ceil(audio.sampleRate * .04), audio.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  audio.resume().catch(() => {});
}
function tone(time, hz, span, level, end = hz, type = 'sine') {
  const osc = audio.createOscillator(), envelope = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(hz, time);
  osc.frequency.exponentialRampToValueAtTime(end, time + span);
  envelope.gain.setValueAtTime(.0001, time);
  envelope.gain.exponentialRampToValueAtTime(level, time + .003);
  envelope.gain.exponentialRampToValueAtTime(.0001, time + span);
  osc.connect(envelope).connect(master);
  osc.start(time);
  osc.stop(time + span);
}
function tick(time, final = false) {
  const src = audio.createBufferSource(), filter = audio.createBiquadFilter(), env = audio.createGain();
  src.buffer = noise;
  filter.type = 'bandpass';
  filter.frequency.value = final ? 2100 : 3200;
  filter.Q.value = 1.15;
  env.gain.setValueAtTime(final ? .48 : .29, time);
  env.gain.exponentialRampToValueAtTime(.0001, time + .024);
  src.connect(filter).connect(env).connect(master);
  src.start(time);
  src.stop(time + .025);
  tone(time, final ? 540 : 1050, .024, final ? .20 : .1, final ? 315 : 670, 'triangle');
}

function victory() {
  if (!sound) return;
  if (audio && audio.state === 'running') {
    const time = audio.currentTime;
    [392, 523.25, 659.25, 783.99, 1046.5].forEach((hz, i) => {
      tone(time + i * .09, hz, .48, .13, hz, 'triangle');
    });
    [523.25, 659.25, 783.99].forEach(hz => tone(time + .39, hz, .85, .075));
  }
  if ('speechSynthesis' in window && 'SpeechSynthesisUtterance' in window) {
    const speech = new SpeechSynthesisUtterance('Temos um vencedor! O número sorteado é...');
    speech.lang = 'pt-BR';
    const voices = speechSynthesis.getVoices();
    const voice = voices.find(v => v.lang.toLowerCase() === 'pt-br');
    if (voice) speech.voice = voice;
    speech.rate = .91;
    speech.pitch = .89;
    speechSynthesis.speak(speech);
  }
}

function animateSpin(from, distance) {
  const events = [];
  const finish = from + distance;
  for (let index = Math.floor(from / step + .5) + 1; (index - .5) * step < finish; index++) {
    events.push(crossingTime(((index - .5) * step - from) / distance));
  }
  const started = performance.now();

  let eventIndex = 0;
  return new Promise(resolve => {
    function frame(now) {
      const elapsed = (now - started) / 1000;
      rotation = from + distance * progress(elapsed);
      update(rotation);
      lights(elapsed);
      while (eventIndex < events.length && events[eventIndex] <= elapsed + .075) {
        const time = events[eventIndex++];
        if (audio?.state === 'running' && sound && time >= elapsed - .045) {
          tick(audio.currentTime + Math.max(0, time - elapsed));
        }
      }
      if (elapsed < duration) requestAnimationFrame(frame);
      else {
        rotation = mod(finish, 360);
        update(rotation);
        if (audio?.state === 'running' && sound) tick(audio.currentTime, true);
        resolve();
      }
    }
    requestAnimationFrame(frame);
  });
}

function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const canvas = $('confetti');
  const ctx = canvas.getContext('2d');
  const scale = Math.min(devicePixelRatio || 1, 2);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width = w * scale;
  canvas.height = h * scale;
  ctx.scale(scale, scale);
  const gold = ['#fff1ae','#ffdc72','#be832d','#f7be49','#fff8dc'];
  const particles = Array.from({length:180}, (_, i) => ({
    x:w * (.22 + Math.random() * .56), y:h * (.35 + Math.random() * .29),
    vx:(Math.random() - .5) * 780, vy:-120 - Math.random() * 530,
    size:3 + Math.random() * 7, color:gold[i % gold.length], spin:Math.random() * 14 - 7
  }));
  const start = performance.now();
  function frame(now) {
    const t = (now - start) / 1000;
    ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = Math.max(0, Math.min(1, (4 - t) / .8));
    for (const p of particles) {
      ctx.save();
      ctx.translate(p.x + p.vx * t / (1 + t * .6), p.y + p.vy * t + 160 * t * t);
      ctx.rotate(t * p.spin);
      ctx.fillStyle = p.color;
      ctx.fillRect(0,0,p.size,p.size * (.25 + .55 * Math.abs(Math.cos(t * p.spin))));
      ctx.restore();
    }
    if (t < 4 && $('result').open) confettiFrame = requestAnimationFrame(frame);
  }
  confettiFrame = requestAnimationFrame(frame);
}

function controls(locked) {
  $('spin').disabled = locked;
  $('reset').disabled = locked || active < 0;
}
function reveal(number) {
  $('winner').textContent = fmt(number);
  document.body.classList.add('revealing');
  $('result').showModal();
  confetti();
  victory();
}
$('spin').addEventListener('click', async () => {
  if (running) return;
  let number;
  try { number = randomNumber(); }
  catch {
    $('status').textContent = 'Gerador seguro indisponível neste navegador';
    return;
  }
  running = true;
  controls(true);
  if (sound) openAudio();
  cells[active]?.classList.remove('win');
  for (let i = 3; i > 0; i--) {
    $('status').textContent = `Sorteio em ${i}…`;
    const count = $('count');
    count.hidden = false;
    count.textContent = i;
    count.classList.remove('pop');
    void count.offsetWidth;
    count.classList.add('pop');
    lights(i / 4);
    await sleep(1000);
  }
  $('count').hidden = true;
  $('status').textContent = 'Roleta em movimento';
  const target = mod(-(number - 1) * step, 360);
  await animateSpin(rotation, 7 * 360 + mod(target - rotation, 360));
  cells[number - 1].classList.add('win');
  $('status').textContent = 'Sorteio concluído';
  await sleep(1000);
  lights(0, 0);
  reveal(number);
  $('status').textContent = `Resultado • ${fmt(number)}`;
  running = false;
  controls(false);
});
$('reset').addEventListener('click', () => {
  if (running) return;
  rotation = 0;
  update(0, false);
  lights(0, 0);
  $('status').textContent = 'Aguardando o sorteio';
  controls(false);
});
$('sound').addEventListener('click', () => {
  sound = !sound;
  if (sound) openAudio();
  if (master) master.gain.setTargetAtTime(sound ? .65 : 0, audio.currentTime, .008);
  if (!sound) window.speechSynthesis?.cancel();
  $('sound').setAttribute('aria-pressed', String(sound));
  $('sound').textContent = sound ? '♪ SOM ATIVADO' : '♪ SOM DESATIVADO';
});
$('full').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    $('status').textContent = 'Tela cheia indisponível neste navegador';
  }
});
document.addEventListener('fullscreenchange', () => {
  $('full').textContent = document.fullscreenElement ? '⛶ SAIR DA TELA CHEIA' : '⛶ TELA CHEIA';
});
$('close').addEventListener('click', () => $('result').close());
$('result').addEventListener('close', () => {
  document.body.classList.remove('revealing');
  cancelAnimationFrame(confettiFrame);
  const canvas = $('confetti');
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  window.speechSynthesis?.cancel();
  $('spin').focus();
});
window.speechSynthesis?.getVoices();

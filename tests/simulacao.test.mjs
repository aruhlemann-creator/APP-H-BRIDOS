// Testa a lógica do receptor com um transmissor simulado e um relógio virtual.
// Rodar: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createReceiver, convertToBinary } from '../src/vlc/receiver.js';
import { TEXTO_REFERENCIA } from '../src/vlc/referencia.js';

// Gerador pseudoaleatório com semente, para o teste ser repetível
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

function simulate({
  text = TEXTO_REFERENCIA,
  bitRate = 5,
  base = 50,
  high = 120,
  noise = 0.3,
  seed = 1,
  sampleEveryMs = 33, // ~30 leituras/s, como a câmera
  startDelayMs = 1500,
  framing = true,
  rawBits = null, // sequência de bits pronta (ignora text/framing)
}) {
  let t = 0;
  const timers = [];
  let out = { message: '', bits: '', stopped: false };

  const rx = createReceiver({
    referenceText: TEXTO_REFERENCIA,
    now: () => t,
    setTimer: (fn, ms) => {
      const id = Symbol();
      timers.push({ id, at: t + ms, fn });
      return id;
    },
    clearTimer: (id) => {
      const i = timers.findIndex((x) => x.id === id);
      if (i >= 0) timers.splice(i, 1);
    },
    onMessage: (m) => (out.message = m),
    onBits: (b) => (out.bits = b),
    onStop: () => (out.stopped = true),
  });

  const payload = convertToBinary(text);
  const bits = rawBits ?? (framing ? '10101010' + payload + '10101010' : payload);
  const period = 1000 / bitRate;
  const rand = rng(seed);

  rx.start(bitRate);
  const end = startDelayMs + bits.length * period + 3000;
  let nextSample = 0;
  for (; t <= end && !out.stopped; t += 1) {
    // dispara temporizadores vencidos
    timers.sort((a, b) => a.at - b.at);
    while (timers.length && timers[0].at <= t) timers.shift().fn();
    if (t >= nextSample) {
      const k = Math.floor((t - startDelayMs) / period);
      const on = k >= 0 && k < bits.length && bits[k] === '1';
      rx.pushLux((on ? high : base) + rand() * noise);
      nextSample = t + sampleEveryMs;
    }
  }
  rx.stop();
  return out;
}

test('recebe a mensagem de referência com BER 0 (5 bit/s, pouco ruído)', () => {
  for (let seed = 1; seed <= 5; seed++) {
    const r = simulate({ seed });
    assert.match(r.message, /Mensagem recebida:\nABCDEFGH\n/);
    assert.match(r.message, /BER: 0\.000000\nErros: 0 \/ 64/);
    assert.equal(r.stopped, true);
  }
});

test('funciona em todas as taxas de 1 a 5 bit/s', () => {
  for (let bitRate = 1; bitRate <= 5; bitRate++) {
    const r = simulate({ bitRate });
    assert.match(r.message, /BER: 0\.000000/, `falhou a ${bitRate} bit/s`);
  }
});

test('funciona com leituras rápidas do sensor de luz (Android)', () => {
  const r = simulate({ sampleEveryMs: 5 });
  assert.match(r.message, /BER: 0\.000000/);
});

test('avisa quando a mensagem tem tamanho diferente da referência', () => {
  const r = simulate({ text: 'OLA' });
  assert.match(r.message, /Mensagem recebida:\nOLA\n/);
  assert.match(r.message, /BER não calculada: comprimento diferente da referência/);
  assert.match(r.message, /Esperados: 64\nRecebidos: 24/);
});

test('para com erro quando o marcador final não chega', () => {
  // preâmbulo + 210 bytes de dados, sem marcador final
  const r = simulate({ rawBits: '10101010' + convertToBinary('x'.repeat(210)) });
  assert.ok(r.stopped);
  assert.match(r.message, /Erro: limite de dados atingido/);
});

test('sem flash, continua aguardando o sinal', () => {
  const r = simulate({ text: '', framing: false, noise: 0.1 });
  assert.match(r.message, /Calibrando sensor/);
  assert.equal(r.stopped, false);
});

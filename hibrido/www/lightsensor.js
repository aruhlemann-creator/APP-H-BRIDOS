// Camada de acesso à luz recebida. Entrega ao receptor um único número por
// leitura, de forma que a lógica em receiver.js não depende da plataforma.
//
// Fontes:
//  - 'sensor': sensor de luminosidade (lux), pela Generic Sensor API
//      (AmbientLightSensor) — só em navegadores que a suportam
//  - 'camera-front' / 'camera-back': brilho médio dos quadros da câmera
//      (0–255). Funciona em qualquer navegador com câmera.
//  - 'auto': sensor se disponível, senão câmera frontal.
(function () {
  const sourceSelect = () => document.getElementById('sourceSelect');
  const preview = () => document.getElementById('cameraPreview');

  // ---------- Sensor de luminosidade ----------
  const sensorSource = {
    webSensor: null,

    async isAvailable() {
      return 'AmbientLightSensor' in window;
    },

    async start(onLux) {
      const s = new window.AmbientLightSensor({ frequency: 60 });
      this.webSensor = s;
      s.addEventListener('reading', () => onLux(s.illuminance));
      await new Promise((resolve, reject) => {
        s.addEventListener('activate', resolve, { once: true });
        s.addEventListener('error', (ev) => reject(ev.error), { once: true });
        s.start();
      });
    },

    async stop() {
      if (this.webSensor) {
        this.webSensor.stop();
        this.webSensor = null;
      }
    },
  };

  // ---------- Câmera (brilho médio dos quadros) ----------
  const cameraSource = {
    stream: null,
    running: false,
    timer: null,
    canvas: null,
    ctx: null,

    async isAvailable() {
      return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    },

    async start(onLux, facingMode) {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 320 },
          height: { ideal: 240 },
          frameRate: { ideal: 30 },
        },
      });

      const video = preview();
      video.srcObject = this.stream;
      video.hidden = false;
      await video.play();

      // Trava exposição/balanço de branco onde o aparelho permitir; senão o
      // ajuste automático da câmera "compensa" o flash e reduz o contraste.
      await this.lockExposure();

      this.canvas = document.createElement('canvas');
      this.canvas.width = 32;
      this.canvas.height = 24;
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
      this.running = true;

      const measure = () => {
        if (!this.running) return;
        if (video.readyState >= 2) onLux(this.brightness(video));
        if ('requestVideoFrameCallback' in video) {
          video.requestVideoFrameCallback(measure);
        } else {
          this.timer = setTimeout(measure, 1000 / 30);
        }
      };
      measure();
    },

    async lockExposure() {
      const track = this.stream.getVideoTracks()[0];
      if (!track || !track.getCapabilities) return;
      const caps = track.getCapabilities();
      const advanced = {};
      if (caps.exposureMode && caps.exposureMode.includes('manual')) advanced.exposureMode = 'manual';
      if (caps.whiteBalanceMode && caps.whiteBalanceMode.includes('manual')) advanced.whiteBalanceMode = 'manual';
      if (Object.keys(advanced).length === 0) return;
      try { await track.applyConstraints({ advanced: [advanced] }); } catch (_) {}
    },

    // Luminância média (0–255) de uma versão reduzida do quadro
    brightness(video) {
      const { ctx, canvas } = this;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 4) {
        sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      }
      return sum / (d.length / 4);
    },

    async stop() {
      this.running = false;
      clearTimeout(this.timer);
      if (this.stream) {
        this.stream.getTracks().forEach((t) => t.stop());
        this.stream = null;
      }
      const video = preview();
      if (video) {
        video.srcObject = null;
        video.hidden = true;
      }
    },
  };

  // ---------- Seleção da fonte ----------
  let active = null;

  async function resolveSource() {
    const choice = sourceSelect() ? sourceSelect().value : 'auto';
    if (choice === 'sensor') return { src: sensorSource };
    if (choice === 'camera-front') return { src: cameraSource, facing: 'user' };
    if (choice === 'camera-back') return { src: cameraSource, facing: 'environment' };
    // auto
    if (await sensorSource.isAvailable()) return { src: sensorSource };
    return { src: cameraSource, facing: 'user' };
  }

  // Interface usada por receiver.js (inalterada)
  window.LightSensorBridge = {
    async isAvailable() {
      const { src } = await resolveSource();
      return src.isAvailable();
    },

    // onLux(valor) é chamado a cada nova leitura
    async start(onLux) {
      await this.stop();
      const { src, facing } = await resolveSource();
      active = src;
      await src.start(onLux, facing);
    },

    async stop() {
      if (active) {
        const src = active;
        active = null;
        await src.stop();
      }
    },
  };

  // Esconde a opção "Sensor de luz" onde ela nunca funciona (ex.: iOS)
  window.addEventListener('DOMContentLoaded', async () => {
    const sel = sourceSelect();
    if (!sel) return;
    if (!(await sensorSource.isAvailable())) {
      const opt = sel.querySelector('option[value="sensor"]');
      if (opt) opt.remove();
    }
  });
})();

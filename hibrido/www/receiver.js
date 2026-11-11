// Receptor VLC (OOK) — porte direto da lógica do MainActivity.kt original.
(function () {
  const $ = (id) => document.getElementById(id);
  const textLux = $('textLux');
  const textBits = $('textBits');
  const textMessage = $('textMessage');
  const editBitrate = $('editBitrate');

  // Mesmo protocolo do transmissor
  const preamble = '10101010';
  const endMarker = '10101010';
  const maxPayloadBits = 1600;

  let bitRate = 1;
  let bitPeriod = 1000;

  // Medidas do sensor
  let currentLux = 0;
  let baselineLux = 0;
  let highLux = 0;
  let thresholdLux = 0;
  let calibrationCount = 0;
  let calibrationSum = 0;

  // Estados
  let sampling = false;
  let synchronized = false;
  let receiving = false;

  let bitBuffer = '';
  let dataBuffer = '';
  let calibrationEnd = 0;
  let nextSampleTime = 0;
  let sampleTimer = null;

  const now = () => performance.now();
  const f2 = (v) => v.toFixed(2);

  // Agenda a amostragem em um instante absoluto (como Handler.postAtTime),
  // evitando acúmulo de atraso entre bits.
  function scheduleSample() {
    sampleTimer = setTimeout(sampleRunnable, Math.max(0, nextSampleTime - now()));
  }

  function sampleRunnable() {
    if (!sampling || !synchronized) return;
    sampleBit();
    if (sampling && synchronized) {
      nextSampleTime += bitPeriod;
      scheduleSample();
    }
  }

  // =========================================
  // INICIAR RECEPCAO
  // =========================================
  async function startReception() {
    await stopReception();

    let available = false;
    try { available = await LightSensorBridge.isAvailable(); } catch (_) {}
    if (!available) {
      textMessage.textContent = 'Erro: sensor de luminosidade indisponível.';
      return;
    }

    bitBuffer = '';
    dataBuffer = '';
    calibrationCount = 0;
    calibrationSum = 0;
    baselineLux = 0;
    highLux = 0;
    thresholdLux = 0;
    synchronized = false;
    receiving = false;
    sampling = true;

    textBits.textContent = '';
    textMessage.textContent =
      'Calibrando sensor...\nInicie a transmissão após a calibração.';

    calibrationEnd = now() + 700;

    try {
      await LightSensorBridge.start(onSensorChanged);
    } catch (e) {
      sampling = false;
      textMessage.textContent = 'Erro ao registrar sensor de luminosidade.';
    }
  }

  // =========================================
  // PARAR RECEPCAO
  // =========================================
  async function stopReception() {
    sampling = false;
    synchronized = false;
    receiving = false;
    clearTimeout(sampleTimer);
    try { await LightSensorBridge.stop(); } catch (_) {}
  }

  // =========================================
  // LEITURA DO SENSOR
  // =========================================
  function onSensorChanged(lux) {
    if (!sampling) return;

    currentLux = lux;
    const t = now();

    // Calibracao inicial com o flash apagado
    if (t < calibrationEnd) {
      calibrationSum += currentLux;
      calibrationCount++;
      textLux.textContent = `Lux: ${f2(currentLux)}\nCalibrando...`;
      return;
    }

    if (calibrationCount === 0) {
      baselineLux = currentLux;
    } else if (baselineLux === 0 && !synchronized) {
      baselineLux = calibrationSum / calibrationCount;
    }

    if (!synchronized) {
      // Diferenca minima para identificar o flash
      const triggerDelta = Math.max(0.2, baselineLux * 0.01);
      thresholdLux = baselineLux + triggerDelta;

      // Primeira subida: inicio do preambulo
      if (currentLux > thresholdLux) {
        synchronized = true;
        highLux = currentLux;
        nextSampleTime = t + bitPeriod / 2;
        scheduleSample();
        textMessage.textContent = 'Sinal detectado.\nSincronizando preâmbulo...';
      }
    } else {
      // Estima o nivel luminoso do bit 1
      if (currentLux > highLux) highLux = currentLux;
      // Limiar entre niveis baixo e alto
      thresholdLux = baselineLux + (highLux - baselineLux) * 0.5;
    }

    textLux.textContent =
      `Lux: ${f2(currentLux)}\n` +
      `Base: ${f2(baselineLux)}\n` +
      `Pico: ${f2(highLux)}\n` +
      `Limiar: ${f2(thresholdLux)}`;
  }

  // =========================================
  // AMOSTRAGEM E PROCESSAMENTO DOS BITS
  // =========================================
  function sampleBit() {
    processBit(currentLux > thresholdLux ? '1' : '0');
  }

  function processBit(bit) {
    bitBuffer += bit;
    if (bitBuffer.length > 200) bitBuffer = bitBuffer.slice(-200);
    textBits.textContent = bitBuffer.slice(-120);

    // Procurar preambulo
    if (!receiving) {
      if (bitBuffer.endsWith(preamble)) {
        receiving = true;
        dataBuffer = '';
        textMessage.textContent = 'Preâmbulo detectado.\nRecebendo mensagem...';
      }
      return;
    }

    dataBuffer += bit;

    // O marcador final so pode aparecer depois de um numero inteiro de bytes
    const payloadLength = dataBuffer.length - endMarker.length;
    if (dataBuffer.endsWith(endMarker) && payloadLength >= 0 && payloadLength % 8 === 0) {
      finishReception(dataBuffer.substring(0, payloadLength));
      return;
    }

    // Limite correspondente a 200 caracteres
    if (dataBuffer.length > maxPayloadBits + 8) {
      stopReception();
      textMessage.textContent =
        'Erro: limite de dados atingido.\nMarcador final não identificado.';
    }
  }

  // =========================================
  // FINALIZAR RECEPCAO
  // =========================================
  async function finishReception(bits) {
    stopReception();
    const message = decodeMessage(bits);
    textMessage.textContent =
      `Mensagem recebida:\n${message}\n\nBits úteis: ${bits.length}`;
    await calculateBER(bits);
  }

  function decodeMessage(bits) {
    let message = '';
    for (let i = 0; i + 8 <= bits.length; i += 8) {
      message += String.fromCharCode(parseInt(bits.substring(i, i + 8), 2));
    }
    return message;
  }

  // =========================================
  // CALCULAR BER
  // =========================================
  async function calculateBER(receivedBits) {
    let originalText;
    try {
      originalText = (await readTextFromAssets('assets/teste_vlc.txt')).slice(0, 200);
    } catch (_) {
      textMessage.textContent +=
        '\n\nBER indisponível: arquivo teste_vlc.txt não encontrado.';
      return;
    }

    const expectedBits = convertToBinary(originalText);
    if (expectedBits.length === 0) {
      textMessage.textContent += '\n\nBER indisponível: referência vazia.';
      return;
    }

    // A BER posicional so e valida com os bits corretamente alinhados
    if (receivedBits.length !== expectedBits.length) {
      textMessage.textContent +=
        '\n\nBER não calculada: comprimento diferente da referência.' +
        `\nEsperados: ${expectedBits.length}` +
        `\nRecebidos: ${receivedBits.length}`;
      return;
    }

    let errors = 0;
    for (let i = 0; i < expectedBits.length; i++) {
      if (receivedBits[i] !== expectedBits[i]) errors++;
    }
    const ber = errors / expectedBits.length;
    textMessage.textContent +=
      `\n\nBER: ${ber.toFixed(6)}\nErros: ${errors} / ${expectedBits.length}`;
  }

  // Igual ao original: junta as linhas sem quebras
  async function readTextFromAssets(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error('not found');
    return (await res.text()).split(/\r?\n/).join('');
  }

  function convertToBinary(text) {
    let binary = '';
    for (let i = 0; i < text.length; i++) {
      binary += text.charCodeAt(i).toString(2).padStart(8, '0');
    }
    return binary;
  }

  // =========================================
  // BOTOES
  // =========================================
  $('btnStartRx').addEventListener('click', () => {
    const parsed = parseInt(editBitrate.value, 10);
    bitRate = Number.isNaN(parsed) ? 1 : Math.min(5, Math.max(1, parsed));
    bitPeriod = 1000 / bitRate;
    startReception();
  });

  $('btnStopRx').addEventListener('click', () => stopReception());
  window.addEventListener('pagehide', () => stopReception());
})();

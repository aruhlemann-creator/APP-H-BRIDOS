// Receptor VLC (OOK).
// Porte da lógica do MainActivity.kt original, sem dependência de tela ou
// plataforma: recebe um valor de luz por leitura (pushLux) e avisa a
// interface pelos callbacks.

export const PREAMBLE = '10101010';
export const END_MARKER = '10101010';
export const MAX_PAYLOAD_BITS = 1600;
export const CALIBRATION_MS = 700;

const defaultNow = () =>
  globalThis.performance && globalThis.performance.now
    ? globalThis.performance.now()
    : Date.now();

export function createReceiver({
  referenceText, // texto de referência para a BER (teste_vlc.txt)
  onLuxInfo = () => {}, // ({ lux, base, peak, threshold, calibrating })
  onBits = () => {}, // (últimos bits recebidos)
  onMessage = () => {}, // (texto da caixa "Mensagem Decodificada")
  onStop = () => {}, // chamado quando a recepção termina sozinha
  now = defaultNow,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
}) {
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
  let message = '';

  const setMessage = (text) => {
    message = text;
    onMessage(message);
  };
  const appendMessage = (text) => setMessage(message + text);

  // Agenda a amostragem num instante absoluto (como Handler.postAtTime),
  // para não acumular atraso entre bits.
  function scheduleSample() {
    sampleTimer = setTimer(sampleRunnable, Math.max(0, nextSampleTime - now()));
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
  function start(bitRate) {
    stop();

    bitPeriod = 1000 / bitRate;
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

    onBits('');
    setMessage('Calibrando sensor...\nInicie a transmissão após a calibração.');

    calibrationEnd = now() + CALIBRATION_MS;
  }

  // =========================================
  // PARAR RECEPCAO
  // =========================================
  function stop() {
    sampling = false;
    synchronized = false;
    receiving = false;
    if (sampleTimer !== null) clearTimer(sampleTimer);
    sampleTimer = null;
  }

  // Encerramento iniciado pelo próprio receptor (fim da mensagem ou erro)
  function finish() {
    stop();
    onStop();
  }

  // =========================================
  // LEITURA DO SENSOR
  // =========================================
  function pushLux(lux) {
    if (!sampling) return;

    currentLux = lux;
    const t = now();

    // Calibracao inicial com o flash apagado
    if (t < calibrationEnd) {
      calibrationSum += currentLux;
      calibrationCount++;
      onLuxInfo({ lux: currentLux, calibrating: true });
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
        setMessage('Sinal detectado.\nSincronizando preâmbulo...');
      }
    } else {
      // Estima o nivel luminoso do bit 1
      if (currentLux > highLux) highLux = currentLux;
      // Limiar entre niveis baixo e alto
      thresholdLux = baselineLux + (highLux - baselineLux) * 0.5;
    }

    onLuxInfo({
      lux: currentLux,
      base: baselineLux,
      peak: highLux,
      threshold: thresholdLux,
      calibrating: false,
    });
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
    onBits(bitBuffer.slice(-120));

    // Procurar preambulo
    if (!receiving) {
      if (bitBuffer.endsWith(PREAMBLE)) {
        receiving = true;
        dataBuffer = '';
        setMessage('Preâmbulo detectado.\nRecebendo mensagem...');
      }
      return;
    }

    dataBuffer += bit;

    // O marcador final so pode aparecer depois de um numero inteiro de bytes
    const payloadLength = dataBuffer.length - END_MARKER.length;
    if (dataBuffer.endsWith(END_MARKER) && payloadLength >= 0 && payloadLength % 8 === 0) {
      finishReception(dataBuffer.substring(0, payloadLength));
      return;
    }

    // Limite correspondente a 200 caracteres
    if (dataBuffer.length > MAX_PAYLOAD_BITS + 8) {
      finish();
      setMessage('Erro: limite de dados atingido.\nMarcador final não identificado.');
    }
  }

  // =========================================
  // FINALIZAR RECEPCAO
  // =========================================
  function finishReception(bits) {
    finish();
    setMessage(`Mensagem recebida:\n${decodeMessage(bits)}\n\nBits úteis: ${bits.length}`);
    calculateBER(bits);
  }

  // =========================================
  // CALCULAR BER
  // =========================================
  function calculateBER(receivedBits) {
    if (typeof referenceText !== 'string') {
      appendMessage('\n\nBER indisponível: arquivo teste_vlc.txt não encontrado.');
      return;
    }

    // Igual ao original: linhas juntas, primeiros 200 caracteres
    const originalText = referenceText.split(/\r?\n/).join('').slice(0, 200);
    const expectedBits = convertToBinary(originalText);

    if (expectedBits.length === 0) {
      appendMessage('\n\nBER indisponível: referência vazia.');
      return;
    }

    // A BER posicional so e valida com os bits corretamente alinhados
    if (receivedBits.length !== expectedBits.length) {
      appendMessage(
        '\n\nBER não calculada: comprimento diferente da referência.' +
          `\nEsperados: ${expectedBits.length}` +
          `\nRecebidos: ${receivedBits.length}`
      );
      return;
    }

    let errors = 0;
    for (let i = 0; i < expectedBits.length; i++) {
      if (receivedBits[i] !== expectedBits[i]) errors++;
    }
    const ber = errors / expectedBits.length;
    appendMessage(`\n\nBER: ${ber.toFixed(6)}\nErros: ${errors} / ${expectedBits.length}`);
  }

  return { start, stop, pushLux, isRunning: () => sampling };
}

// =========================================
// TEXTO <-> BINARIO
// =========================================
export function decodeMessage(bits) {
  let message = '';
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    message += String.fromCharCode(parseInt(bits.substring(i, i + 8), 2));
  }
  return message;
}

export function convertToBinary(text) {
  let binary = '';
  for (let i = 0; i < text.length; i++) {
    binary += text.charCodeAt(i).toString(2).padStart(8, '0');
  }
  return binary;
}
